import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, configPaths } from "../../src/core/config.js";

const TEST_DIR = join(tmpdir(), "oag-test-config-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".agents", "open-agent-glossary"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".open-agent-glossary"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".pi", "open-agent-glossary"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("config", () => {
  it("returns defaults when no config file exists", () => {
    const emptyDir = join(tmpdir(), "oag-config-empty-" + Date.now());
    mkdirSync(emptyDir, { recursive: true });
    const config = loadConfig(emptyDir);
    expect(config.sessionTtlMinutes).toBe(30);
    expect(config.glossaryMode).toBe("merge");
    expect(config.disableGlobalGlossary).toBe(false);
    expect(config.disableProjectGlossary).toBe(false);
    expect(config.extraGlossaryPaths).toEqual([]);
    expect(config.glossaryPin).toBe("");
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("loads project config from .agents/open-agent-glossary/config.json", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({ sessionTtlMinutes: 60 })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(60);
  });

  it("loads project config from .open-agent-glossary/config.json (highest priority)", () => {
    // Both exist — .open-agent-glossary wins (checked first)
    writeFileSync(
      join(TEST_DIR, ".open-agent-glossary", "config.json"),
      JSON.stringify({ sessionTtlMinutes: 99 })
    );
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({ sessionTtlMinutes: 50 })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(99);
  });

  it("loads glossaryMode from config", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({ glossaryMode: "first" })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.glossaryMode).toBe("first");
  });

  it("loads extraGlossaryPaths from config", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({ extraGlossaryPaths: ["./shared/glossary.jsonl"] })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.extraGlossaryPaths).toEqual(["./shared/glossary.jsonl"]);
  });

  it("loads disableGlobalGlossary flag", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({ disableGlobalGlossary: true })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.disableGlobalGlossary).toBe(true);
  });

  it("merges with defaults (partial config)", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({})
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(30);
    expect(config.glossaryMode).toBe("merge");
  });

  it("skips invalid JSON and falls through to defaults", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      "not valid json"
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(30);
  });

  it("deep-merges partial ui config with defaults", () => {
    writeFileSync(
      join(TEST_DIR, ".open-agent-glossary", "config.json"),
      JSON.stringify({ ui: { autostart: true } })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.ui.autostart).toBe(true);
    expect(config.ui.port).toBe(7337);
    expect(config.ui.open).toBe(true);
  });

  it("configPaths includes all expected locations", () => {
    const paths = configPaths(TEST_DIR);
    expect(paths.some((p) => p.includes(".open-agent-glossary"))).toBe(true);
    expect(paths.some((p) => p.includes(".agents"))).toBe(true);
    expect(paths.some((p) => p.includes(".pi"))).toBe(true);
    expect(paths.some((p) => p.includes(".config"))).toBe(true);
    expect(paths.some((p) => p.includes(join(".pi", "agent", "extensions", "open-agent-glossary")))).toBe(true);
  });
});
