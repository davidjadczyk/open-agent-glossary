/**
 * Core types for open-agent-glossary
 * Schema-compatible with pi-glossary (ruliana/pi-glossary)
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
  aliases?: string[];
  pattern?: string;
  flags?: string;
  enabled?: boolean;
  source?: string;
}

export interface GlossaryConfig {
  sessionTtlMinutes?: number;
}

export interface SessionState {
  loadedTerms: string[];
  lastUpdated: number;
  cwd: string;
}

export interface LoadedGlossary {
  entries: GlossaryEntry[];
  sources: string[];
}

export interface GlossaryFile {
  path: string;
  entries: GlossaryEntry[];
  hash: string;
}

export interface InjectionResult {
  text: string;
  matchedTerms: string[];
  newTerms: string[];
}

export interface MatchResult {
  entry: GlossaryEntry;
  matchedOn: string; // The term/alias/pattern that matched
}

export const DEFAULT_CONFIG: Required<GlossaryConfig> = {
  sessionTtlMinutes: 30,
};
