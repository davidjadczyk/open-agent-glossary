import { describe, it, expect } from "vitest";
import { deriveAliases } from "../../src/core/suggest.js";

describe("deriveAliases", () => {
  it("derives dashed<->spaced variants", () => {
    expect(deriveAliases("back-end")).toContain("back end");
    expect(deriveAliases("back end")).toContain("back-end");
  });

  it("derives naive plural/singular", () => {
    expect(deriveAliases("service")).toContain("services");
    expect(deriveAliases("services")).toContain("service");
  });

  it("never includes the original term", () => {
    expect(deriveAliases("BFF")).not.toContain("BFF");
  });
});
