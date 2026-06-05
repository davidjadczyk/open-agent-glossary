import { describe, it, expect } from "vitest";
import { matchEntries, buildEntryRegex } from "../../src/core/matcher.js";
import type { GlossaryEntry } from "../../src/core/types.js";

describe("matcher", () => {
  const entries: GlossaryEntry[] = [
    { term: "DRY", definition: "Don't Repeat Yourself", aliases: ["dont repeat yourself"] },
    { term: "EPER", definition: "Empresa de Pequeño Porte", aliases: ["EPP"] },
    { term: "regex-term", definition: "Custom pattern", pattern: "reg(?:ex|ular)" },
  ];

  it("matches by term (case-insensitive)", () => {
    const results = matchEntries("Please apply DRY principles", entries);
    expect(results).toHaveLength(1);
    expect(results[0].entry.term).toBe("DRY");
  });

  it("matches by alias", () => {
    const results = matchEntries("The EPP classification applies here", entries);
    expect(results).toHaveLength(1);
    expect(results[0].entry.term).toBe("EPER");
  });

  it("matches by custom pattern", () => {
    const results = matchEntries("Use regular expressions", entries);
    expect(results).toHaveLength(1);
    expect(results[0].entry.term).toBe("regex-term");
  });

  it("matches multiple entries", () => {
    const results = matchEntries("Apply DRY and check EPER status", entries);
    expect(results).toHaveLength(2);
  });

  it("returns empty for no matches", () => {
    const results = matchEntries("Nothing relevant here", entries);
    expect(results).toHaveLength(0);
  });

  it("respects word boundaries", () => {
    const entries2: GlossaryEntry[] = [
      { term: "API", definition: "Application Programming Interface" },
    ];
    // "API" should match but "RAPID" should not
    expect(matchEntries("Use the API", entries2)).toHaveLength(1);
    expect(matchEntries("RAPID development", entries2)).toHaveLength(0);
  });

  it("skips disabled entries", () => {
    const withDisabled: GlossaryEntry[] = [
      { term: "DRY", definition: "...", enabled: false },
    ];
    const results = matchEntries("Apply DRY", withDisabled);
    expect(results).toHaveLength(0);
  });
});

import { testPattern } from "../../src/core/matcher.js";

describe("testPattern", () => {
  it("matches term/alias-derived regex", () => {
    const r = testPattern({ term: "BFF", aliases: ["backend for frontend"], sample: "the BFF layer" });
    expect(r.valid).toBe(true);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].text).toBe("BFF");
  });

  it("matches an explicit pattern", () => {
    const r = testPattern({ pattern: "v\\d+", flags: "gi", sample: "v1 and v22" });
    expect(r.valid).toBe(true);
    expect(r.matches.map((m) => m.text)).toEqual(["v1", "v22"]);
  });

  it("reports invalid regex without throwing", () => {
    const r = testPattern({ pattern: "(", sample: "x" });
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
