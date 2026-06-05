/**
 * Pi extension adapter for open-agent-glossary.
 *
 * Mirrors pi-glossary's UI/behavior exactly:
 * - Editor highlighting of matched terms
 * - Footer status: 📖 files, 🏷️ terms, 👁️ injections, last term
 * - Lazy injection via before_agent_start (same message format)
 * - /glossary overlay + reload
 * - glossary_lookup tool for [[cross-refs]]
 *
 * Core logic (loading, matching, expanding) delegated to open-agent-glossary core.
 */
import { loadGlossary } from "../../core/loader.js";
import { matchEntries, buildEntryRegex } from "../../core/matcher.js";
import { expandDefinition } from "../../core/expander.js";
import { loadConfig } from "../../core/config.js";
import { loadSession } from "../../core/session.js";
import { recordUsage } from "../../core/usage.js";
import { startControlServer } from "../../server/control.js";
import type { GlossaryEntry } from "../../core/types.js";

type CompiledEntry = GlossaryEntry & { matcher: RegExp };

function formatEntry(entry: CompiledEntry, cwd: string): string {
  const expanded = expandDefinition(entry.definition, cwd);
  const aliases = entry.aliases?.length ? `Aliases: ${entry.aliases.join(", ")}\n` : "";
  const source = entry.source ? `Source: ${entry.source}\n` : "";
  return `### \`${entry.term}\`\n${aliases}${source}${expanded.trim()}`.trim();
}

function extractRefs(definition: string): string[] {
  return [...definition.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]!.trim());
}

/**
 * Highlight glossary term matches in an ANSI-encoded terminal line.
 */
function highlightTermsInAnsiLine(
  line: string,
  matchers: RegExp[],
  highlightFn: (s: string) => string
): string {
  const posMap: number[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "\x1b") {
      i++;
      while (i < line.length && (line.charCodeAt(i) < 0x40 || line.charCodeAt(i) > 0x7e)) i++;
      i++;
    } else {
      posMap.push(i);
      i++;
    }
  }
  const plain = posMap.map((idx) => line[idx]).join("");

  const ranges: Array<{ start: number; end: number }> = [];
  for (const matcher of matchers) {
    matcher.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = matcher.exec(plain)) !== null) {
      if (m[0].length === 0) { matcher.lastIndex++; continue; }
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  if (ranges.length === 0) return line;

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }

  let result = "";
  let lastAnsi = 0;
  for (const { start, end } of merged) {
    if (start >= posMap.length) continue;
    const ansiStart = posMap[start]!;
    const ansiEnd = end < posMap.length ? posMap[end]! : line.length;
    result += line.slice(lastAnsi, ansiStart);
    result += highlightFn(line.slice(ansiStart, ansiEnd));
    lastAnsi = ansiEnd;
  }
  return result + line.slice(lastAnsi);
}

/**
 * Proxy-based editor decorator for term highlighting.
 */
function withDecorations<T extends object>(inner: T, overrides: Partial<T>): T {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop in overrides) return (overrides as any)[prop];
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
    has(target, prop) {
      return prop in overrides || prop in target;
    },
  });
}

