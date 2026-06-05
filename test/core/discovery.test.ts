import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  discoverGlossaries,
  registerProject,
  readProjectRegistry,
} from "../../src/core/discovery.js";

const TEST_DIR = join(tmpdir(), "oag-test-discovery-" + Date.now());
const GLOBAL_DIR = join(TEST_DIR, "global");

beforeEach(() => {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  process.env.OAG_GLOBAL_DIR = GLOBAL_DIR;
});

afterEach(() => {
  delete process.env.OAG_GLOBAL_DIR;
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("discovery registry", () => {
  it("upserts and dedups projects, refreshing lastSeen", () => {
    registerProject("/a");
    registerProject("/b");
    registerProject("/a");
    const reg = readProjectRegistry();
    expect(reg.projects).toHaveLength(2);
    // Most-recently-seen first
    expect(reg.projects[0].root).toBe("/a");
  });

  it("returns empty registry when none exists", () => {
    expect(readProjectRegistry().projects).toHaveLength(0);
  });

  it("enumerates project-tier files from the registry with entry counts", () => {
    const proj = join(TEST_DIR, "proj");
    mkdirSync(join(proj, ".agents"), { recursive: true });
    writeFileSync(
      join(proj, ".agents", "glossary.json"),
      JSON.stringify([
        { term: "A", definition: "a" },
        { term: "B", definition: "b" },
      ])
    );
    registerProject(proj);

    const result = discoverGlossaries();
    const entry = result.projects.find((p) => p.root === proj);
    expect(entry).toBeDefined();
    const file = entry!.files.find((f) => f.path.endsWith("glossary.json"));
    expect(file?.scope).toBe("project");
    expect(file?.entryCount).toBe(2);
    expect(file?.exists).toBe(true);
  });

  it("registered project with no glossary files yields empty file list", () => {
    const proj = join(TEST_DIR, "empty-proj");
    mkdirSync(proj, { recursive: true });
    registerProject(proj);
    const result = discoverGlossaries();
    const entry = result.projects.find((p) => p.root === proj);
    expect(entry?.files).toHaveLength(0);
  });
});
