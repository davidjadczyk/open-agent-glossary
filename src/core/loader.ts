import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import type { GlossaryEntry, GlossaryFile, LoadedGlossary } from "./types.js";

/**
 * Resolve all glossary file paths (global + project tiers).
 * Global tier: merged in order, later wins on collision.
 * Project tier: overrides global, later wins on collision.
 */
export function resolveGlossaryPaths(cwd?: string): {
  global: string[];
  project: string[];
} {
  const home = homedir();
  const projectDir = cwd ?? process.cwd();

  const globalPaths = [
    join(home, ".pi", "agent", "glossary"),
    join(home, ".agents", "glossary"),
  ];

  const projectPaths = [
    join(projectDir, ".pi", "glossary"),
    join(projectDir, ".agents", "glossary"),
  ];

  return { global: globalPaths, project: projectPaths };
}

/**
 * Find existing glossary files at a base path (checks .json and .jsonl).
 * Throws if both exist at the same path.
 */
export function findGlossaryFile(basePath: string): string | null {
  const jsonPath = basePath + ".json";
  const jsonlPath = basePath + ".jsonl";
  const jsonExists = existsSync(jsonPath);
  const jsonlExists = existsSync(jsonlPath);

  if (jsonExists && jsonlExists) {
    throw new Error(
      `Conflict: both ${jsonPath} and ${jsonlPath} exist. Remove one.`
    );
  }

  if (jsonExists) return jsonPath;
  if (jsonlExists) return jsonlPath;
  return null;
}

/**
 * Parse a glossary file (JSON array or JSONL).
 */
export function parseGlossaryFile(filePath: string): GlossaryFile {
  const content = readFileSync(filePath, "utf-8");
  const hash = createHash("sha256").update(content).digest("hex");

  let entries: GlossaryEntry[];

  if (filePath.endsWith(".jsonl")) {
    entries = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line, i) => {
        try {
          return JSON.parse(line) as GlossaryEntry;
        } catch {
          throw new Error(
            `Invalid JSONL at ${filePath}:${i + 1}: ${line.slice(0, 50)}`
          );
        }
      });
  } else {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error(`${filePath}: expected JSON array of glossary entries`);
    }
    entries = parsed as GlossaryEntry[];
  }

  // Validate entries
  for (const entry of entries) {
    if (!entry.term || typeof entry.term !== "string") {
      throw new Error(`${filePath}: entry missing required 'term' field`);
    }
    if (!entry.definition || typeof entry.definition !== "string") {
      throw new Error(
        `${filePath}: entry '${entry.term}' missing required 'definition' field`
      );
    }
  }

  return { path: filePath, entries, hash };
}

/**
 * Load and merge all glossary files.
 * Later tiers override earlier on term collision.
 */
export function loadGlossary(cwd?: string): LoadedGlossary {
  const paths = resolveGlossaryPaths(cwd);
  const allPaths = [...paths.global, ...paths.project];
  const sources: string[] = [];
  const termMap = new Map<string, GlossaryEntry>();

  for (const basePath of allPaths) {
    const filePath = findGlossaryFile(basePath);
    if (!filePath) continue;

    const glossaryFile = parseGlossaryFile(filePath);
    sources.push(filePath);

    for (const entry of glossaryFile.entries) {
      if (entry.enabled === false) continue;
      termMap.set(entry.term.toLowerCase(), entry);
    }
  }

  return {
    entries: Array.from(termMap.values()),
    sources,
  };
}

/**
 * Load glossary from a specific scope only.
 */
export function loadGlossaryByScope(
  scope: "global" | "project",
  cwd?: string
): LoadedGlossary {
  const paths = resolveGlossaryPaths(cwd);
  const scopePaths = scope === "global" ? paths.global : paths.project;
  const sources: string[] = [];
  const termMap = new Map<string, GlossaryEntry>();

  for (const basePath of scopePaths) {
    const filePath = findGlossaryFile(basePath);
    if (!filePath) continue;

    const glossaryFile = parseGlossaryFile(filePath);
    sources.push(filePath);

    for (const entry of glossaryFile.entries) {
      if (entry.enabled === false) continue;
      termMap.set(entry.term.toLowerCase(), entry);
    }
  }

  return {
    entries: Array.from(termMap.values()),
    sources,
  };
}
