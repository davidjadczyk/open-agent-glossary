import { describe, it, expect } from "vitest";
import { loadSession, markTermsLoaded, resetSession } from "../../src/core/session.js";

describe("session", () => {
  it("returns fresh session when none exists", () => {
    const session = loadSession("/tmp/nonexistent-" + Date.now());
    expect(session.loadedTerms).toHaveLength(0);
  });

  it("marks terms as loaded", () => {
    const session = loadSession();
    const updated = markTermsLoaded(session, ["A", "B"]);
    expect(updated.loadedTerms).toContain("A");
    expect(updated.loadedTerms).toContain("B");
  });

  it("deduplicates loaded terms", () => {
    const session = loadSession();
    const s1 = markTermsLoaded(session, ["A", "B"]);
    const s2 = markTermsLoaded(s1, ["B", "C"]);
    expect(s2.loadedTerms).toEqual(["A", "B", "C"]);
  });

  it("resets session", () => {
    const session = loadSession();
    markTermsLoaded(session, ["X"]);
    const fresh = resetSession();
    expect(fresh.loadedTerms).toHaveLength(0);
  });
});
