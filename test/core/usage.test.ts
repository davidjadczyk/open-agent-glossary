import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readUsage,
  recordUsage,
  getSessionUsage,
  getTopTerms,
  resetUsage,
  flushUsage,
} from "../../src/core/usage.js";

const TEST_DIR = join(tmpdir(), "oag-test-usage-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  process.env.OAG_GLOBAL_DIR = TEST_DIR;
  resetUsage();
});

afterEach(() => {
  delete process.env.OAG_GLOBAL_DIR;
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("usage", () => {
  it("records lookups into global, session, and per-term totals", () => {
    recordUsage("lookup", ["BFF"], "s1", "/proj");
    flushUsage();
    const store = readUsage();
    expect(store.totals.lookups).toBe(1);
    expect(store.totals.injections).toBe(0);
    expect(store.totals.byTerm["bff"].lookups).toBe(1);
    expect(store.sessions["s1"].lookups).toBe(1);
    expect(store.sessions["s1"].byTerm["bff"].lookups).toBe(1);
  });

  it("records injections separately from lookups", () => {
    recordUsage("injection", ["BFF", "DTO"], "s1", "/proj");
    flushUsage();
    const store = readUsage();
    expect(store.totals.injections).toBe(2);
    expect(store.totals.lookups).toBe(0);
    expect(store.totals.byTerm["dto"].injections).toBe(1);
  });

  it("isolates usage per session", () => {
    recordUsage("lookup", ["A"], "s1", "/a");
    recordUsage("lookup", ["B"], "s2", "/b");
    flushUsage();
    expect(getSessionUsage("s1")?.byTerm["a"].lookups).toBe(1);
    expect(getSessionUsage("s1")?.byTerm["b"]).toBeUndefined();
    expect(getSessionUsage("s2")?.byTerm["b"].lookups).toBe(1);
  });

  it("getTopTerms orders by combined usage and respects limit", () => {
    recordUsage("lookup", ["popular", "popular", "popular"], "s1", "/p");
    recordUsage("injection", ["popular"], "s1", "/p");
    recordUsage("lookup", ["rare"], "s1", "/p");
    flushUsage();
    const top = getTopTerms(1);
    expect(top).toHaveLength(1);
    expect(top[0].term).toBe("popular");
  });

  it("getTopTerms can filter ordering by kind", () => {
    recordUsage("lookup", ["a", "a"], "s1", "/p");
    recordUsage("injection", ["b", "b", "b"], "s1", "/p");
    flushUsage();
    expect(getTopTerms(1, "injection")[0].term).toBe("b");
    expect(getTopTerms(1, "lookup")[0].term).toBe("a");
  });

  it("accumulates across rapid sequential calls (debounced)", () => {
    for (let i = 0; i < 5; i++) recordUsage("lookup", ["x"], "s1", "/p");
    flushUsage();
    expect(readUsage().totals.byTerm["x"].lookups).toBe(5);
  });

  it("returns a fresh store for a corrupt file", () => {
    recordUsage("lookup", ["x"], "s1", "/p");
    flushUsage();
    // Corrupt the file
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(join(TEST_DIR, "usages.json"), "{ not json");
    const store = readUsage();
    expect(store.version).toBe(1);
    expect(store.totals.lookups).toBe(0);
  });

  it("resetUsage clears everything", () => {
    recordUsage("lookup", ["x"], "s1", "/p");
    flushUsage();
    resetUsage();
    const store = readUsage();
    expect(store.totals.lookups).toBe(0);
    expect(Object.keys(store.sessions)).toHaveLength(0);
  });

  it("ignores empty term lists", () => {
    recordUsage("lookup", [], "s1", "/p");
    flushUsage();
    expect(readUsage().totals.lookups).toBe(0);
  });
});