export default function openAgentGlossaryExtension(pi: any) {
  let entries: CompiledEntry[] = [];
  let termMap: Map<string, CompiledEntry> = new Map();
  let loadedTermsForSession = new Set<string>();
  let hasInjectedPreamble = false;
  let loadedFileCount = 0;
  let injectionCount = 0;
  let lastInjectedTerm = "";

  const PREAMBLE =
    "The user's prompt referenced explicit project glossary handles. " +
    "Treat the following definitions as authoritative for this turn. " +
    "Reuse them exactly as project-local language, and do not ask the user to restate them " +
    "unless the definitions conflict or are ambiguous.";

  const loadEntries = (cwd: string) => {
    entries = [];
    termMap = new Map();

    try {
      const glossary = loadGlossary(cwd);
      loadedFileCount = glossary.sources.length;
      entries = glossary.entries.map((e) => ({
        ...e,
        matcher: buildEntryRegex(e),
      }));
      termMap = new Map(entries.map((e) => [e.term.toLowerCase(), e]));
      return { found: glossary.sources.length > 0, count: entries.length, sources: glossary.sources };
    } catch (err) {
      loadedFileCount = 0;
      return { found: false, count: 0, sources: [] as string[], error: err instanceof Error ? err.message : String(err) };
    }
  };

  const updateStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    const parts: string[] = [];
    parts.push(`📖 ${loadedFileCount}`);
    parts.push(`🏷️ ${entries.length}`);
    parts.push(`👁️ ${injectionCount}`);
    if (lastInjectedTerm) {
      parts.push(lastInjectedTerm);
    }
    ctx.ui.setStatus("open-agent-glossary", parts.join("  "));
  };

  // --- /glossary command ---
  pi.registerCommand("glossary", {
    description: "Browse glossary terms or reload (/glossary reload)",
    handler: async (args: string, ctx: any) => {
      const trimmed = args?.trim();
      if (trimmed === "reload") {
        loadedTermsForSession = new Set();
        hasInjectedPreamble = false;
        injectionCount = 0;
        lastInjectedTerm = "";
        const result = loadEntries(ctx.cwd);
        updateStatus(ctx);
        if (result.error) {
          ctx.ui.notify(`Glossary reload failed: ${result.error}`, "error");
        } else {
          ctx.ui.notify(
            result.found
              ? `Glossary reloaded: ${result.count} entries`
              : "No glossary files found",
            "info"
          );
        }
        return;
      }

      if (entries.length === 0) {
        ctx.ui.notify("No glossary entries loaded", "info");
        return;
      }

      // List terms (simple notify for now; overlay can be added later)
      const lines = entries.map(
        (e) => `  ${e.term}${e.aliases?.length ? ` [${e.aliases.join(", ")}]` : ""}`
      );
      ctx.ui.notify(`Glossary (${entries.length} terms):\n${lines.join("\n")}`, "info");
    },
  });

  // --- glossary_lookup tool ---
  let Type: any;
  try {
    Type = require("@sinclair/typebox").Type;
  } catch {
    Type = {
      Object: (props: any) => ({ type: "object", properties: props, required: Object.keys(props) }),
      String: (opts?: any) => ({ type: "string", ...opts }),
    };
  }

  pi.registerTool({
    name: "glossary_lookup",
    label: "Glossary lookup",
    description:
      "Look up a glossary term by name and get its definition. " +
      "Use when a loaded definition contains a [[term-name]] cross-reference relevant to the task.",
    parameters: Type.Object({
      term: Type.String({ description: "The term name to look up (case-insensitive)" }),
    }),
    async execute(_toolCallId: string, params: { term: string }, _signal: any, _onUpdate: any, ctx: any) {
      const key = params.term.trim().toLowerCase();
      const entry = termMap.get(key);

      if (!entry) {
        return { content: [{ type: "text", text: `Glossary term not found: "${params.term}"` }] };
      }

      if (!loadedTermsForSession.has(entry.term)) {
        loadedTermsForSession.add(entry.term);
      }
      injectionCount++;
      lastInjectedTerm = entry.term;
      updateStatus(ctx);

      try {
        const session = loadSession(ctx.cwd);
        recordUsage("lookup", [entry.term], session.sessionId, ctx.cwd);
      } catch {
        // Usage tracking is best-effort.
      }

      return { content: [{ type: "text", text: formatEntry(entry, ctx.cwd) }] };
    },
  });

  // --- session_start: load glossary + set up editor highlighting ---
  pi.on("session_start", async (_event: any, ctx: any) => {
    loadedTermsForSession = new Set();
    hasInjectedPreamble = false;
    injectionCount = 0;
    lastInjectedTerm = "";

    const result = loadEntries(ctx.cwd);
    updateStatus(ctx);

    // --- Optional UI autostart ---
    try {
      const cfg = loadConfig(ctx.cwd);
      if (cfg.ui?.autostart) {
        void startControlServer({
          port: cfg.ui.port,
          cwd: ctx.cwd,
          serveUi: true,
          open: cfg.ui.open !== false,
        }).catch(() => {
          /* best-effort: never block a session on the UI */
        });
      }
    } catch {
      // ignore config/UI startup errors
    }

    if (result.error) {
      ctx.ui.notify(`Glossary load failed: ${result.error}`, "error");
      return;
    }
    if (result.found && result.count > 0) {
      ctx.ui.notify(`Glossary loaded: ${result.count} entries`, "info");
    }

    if (!ctx.hasUI) return;

    // --- Editor highlighting ---
    const fullTheme = ctx.ui.theme;
    const prevFactory = ctx.ui.getEditorComponent();
    const CURSOR_MARKER = "\x1b_pi:c\x07";

    // Some Pi/runtime combinations may not expose a wrap-ready editor factory here.
    // In that case, skip highlighting instead of crashing the whole extension.
    if (typeof prevFactory !== "function") {
      return;
    }

    ctx.ui.setEditorComponent((tui: any, theme: any, kb: any) => {
      const inner = prevFactory?.(tui, theme, kb);
      if (!inner) return null;

      let activeMatchers: RegExp[] = [];

      const updateMatchers = (text: string) => {
        activeMatchers = entries
          .filter((e) => {
            e.matcher.lastIndex = 0;
            const hit = e.matcher.test(text);
            e.matcher.lastIndex = 0;
            return hit;
          })
          .map((e) => new RegExp(e.matcher.source, e.matcher.flags.replace("g", "") + "g"));
      };

      return withDecorations(inner, {
        handleInput(data: string): void {
          inner.handleInput(data);
          updateMatchers(inner.getText());
        },
        render(width: number): string[] {
          const lines = inner.render(width);
          if (activeMatchers.length === 0) return lines;
          const hl = (s: string) => fullTheme.fg("warning", fullTheme.bold(s));
          return lines.map((line: string) => {
            const markerIdx = line.indexOf(CURSOR_MARKER);
            if (markerIdx === -1) {
              return highlightTermsInAnsiLine(line, activeMatchers, hl);
            }
            const before = line.slice(0, markerIdx);
            const after = line.slice(markerIdx + CURSOR_MARKER.length);
            return (
              highlightTermsInAnsiLine(before, activeMatchers, hl) +
              CURSOR_MARKER +
              highlightTermsInAnsiLine(after, activeMatchers, hl)
            );
          });
        },
        setText(text: string): void {
          inner.setText(text);
          updateMatchers(text);
        },
      });
    });
  });

  // --- before_agent_start: inject matched terms ---
  pi.on("before_agent_start", async (event: any, ctx: any) => {
    if (entries.length === 0) return;

    const prompt = event.prompt?.trim();
    if (!prompt) return;

    const newlyMatched = entries.filter((entry) => {
      if (loadedTermsForSession.has(entry.term)) return false;
      entry.matcher.lastIndex = 0;
      const hit = entry.matcher.test(prompt);
      entry.matcher.lastIndex = 0;
      return hit;
    });

    if (newlyMatched.length === 0) return;

    const newTerms = newlyMatched.map((e) => e.term);
    for (const t of newTerms) loadedTermsForSession.add(t);
    injectionCount += newTerms.length;
    lastInjectedTerm = newTerms[newTerms.length - 1];
    updateStatus(ctx);

    try {
      const session = loadSession(ctx.cwd);
      recordUsage("injection", newTerms, session.sessionId, ctx.cwd);
    } catch {
      // Usage tracking is best-effort.
    }

    const definitions = newlyMatched.map((e) => formatEntry(e, ctx.cwd));

    const hasRefs = newlyMatched.some((e) => extractRefs(e.definition).length > 0);
    const refHint = hasRefs
      ? "\n\nSome definitions contain `[[term-name]]` cross-references. Use the `glossary_lookup` tool to retrieve a referenced term's definition if relevant."
      : "";

    const header = hasInjectedPreamble
      ? "## Glossary"
      : `## Glossary\n${PREAMBLE}`;
    hasInjectedPreamble = true;

    const content = `${header}\n\n${definitions.join("\n\n")}${refHint}`;

    return {
      message: {
        customType: "glossary",
        content,
        display: false,
        details: { terms: newTerms },
      },
    };
  });
}
