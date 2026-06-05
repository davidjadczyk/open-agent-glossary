import { writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

/**
 * Resolve the per-user global state directory for open-agent-glossary.
 *
 * Defaults to `~/.open-agent-glossary/`. Overridable via the
 * `OAG_GLOBAL_DIR` environment variable (used by tests for isolation).
 */
export function globalDir(): string {
  const override = process.env.OAG_GLOBAL_DIR;
  if (override && override.trim()) return override;
  return join(homedir(), ".open-agent-glossary");
}

/** Absolute path to the usage tracking store. */
export function usageFilePath(): string {
  return join(globalDir(), "usages.json");
}

/** Absolute path to the project registry. */
export function projectRegistryPath(): string {
  return join(globalDir(), "projects.json");
}

/**
 * Atomically write JSON to a path: serialize to a `.tmp` sibling then
 * rename over the target so concurrent readers never observe a partial file.
 */
export function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  renameSync(tmpPath, filePath);
}
