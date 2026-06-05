import type { GlossaryEntry, MatchResult } from "./types.js";

/**
 * Build a regex for a glossary entry from its term, aliases, and optional pattern.
 */
export function buildEntryRegex(entry: GlossaryEntry): RegExp {
  if (entry.pattern) {
    return new RegExp(entry.pattern, entry.flags ?? "iu");
  }

  // Build word-boundary regex from term + aliases
  const triggers = [entry.term, ...(entry.aliases ?? [])];
  const escaped = triggers.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = `\\b(?:${escaped.join("|")})\\b`;
  return new RegExp(pattern, entry.flags ?? "iu");
}

/**
 * Test a regex pattern (or term/alias-derived regex) against sample text using
 * the SAME logic as real injection matching. Reusable by the UI, MCP, and CLI
 * so any surface can verify a pattern actually matches.
 */
export interface PatternTestResult {
  valid: boolean;
  error?: string;
  /** Effective regex source/flags actually used. */
  source?: string;
  flags?: string;
  /** Match ranges in the sample (start inclusive, end exclusive). */
  matches: Array<{ start: number; end: number; text: string }>;
}

export function testPattern(input: {
  pattern?: string;
  flags?: string;
  term?: string;
  aliases?: string[];
  sample: string;
}): PatternTestResult {
  let regex: RegExp;
  try {
    regex = buildEntryRegex({
      term: input.term ?? "",
      definition: "",
      pattern: input.pattern,
      flags: input.flags,
      aliases: input.aliases,
    });
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : String(e),
      matches: [],
    };
  }

  // Ensure global flag so we can collect all matches without infinite loops.
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const g = new RegExp(regex.source, flags);
  const matches: PatternTestResult["matches"] = [];
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = g.exec(input.sample)) !== null) {
    if (m[0].length === 0) {
      g.lastIndex++;
      continue;
    }
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (++guard > 10000) break;
  }

  return { valid: true, source: regex.source, flags: regex.flags, matches };
}

/**
 * Match prompt text against all glossary entries.
 * Returns entries that match, with the specific trigger that matched.
 */
export function matchEntries(
  prompt: string,
  entries: GlossaryEntry[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const entry of entries) {
    if (entry.enabled === false) continue;

    const regex = buildEntryRegex(entry);
    const match = regex.exec(prompt);

    if (match) {
      results.push({
        entry,
        matchedOn: match[0],
      });
    }
  }

  return results;
}
