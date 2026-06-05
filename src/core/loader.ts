import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import type { GlossaryEntry, GlossaryFile, LoadedGlossary, GlossaryConfig } from "./types.js";
import { loadConfig, resolveExtraPaths } from "./config.js";

/**
 * Built-in glossary search tiers.
 *
 * Tier 1 — Global Pi-specific (lowest priority):
 *   ~/.pi/agent/glossary
 *
 * Tier 2 — Global tool-agnostic:
 *   ~/.agents/glossary
 *   ~/.open-agent-glossary/glossary
 *
 * Tier 3 — Project Pi-specific:
 *   .pi/glossary
 *
 * Tier 4 — Project tool-agnostic (highest built-in priority):
 *   .agents/glossary
 *   .open-agent-glossary/glossary
 *
 * Tier 5 — User-defined extras from config (beats all built-in tiers):
 *   config.extraGlossaryPaths[]
 */
export function resolveGlossaryPaths(
  cwd?: string,
  config?: Required<GlossaryConfig>
): { global: string[]; project: string[]; extra: string[] } {
  const home = homedir();
  const projectDir = cwd ?? process.cwd();
  const cfg = config ?? loadConfig(cwd);

  const globalPaths = cfg.disableGlobalGlossary
    ? []
    : [
        join(home, ".pi", "agent", "glossary"),
        join(home, ".agents", "glossary"),
        join(home, ".open-agent-glossary", "glossary"),
      ];

  const projectPaths = cfg.disableProjectGlossary
    ? []
    : [
        join(projectDir, ".pi", "glossary"),
        join(projectDir, ".agents", "glossary"),
        join(projectDir, ".open-agent-glossary", "glossary"),
      ];

  const extraPaths = resolveExtraPaths(cfg.extraGlossaryPaths, cwd);

  return { global: globalPaths, project: projectPaths, extra: extraPaths };
}

/**
 * Find existing glossary files at a base path (checks .json and .jsonl).
 * Throws if both exist at the same path.
 */
export function findGlossaryFile(basePath: string): string | null {
  const jsonPath = basePath + ".json";
  const jsonlPath = basePath + ".jsonl";
  const jsonExists = existsSync(jsonPath);
  const jsonlExists = existsSync(jsonlPath);

  if (jsonExists && jsonlExists) {
    throw new Error(
      `Conflict: both ${jsonPath} and ${jsonlPath} exist. Remove one.`
    );
  }

  if (jsonExists) return jsonPath;
  if (jsonlExists) return jsonlPath;
  return null;
}

/**
 * Parse a glossary file (JSON array or JSONL).
 */
export function parseGlossaryFile(filePath: string): GlossaryFile {
  const content = readFileSync(filePath, "utf-8");
  const hash = createHash("sha256").update(content).digest("hex");

  let entries: GlossaryEntry[];

  if (filePath.endsWith(".jsonl")) {
    entries = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line, i) => {
        try {
          return JSON.parse(line) as GlossaryEntry;
        } catch {
          throw new Error(
            `Invalid JSONL at ${filePath}:${i + 1}: ${line.slice(0, 50)}`
          );
        }
      });
  } else {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error(`${filePath}: expected JSON array of glossary entries`);
    }
    entries = parsed as GlossaryEntry[];
  }

  for (const entry of entries) {
    if (!entry.term || typeof entry.term !== "string") {
      throw new Error(`${filePath}: entry missing required 'term' field`);
    }
    if (!entry.definition || typeof entry.definition !== "string") {
      throw new Error(
        `${filePath}: entry '${entry.term}' missing required 'definition' field`
      );
    }
  }

  return { path: filePath, entries, hash };
}

/**
 * Merge entries from a file into a term map.
 * Later calls win on term collision.
 */
function mergeInto(termMap: Map<string, GlossaryEntry>, file: GlossaryFile): void {
  for (const entry of file.entries) {
    if (entry.enabled === false) continue;
    termMap.set(entry.term.toLowerCase(), entry);
  }
}

/**
 * Load and merge all glossary files according to config mode.
 *
 * Modes:
 *   "merge" (default) — all tiers loaded, later tiers win on collision
 *   "first"           — stop at the first file found across all tiers
 *   "pin"             — only load config.glossaryPin, skip all discovery
 */
export function loadGlossary(cwd?: string): LoadedGlossary {
  const cfg = loadConfig(cwd);
  return loadGlossaryWithConfig(cwd, cfg);
}

export function loadGlossaryWithConfig(
  cwd?: string,
  cfg?: Required<GlossaryConfig>
): LoadedGlossary {
  const config = cfg ?? loadConfig(cwd);

  // ── pin mode ──────────────────────────────────────────────────────────────
  if (config.glossaryMode === "pin") {
    if (!config.glossaryPin) {
      throw new Error(
        "glossaryMode is 'pin' but no glossaryPin path is set in config."
      );
    }
    const pinPath = config.glossaryPin.startsWith("/")
      ? config.glossaryPin
      : resolve(cwd ?? process.cwd(), config.glossaryPin);

    const file = parseGlossaryFile(pinPath);
    const termMap = new Map<string, GlossaryEntry>();
    mergeInto(termMap, file);
    return { entries: Array.from(termMap.values()), sources: [pinPath] };
  }

  // ── first / merge modes ───────────────────────────────────────────────────
  const { global: globalPaths, project: projectPaths, extra: extraPaths } =
    resolveGlossaryPaths(cwd, config);

  const allPaths = [...globalPaths, ...projectPaths, ...extraPaths];
  const sources: string[] = [];
  const termMap = new Map<string, GlossaryEntry>();

  for (const basePath of allPaths) {
    // extra paths may already include extension, built-in paths do not
    const filePath = basePath.endsWith(".json") || basePath.endsWith(".jsonl")
      ? (existsSync(basePath) ? basePath : null)
      : findGlossaryFile(basePath);

    if (!filePath) continue;

    const glossaryFile = parseGlossaryFile(filePath);
    sources.push(filePath);
    mergeInto(termMap, glossaryFile);

    if (config.glossaryMode === "first") break; // stop at first hit
  }

  return { entries: Array.from(termMap.values()), sources };
}

/**
 * Load glossary from a specific scope only (ignores mode/pin/extra).
 * Used by CLI --scope flag.
 */
export function loadGlossaryByScope(
  scope: "global" | "project",
  cwd?: string
): LoadedGlossary {
  const paths = resolveGlossaryPaths(cwd);
  const scopePaths = scope === "global" ? paths.global : paths.project;
  const sources: string[] = [];
  const termMap = new Map<string, GlossaryEntry>();

  for (const basePath of scopePaths) {
    const filePath = findGlossaryFile(basePath);
    if (!filePath) continue;

    const glossaryFile = parseGlossaryFile(filePath);
    sources.push(filePath);
    mergeInto(termMap, glossaryFile);
  }

  return { entries: Array.from(termMap.values()), sources };
}
