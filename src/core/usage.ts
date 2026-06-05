import { readFileSync, existsSync } from "node:fs";
import { usageFilePath, atomicWriteJson } from "./paths.js";

export interface TermUsage {
  lookups: number;
  injections: number;
  lastUsed: number; // epoch ms
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

export interface UsageStore {
  version: 1;
  totals: {
    lookups: number;
    injections: number;
    byTerm: Record<string, TermUsage>;
  };
  sessions: Record<string, SessionUsage>;
  /** Capped ring-buffer of recent usage events for the timeline. */
  events: UsageEvent[];
}

export interface UsageEvent {
  term: string;
  kind: UsageKind;
  ts: number;
  sessionId: string;
}

/** Max events retained in the ring-buffer. */
export const MAX_EVENTS = 2000;

export type UsageKind = "lookup" | "injection";

function freshStore(): UsageStore {
  return {
    version: 1,
    totals: { lookups: 0, injections: 0, byTerm: {} },
    sessions: {},
    events: [],
  };
}

/**
 * Read the usage store from disk. Corrupt or missing files yield a fresh store.
 */
export function readUsage(): UsageStore {
  const path = usageFilePath();
  if (!existsSync(path)) return freshStore();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as UsageStore;
    if (!parsed || parsed.version !== 1 || !parsed.totals || !parsed.sessions) {
      return freshStore();
    }
    // Backfill events array for stores written before the ring-buffer existed.
    if (!Array.isArray(parsed.events)) parsed.events = [];
    return parsed;
  } catch {
    return freshStore();
  }
}

// ── Debounced flush ──────────────────────────────────────────────────────────
// Coalesce high-frequency writes within a short window to avoid disk thrash,
// while keeping an authoritative in-memory copy for synchronous reads.

const FLUSH_DELAY_MS = 250;
let pending: UsageStore | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending) {
    atomicWriteJson(usageFilePath(), pending);
    pending = null;
  }
}

function scheduleFlush(store: UsageStore): void {
  pending = store;
  if (flushTimer) return;
  flushTimer = setTimeout(flushNow, FLUSH_DELAY_MS);
  // Don't keep the process alive solely for a pending flush.
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

/**
 * Record glossary usage for a session. Updates global totals, the per-session
 * record, and per-term counters. Term keys are lowercased.
 */
export function recordUsage(
  kind: UsageKind,
  terms: string[],
  sessionId: string,
  cwd: string
): void {
  if (terms.length === 0) return;

  // Start from the most recent in-memory state if a flush is queued, so rapid
  // successive calls accumulate rather than clobber each other.
  const store = pending ?? readUsage();
  const now = Date.now();
  const field = kind === "lookup" ? "lookups" : "injections";

  let session = store.sessions[sessionId];
  if (!session) {
    session = {
      sessionId,
      cwd,
      startedAt: now,
      lastUsed: now,
      lookups: 0,
      injections: 0,
      byTerm: {},
    };
    store.sessions[sessionId] = session;
  }
  session.cwd = cwd;
  session.lastUsed = now;

  for (const raw of terms) {
    const term = raw.toLowerCase();

    store.totals[field] += 1;
    const total = store.totals.byTerm[term] ?? {
      lookups: 0,
      injections: 0,
      lastUsed: now,
    };
    total[field] += 1;
    total.lastUsed = now;
    store.totals.byTerm[term] = total;

    session[field] += 1;
    const st = session.byTerm[term] ?? { lookups: 0, injections: 0 };
    st[field] += 1;
    session.byTerm[term] = st;

    store.events.push({ term, kind, ts: now, sessionId });
  }

  // Trim ring-buffer to the cap (drop oldest).
  if (store.events.length > MAX_EVENTS) {
    store.events.splice(0, store.events.length - MAX_EVENTS);
  }

  scheduleFlush(store);
}

/** Get a single session's usage record, or null if unknown. */
export function getSessionUsage(sessionId: string): SessionUsage | null {
  const store = pending ?? readUsage();
  return store.sessions[sessionId] ?? null;
}

/**
 * Top terms by usage, optionally filtered to a single kind for ordering.
 */
export function getTopTerms(
  limit: number,
  kind?: UsageKind
): Array<{ term: string; lookups: number; injections: number }> {
  const store = pending ?? readUsage();
  const rows = Object.entries(store.totals.byTerm).map(([term, u]) => ({
    term,
    lookups: u.lookups,
    injections: u.injections,
  }));

  rows.sort((a, b) => {
    const av =
      kind === "lookup"
        ? a.lookups
        : kind === "injection"
          ? a.injections
          : a.lookups + a.injections;
    const bv =
      kind === "lookup"
        ? b.lookups
        : kind === "injection"
          ? b.injections
          : b.lookups + b.injections;
    if (bv !== av) return bv - av;
    return a.term.localeCompare(b.term);
  });

  return rows.slice(0, Math.max(0, limit));
}

/** Recent usage events (most recent last), capped by `limit`. */
export function getRecentEvents(limit = MAX_EVENTS): UsageEvent[] {
  const store = pending ?? readUsage();
  const events = store.events ?? [];
  return events.slice(Math.max(0, events.length - limit));
}

/** Reset all usage data (clears disk + in-memory queue). */
export function resetUsage(): void {
  pending = null;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  atomicWriteJson(usageFilePath(), freshStore());
}

/** Force any queued usage writes to disk immediately. */
export function flushUsage(): void {
  flushNow();
}
