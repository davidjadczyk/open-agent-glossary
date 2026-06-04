import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../src/core/config.js";

const TEST_DIR = join(tmpdir(), "oag-test-config-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".agents", "open-agent-glossary"), { recursive: true });
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
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("loads project config", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({ sessionTtlMinutes: 60 })
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(60);
  });

  it("merges with defaults (partial config)", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      JSON.stringify({})
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(30);
  });

  it("skips invalid JSON gracefully", () => {
    writeFileSync(
      join(TEST_DIR, ".agents", "open-agent-glossary", "config.json"),
      "not valid json"
    );
    const config = loadConfig(TEST_DIR);
    expect(config.sessionTtlMinutes).toBe(30);
  });
});
