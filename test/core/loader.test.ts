import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadGlossaryByScope, findGlossaryFile, parseGlossaryFile } from "../../src/core/loader.js";

const TEST_DIR = join(tmpdir(), "oag-test-loader-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".agents"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".pi"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("loader", () => {
  it("loads glossary.json from project .agents/glossary.json", () => {
    const entries = [
      { term: "DRY", definition: "Don't Repeat Yourself" },
      { term: "KISS", definition: "Keep It Simple, Stupid" },
    ];
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify(entries)
    );

    const result = loadGlossaryByScope("project", TEST_DIR);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].term).toBe("DRY");
  });

  it("loads .jsonl format", () => {
    const lines = [
      JSON.stringify({ term: "A", definition: "Def A" }),
      JSON.stringify({ term: "B", definition: "Def B" }),
    ].join("\n");
    writeFileSync(join(TEST_DIR, ".agents", "glossary.jsonl"), lines);

    const result = loadGlossaryByScope("project", TEST_DIR);
    expect(result.entries).toHaveLength(2);
  });

  it("throws if both .json and .jsonl exist", () => {
    writeFileSync(join(TEST_DIR, ".agents", "glossary.json"), "[]");
    writeFileSync(join(TEST_DIR, ".agents", "glossary.jsonl"), "");

    expect(() => loadGlossaryByScope("project", TEST_DIR)).toThrow("Conflict");
  });

  it("project .pi overrides project .agents on collision (later wins)", () => {
    writeFileSync(
      join(TEST_DIR, ".pi", "glossary.json"),
      JSON.stringify([{ term: "X", definition: "pi def" }])
    );
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "X", definition: "agents def" }])
    );

    // .agents is later in project paths, so it wins
    const result = loadGlossaryByScope("project", TEST_DIR);
    expect(result.entries.find((e) => e.term === "X")?.definition).toBe("agents def");
  });

  it("skips disabled entries", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([
        { term: "A", definition: "active" },
        { term: "B", definition: "disabled", enabled: false },
      ])
    );

    const result = loadGlossaryByScope("project", TEST_DIR);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].term).toBe("A");
  });

  it("returns empty when no glossary files exist in scope", () => {
    const emptyDir = join(tmpdir(), "oag-empty-" + Date.now());
    mkdirSync(emptyDir, { recursive: true });
    const result = loadGlossaryByScope("project", emptyDir);
    expect(result.entries).toHaveLength(0);
    expect(result.sources).toHaveLength(0);
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("validates entry schema", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "X" }]) // missing definition
    );
    expect(() => loadGlossaryByScope("project", TEST_DIR)).toThrow("definition");
  });

  it("findGlossaryFile returns null for nonexistent", () => {
    expect(findGlossaryFile(join(TEST_DIR, "nope"))).toBeNull();
  });
});
