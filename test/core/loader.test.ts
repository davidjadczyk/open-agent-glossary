import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadGlossaryByScope,
  loadGlossaryWithConfig,
  findGlossaryFile,
} from "../../src/core/loader.js";
import { DEFAULT_CONFIG } from "../../src/core/types.js";

const TEST_DIR = join(tmpdir(), "oag-test-loader-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".agents"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".pi"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".open-agent-glossary"), { recursive: true });
  mkdirSync(join(TEST_DIR, "extra"), { recursive: true });
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

  it("throws if both .json and .jsonl exist at same path", () => {
    writeFileSync(join(TEST_DIR, ".agents", "glossary.json"), "[]");
    writeFileSync(join(TEST_DIR, ".agents", "glossary.jsonl"), "");
    expect(() => loadGlossaryByScope("project", TEST_DIR)).toThrow("Conflict");
  });

  it("project .agents overrides .pi on same term (later in tier wins)", () => {
    writeFileSync(
      join(TEST_DIR, ".pi", "glossary.json"),
      JSON.stringify([{ term: "X", definition: "pi def" }])
    );
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "X", definition: "agents def" }])
    );
    const result = loadGlossaryByScope("project", TEST_DIR);
    expect(result.entries.find((e) => e.term === "X")?.definition).toBe("agents def");
  });

  it("loads from .open-agent-glossary/glossary.json", () => {
    writeFileSync(
      join(TEST_DIR, ".open-agent-glossary", "glossary.json"),
      JSON.stringify([{ term: "OAG", definition: "open-agent-glossary scoped entry" }])
    );
    const result = loadGlossaryByScope("project", TEST_DIR);
    expect(result.entries.find((e) => e.term === "OAG")?.definition).toBe(
      "open-agent-glossary scoped entry"
    );
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

  it("returns empty when no glossary files exist", () => {
    const emptyDir = join(tmpdir(), "oag-empty-" + Date.now());
    mkdirSync(emptyDir, { recursive: true });
    const result = loadGlossaryByScope("project", emptyDir);
    expect(result.entries).toHaveLength(0);
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("validates entry schema — missing definition throws", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "X" }])
    );
    expect(() => loadGlossaryByScope("project", TEST_DIR)).toThrow("definition");
  });

  it("findGlossaryFile returns null for nonexistent path", () => {
    expect(findGlossaryFile(join(TEST_DIR, "nope"))).toBeNull();
  });

  // ── mode: first ────────────────────────────────────────────────────────────
  it("mode:first stops at the first file found", () => {
    writeFileSync(
      join(TEST_DIR, ".pi", "glossary.json"),
      JSON.stringify([{ term: "FIRST", definition: "from pi" }])
    );
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "SECOND", definition: "from agents" }])
    );
    const result = loadGlossaryWithConfig(TEST_DIR, {
      ...DEFAULT_CONFIG,
      glossaryMode: "first",
      disableGlobalGlossary: true,
    });
    // .pi comes before .agents in project tier — only it is loaded
    expect(result.entries.find((e) => e.term === "FIRST")).toBeDefined();
    expect(result.entries.find((e) => e.term === "SECOND")).toBeUndefined();
    expect(result.sources).toHaveLength(1);
  });

  // ── mode: pin ──────────────────────────────────────────────────────────────
  it("mode:pin loads only the pinned file", () => {
    const pinFile = join(TEST_DIR, "extra", "pinned.json");
    writeFileSync(
      pinFile,
      JSON.stringify([{ term: "PINNED", definition: "only this one" }])
    );
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "IGNORED", definition: "should not appear" }])
    );
    const result = loadGlossaryWithConfig(TEST_DIR, {
      ...DEFAULT_CONFIG,
      glossaryMode: "pin",
      glossaryPin: pinFile,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].term).toBe("PINNED");
  });

  it("mode:pin throws when glossaryPin is not set", () => {
    expect(() =>
      loadGlossaryWithConfig(TEST_DIR, {
        ...DEFAULT_CONFIG,
        glossaryMode: "pin",
        glossaryPin: "",
      })
    ).toThrow("glossaryPin");
  });

  // ── extraGlossaryPaths ──────────────────────────────────────────────────────
  it("extraGlossaryPaths wins over built-in tiers", () => {
    const extraFile = join(TEST_DIR, "extra", "shared.jsonl");
    writeFileSync(extraFile, JSON.stringify({ term: "SRP", definition: "from extra" }));
    writeFileSync(
      join(TEST_DIR, ".agents", "glossary.json"),
      JSON.stringify([{ term: "SRP", definition: "from agents" }])
    );
    const result = loadGlossaryWithConfig(TEST_DIR, {
      ...DEFAULT_CONFIG,
      disableGlobalGlossary: true,
      extraGlossaryPaths: [extraFile],
    });
    expect(result.entries.find((e) => e.term === "SRP")?.definition).toBe("from extra");
  });

  // ── disableGlobalGlossary ──────────────────────────────────────────────────
  it("disableGlobalGlossary skips global tiers", () => {
    const result = loadGlossaryWithConfig(TEST_DIR, {
      ...DEFAULT_CONFIG,
      disableGlobalGlossary: true,
    });
    expect(result.sources.every((s) => !s.includes("agents") || s.includes(TEST_DIR))).toBe(true);
  });
});
