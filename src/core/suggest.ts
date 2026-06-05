import { loadGlossaryByScope, resolveGlossaryPaths, findGlossaryFile } from "./loader.js";

export interface SuggestResult {
  scope: "project" | "global";
  targetFile: string;
  duplicate: null | { term: string; scope: string; path: string };
  aliasCandidates: string[];
  patternHint: string | null;
  formatHint: "json" | "jsonl";
}

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/;

/** Derive simple alias candidates: dashed<->spaced and naive plural/singular. */
export function deriveAliases(term: string): string[] {
  const out = new Set<string>();
  const lower = term.toLowerCase();

  if (term.includes("-")) out.add(term.replace(/-/g, " "));
  if (term.includes(" ")) out.add(term.replace(/\s+/g, "-"));

  // naive plural/singular
  if (/[^s]s$/.test(lower)) out.add(term.slice(0, -1));
  else if (/[a-z]$/i.test(term)) out.add(term + "s");

  out.delete(term);
  return Array.from(out);
}

/** Escape regex-special characters for a literal pattern. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Suggest scope, target file, duplicates, aliases, and format for a new term.
 */
export function suggestForTerm(term: string, cwd?: string): SuggestResult {
  const paths = resolveGlossaryPaths(cwd);

  // Project tier present in this repo?
  const projectFile = paths.project
    .map((base) => safeFind(base))
    .find((f): f is string => Boolean(f));
  const hasProjectTier = Boolean(projectFile);

  const scope: "project" | "global" = hasProjectTier ? "project" : "global";
  const targetFile =
    (scope === "project" ? projectFile : safeFind(paths.global[0])) ??
    (scope === "project" ? paths.project[1] : paths.global[2]) + ".jsonl";

  // Duplicate check across both tiers (merge order: project wins).
  let duplicate: SuggestResult["duplicate"] = null;
  for (const s of ["project", "global"] as const) {
    const g = loadGlossaryByScope(s, cwd);
    const hit = g.entries.find(
      (e) => e.term.toLowerCase() === term.toLowerCase()
    );
    if (hit) {
      duplicate = { term: hit.term, scope: s, path: g.sources[0] ?? "" };
      break;
    }
  }

  return {
    scope,
    targetFile,
    duplicate,
    aliasCandidates: deriveAliases(term),
    patternHint: REGEX_SPECIAL.test(term) ? escapeRegex(term) : null,
    // Shared/project glossaries favor jsonl; personal global favors json.
    formatHint: scope === "project" ? "jsonl" : "json",
  };
}

function safeFind(base: string): string | null {
  try {
    return findGlossaryFile(base);
  } catch {
    return null;
  }
}
