import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { SessionState, GlossaryConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

const SESSION_DIR = join(tmpdir(), "open-agent-glossary");
const SESSION_FILE = join(SESSION_DIR, "session.json");

function ensureSessionDir(): void {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
}

/**
 * Load current session state. Returns fresh state if expired or missing.
 */
export function loadSession(
  cwd?: string,
  config?: GlossaryConfig
): SessionState {
  const currentCwd = cwd ?? process.cwd();
  const ttl = (config?.sessionTtlMinutes ?? DEFAULT_CONFIG.sessionTtlMinutes) * 60_000;

  if (!existsSync(SESSION_FILE)) {
    return freshSession(currentCwd);
  }

  try {
    const content = readFileSync(SESSION_FILE, "utf-8");
    const state = JSON.parse(content) as SessionState;

    // Check TTL expiry
    if (Date.now() - state.lastUpdated > ttl) {
      return freshSession(currentCwd);
    }

    // Check cwd change (new project = new session)
    if (state.cwd !== currentCwd) {
      return freshSession(currentCwd);
    }

    // Backfill sessionId for sessions written before this field existed.
    if (!state.sessionId) {
      state.sessionId = randomUUID();
    }

    return state;
  } catch {
    return freshSession(currentCwd);
  }
}

/**
 * Save session state to disk.
 */
export function saveSession(state: SessionState): void {
  ensureSessionDir();
  const content = JSON.stringify(state, null, 2);
  writeFileSync(SESSION_FILE, content, "utf-8");
}

/**
 * Mark terms as loaded in the session.
 */
export function markTermsLoaded(
  session: SessionState,
  terms: string[]
): SessionState {
  const updated: SessionState = {
    ...session,
    loadedTerms: [...new Set([...session.loadedTerms, ...terms])],
    lastUpdated: Date.now(),
  };
  saveSession(updated);
  return updated;
}

/**
 * Reset session state.
 */
export function resetSession(cwd?: string): SessionState {
  const state = freshSession(cwd ?? process.cwd());
  saveSession(state);
  return state;
}

function freshSession(cwd: string): SessionState {
  return {
    sessionId: randomUUID(),
    loadedTerms: [],
    lastUpdated: Date.now(),
    cwd,
  };
}
