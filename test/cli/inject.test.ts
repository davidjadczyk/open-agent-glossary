import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const TEST_DIR = join(tmpdir(), "oag-test-cli-inject-" + Date.now());
const CLI = join(import.meta.dirname, "../../bin/cli.js");

function run(args: string[], cwd?: string): { stdout: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      cwd: cwd ?? TEST_DIR,
      encoding: "utf-8",
      env: { ...process.env, HOME: join(TEST_DIR, "_fakehome") },
    });
    return { stdout, code: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", code: err.status ?? 1 };
  }
}

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".agents"), { recursive: true });
  mkdirSync(join(TEST_DIR, "_fakehome"), { recursive: true });
  writeFileSync(
    join(TEST_DIR, ".agents", "glossary.json"),
    JSON.stringify([
      { term: "DRY", definition: "Don't Repeat Yourself", aliases: ["dont repeat yourself"] },
      { term: "KISS", definition: "Keep It Simple, Stupid" },
      { term: "YAGNI", definition: "You Aren't Gonna Need It" },
    ])
  );
  // Reset session before each test
  run(["reset-session"]);
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("CLI inject", () => {
  it("outputs matched terms", () => {
    const { stdout, code } = run(["inject", "--prompt", "Apply DRY here", "--cwd", TEST_DIR]);
    expect(code).toBe(0);
    expect(stdout).toContain("**DRY**");
    expect(stdout).toContain("Don't Repeat Yourself");
  });

  it("outputs nothing when no terms match", () => {
    const { stdout, code } = run(["inject", "--prompt", "Nothing relevant", "--cwd", TEST_DIR]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("matches multiple terms", () => {
    const { stdout, code } = run([
      "inject",
      "--prompt",
      "Apply DRY and KISS principles",
      "--cwd",
      TEST_DIR,
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("**DRY**");
    expect(stdout).toContain("**KISS**");
  });

  it("deduplicates across invocations (session)", () => {
    // First call injects DRY
    const first = run(["inject", "--prompt", "Apply DRY", "--cwd", TEST_DIR]);
    expect(first.stdout).toContain("**DRY**");

    // Second call with same term should not re-inject
    const second = run(["inject", "--prompt", "Apply DRY again", "--cwd", TEST_DIR]);
    expect(second.stdout.trim()).toBe("");
  });

  it("injects new terms on subsequent calls", () => {
    run(["inject", "--prompt", "Apply DRY", "--cwd", TEST_DIR]);
    const second = run(["inject", "--prompt", "Now use KISS too", "--cwd", TEST_DIR]);
    expect(second.stdout).toContain("**KISS**");
    expect(second.stdout).not.toContain("**DRY**");
  });

  it("matches by alias", () => {
    const { stdout } = run([
      "inject",
      "--prompt",
      "dont repeat yourself ever",
      "--cwd",
      TEST_DIR,
    ]);
    expect(stdout).toContain("**DRY**");
  });

  it("includes preamble only on first injection", () => {
    const first = run(["inject", "--prompt", "Apply DRY", "--cwd", TEST_DIR]);
    expect(first.stdout).toContain("glossary terms are relevant");

    const second = run(["inject", "--prompt", "Now KISS", "--cwd", TEST_DIR]);
    expect(second.stdout).not.toContain("glossary terms are relevant");
    expect(second.stdout).toContain("## Glossary");
  });

  it("reset-session allows re-injection", () => {
    run(["inject", "--prompt", "Apply DRY", "--cwd", TEST_DIR]);
    run(["reset-session"]);
    const after = run(["inject", "--prompt", "Apply DRY", "--cwd", TEST_DIR]);
    expect(after.stdout).toContain("**DRY**");
  });
});
