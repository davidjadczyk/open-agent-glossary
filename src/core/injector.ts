import type { GlossaryEntry, InjectionResult, SessionState } from "./types.js";
import type { MatchResult } from "./types.js";
import { expandDefinition } from "./expander.js";

const PREAMBLE = `The following glossary terms are relevant to this conversation. Use these definitions when interpreting or responding to the user's message:`;

const HEADING = `## Glossary`;

/**
 * Build injection text from matched entries, filtering out already-loaded terms.
 */
export function buildInjection(
  matches: MatchResult[],
  session: SessionState,
  cwd?: string
): InjectionResult {
  const loadedSet = new Set(session.loadedTerms.map((t) => t.toLowerCase()));

  // Filter to only new terms
  const newMatches = matches.filter(
    (m) => !loadedSet.has(m.entry.term.toLowerCase())
  );

  if (newMatches.length === 0) {
    return { text: "", matchedTerms: [], newTerms: [] };
  }

  const isFirstInjection = session.loadedTerms.length === 0;
  const lines: string[] = [];

  if (isFirstInjection) {
    lines.push(PREAMBLE);
    lines.push("");
  }

  lines.push(HEADING);
  lines.push("");

  for (const match of newMatches) {
    const { entry } = match;
    const definition = expandDefinition(entry.definition, cwd);
    lines.push(`**${entry.term}**: ${definition}`);
    if (entry.aliases && entry.aliases.length > 0) {
      lines.push(`  _Aliases: ${entry.aliases.join(", ")}_`);
    }
    lines.push("");
  }

  return {
    text: lines.join("\n").trimEnd(),
    matchedTerms: matches.map((m) => m.entry.term),
    newTerms: newMatches.map((m) => m.entry.term),
  };
}
