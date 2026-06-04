import { describe, it, expect } from "vitest";
import { buildInjection } from "../../src/core/injector.js";
import type { MatchResult, SessionState } from "../../src/core/types.js";

describe("injector", () => {
  const freshSession: SessionState = {
    loadedTerms: [],
    lastUpdated: Date.now(),
    cwd: "/tmp",
  };

  const matches: MatchResult[] = [
    {
      entry: { term: "DRY", definition: "Don't Repeat Yourself", aliases: ["dont repeat"] },
      matchedOn: "DRY",
    },
    {
      entry: { term: "KISS", definition: "Keep It Simple" },
      matchedOn: "KISS",
    },
  ];

  it("builds injection with preamble on first injection", () => {
    const result = buildInjection(matches, freshSession);
    expect(result.text).toContain("glossary terms are relevant");
    expect(result.text).toContain("**DRY**");
    expect(result.text).toContain("**KISS**");
    expect(result.newTerms).toEqual(["DRY", "KISS"]);
  });

  it("skips preamble on subsequent injections", () => {
    const sessionWithTerms: SessionState = {
      loadedTerms: ["OTHER"],
      lastUpdated: Date.now(),
      cwd: "/tmp",
    };
    const result = buildInjection(matches, sessionWithTerms);
    expect(result.text).not.toContain("glossary terms are relevant");
    expect(result.text).toContain("## Glossary");
  });

  it("filters out already-loaded terms", () => {
    const sessionWithDry: SessionState = {
      loadedTerms: ["DRY"],
      lastUpdated: Date.now(),
      cwd: "/tmp",
    };
    const result = buildInjection(matches, sessionWithDry);
    expect(result.text).not.toContain("**DRY**");
    expect(result.text).toContain("**KISS**");
    expect(result.newTerms).toEqual(["KISS"]);
  });

  it("returns empty when all terms already loaded", () => {
    const sessionFull: SessionState = {
      loadedTerms: ["DRY", "KISS"],
      lastUpdated: Date.now(),
      cwd: "/tmp",
    };
    const result = buildInjection(matches, sessionFull);
    expect(result.text).toBe("");
    expect(result.newTerms).toHaveLength(0);
  });

  it("includes aliases in output", () => {
    const result = buildInjection(matches, freshSession);
    expect(result.text).toContain("_Aliases: dont repeat_");
  });
});
