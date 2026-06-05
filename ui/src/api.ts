// Typed client for the open-agent-glossary control server.

export interface GlossaryEntry {
  term: string;
  definition: string;
  aliases?: string[];
  pattern?: string;
  flags?: string;
  enabled?: boolean;
  source?: string; // external reference (single string)
  tags?: string[]; // semantic scope
  // Annotations from the server:
  scope?: "global" | "project";
  sourcePath?: string | null;
  definedIn?: { path: string; tier: string; location: "global" | "project" } | null;
  overriddenBy?: string[];
}

export interface DiscoveredFile {
  path: string;
  format: "json" | "jsonl";
  scope: "global" | "project";
  tier: string;
  entryCount: number;
  exists: boolean;
}

export interface ProjectGlossaries {
  root: string;
  lastSeen: number;
  files: DiscoveredFile[];
}

export interface DiscoveryResult {
  global: DiscoveredFile[];
  projects: ProjectGlossaries[];
}

export interface SessionState {
  sessionId: string;
  loadedTerms: string[];
  lastUpdated: number;
  cwd: string;
}

export interface TermUsage {
  lookups: number;
  injections: number;
  lastUsed: number;
}

export interface SessionUsage {
  sessionId: string;
  cwd: string;
  startedAt: number;
  lastUsed: number;
  lookups: number;
  injections: number;
  byTerm: Record<string, { lookups: number; injections: number }>;
}

export interface UsageEvent {
  term: string;
  kind: "lookup" | "injection";
  ts: number;
  sessionId: string;
}

export interface UsageStore {
  version: 1;
  totals: {
    lookups: number;
    injections: number;
    byTerm: Record<string, TermUsage>;
  };
  sessions: Record<string, SessionUsage>;
  events: UsageEvent[];
}

export interface TopTerm {
  term: string;
  lookups: number;
  injections: number;
}

export interface SuggestResult {
  scope: "project" | "global";
  targetFile: string;
  duplicate: null | { term: string; scope: string; path: string };
  aliasCandidates: string[];
  patternHint: string | null;
  formatHint: "json" | "jsonl";
}

export interface PatternTestResult {
  valid: boolean;
  error?: string;
  source?: string;
  flags?: string;
  matches: Array<{ start: number; end: number; text: string }>;
}

export interface ConfigPathState {
  path: string;
  exists: boolean;
  used: boolean;
  shadowed: boolean;
}

export interface ConfigProvenance {
  config: GlossaryConfigShape;
  origins: Record<string, string>;
  stack: ConfigPathState[];
  activeFile: string | null;
}

export interface GlossaryConfigShape {
  sessionTtlMinutes: number;
  glossaryMode: "merge" | "first" | "pin";
  glossaryPin: string;
  extraGlossaryPaths: string[];
  disableGlobalGlossary: boolean;
  disableProjectGlossary: boolean;
  ui: { autostart: boolean; port: number; open: boolean };
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  health: () => http<{ ok: boolean; name: string; version: string }>("/health"),
  discovery: () => http<DiscoveryResult>("/discovery"),
  session: () => http<SessionState>("/session"),
  entries: (scope: "merged" | "global" | "project") =>
    http<{ entries: GlossaryEntry[] }>(`/entries?scope=${scope}`),
  addEntry: (entry: Partial<GlossaryEntry> & { term: string; definition: string }) =>
    http<{ ok: true }>("/entries", { method: "POST", body: JSON.stringify(entry) }),
  editEntry: (term: string, updates: Partial<GlossaryEntry> & { scope: string }) =>
    http<{ ok: true }>(`/entries/${encodeURIComponent(term)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deleteEntry: (term: string, scope: "global" | "project") =>
    http<{ ok: true }>(`/entries/${encodeURIComponent(term)}?scope=${scope}`, {
      method: "DELETE",
    }),
  usage: () => http<UsageStore>("/usage"),
  topTerms: (limit = 20, kind?: "lookup" | "injection") =>
    http<{ terms: TopTerm[] }>(
      `/usage/top?limit=${limit}${kind ? `&kind=${kind}` : ""}`
    ),
  timeline: (limit = 2000) =>
    http<{ events: UsageEvent[] }>(`/usage/timeline?limit=${limit}`),
  tags: () => http<{ tags: Array<{ tag: string; count: number }> }>("/tags"),
  suggest: (term: string) =>
    http<SuggestResult>(`/suggest?term=${encodeURIComponent(term)}`),
  testPattern: (input: {
    pattern?: string;
    flags?: string;
    term?: string;
    aliases?: string[];
    sample: string;
  }) =>
    http<PatternTestResult>("/pattern/test", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  config: () => http<ConfigProvenance>("/config"),
  saveConfig: (file: string, config: GlossaryConfigShape) =>
    http<{ ok: true; file: string }>("/config", {
      method: "PUT",
      body: JSON.stringify({ file, config }),
    }),
};
