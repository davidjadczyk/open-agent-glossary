import { describe, it, expect } from "vitest";
import { expandTemplates, expandCrossRefs, expandDefinition } from "../../src/core/expander.js";

describe("expander", () => {
  describe("expandTemplates", () => {
    it("expands shell commands", () => {
      const result = expandTemplates("Value: {{echo hello}}");
      expect(result).toBe("Value: hello");
    });

    it("handles multiple templates", () => {
      const result = expandTemplates("{{echo a}} and {{echo b}}");
      expect(result).toBe("a and b");
    });

    it("leaves failed commands as-is", () => {
      const result = expandTemplates("{{nonexistent-command-xyz}}");
      expect(result).toBe("{{nonexistent-command-xyz}}");
    });

    it("passes cwd to commands", () => {
      const result = expandTemplates("{{pwd}}", "/tmp");
      // /tmp may resolve to /private/tmp on macOS
      expect(result).toContain("tmp");
    });

    it("leaves text without templates unchanged", () => {
      const result = expandTemplates("No templates here");
      expect(result).toBe("No templates here");
    });
  });

  describe("expandCrossRefs", () => {
    it("expands [[term]] references", () => {
      const result = expandCrossRefs("See [[DRY]] for details");
      expect(result).toBe("See DRY (see glossary) for details");
    });

    it("handles multiple refs", () => {
      const result = expandCrossRefs("[[A]] and [[B]]");
      expect(result).toBe("A (see glossary) and B (see glossary)");
    });

    it("trims whitespace in refs", () => {
      const result = expandCrossRefs("[[ DRY ]]");
      expect(result).toBe("DRY (see glossary)");
    });
  });

  describe("expandDefinition", () => {
    it("applies both expansions", () => {
      const result = expandDefinition("Branch: {{echo main}}, see [[KISS]]");
      expect(result).toBe("Branch: main, see KISS (see glossary)");
    });
  });
});
