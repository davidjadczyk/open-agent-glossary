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
