import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  resolveGlossaryPaths,
  findGlossaryFile,
  parseGlossaryFile,
} from "./loader.js";
import { projectRegistryPath, atomicWriteJson } from "./paths.js";

export interface DiscoveredFile {
  path: string;
  format: "json" | "jsonl";
  scope: "global" | "project";
  tier: string; // human label, e.g. "~/.agents/glossary"
  entryCount: number;
  exists: boolean;
}

export interface ProjectGlossaries {
  root: string;
  lastSeen: number;
  files: DiscoveredFile[];
}

export interface DiscoveryResult {
  global: DiscoveredFile[];
  projects: ProjectGlossaries[];
}

export interface ProjectRegistry {
  version: 1;
  projects: Array<{ root: string; lastSeen: number }>;
}

/** Replace an absolute home-prefixed path with a `~`-relative label. */
function tierLabel(basePath: string): string {
  const home = homedir();
  return basePath.startsWith(home) ? "~" + basePath.slice(home.length) : basePath;
}

/**
 * Inspect a base path (no extension) and report the discovered glossary file.
 * Returns null when neither `.json` nor `.jsonl` exists.
 */
function inspectBasePath(
  basePath: string,
  scope: "global" | "project"
): DiscoveredFile | null {
  let filePath: string | null;
  try {
    filePath = findGlossaryFile(basePath);
  } catch {
    // Conflict (both .json and .jsonl) — skip rather than throw.
    return null;
  }
  if (!filePath) return null;

  let entryCount = 0;
  try {
    entryCount = parseGlossaryFile(filePath).entries.length;
  } catch {
    entryCount = 0;
  }

  return {
    path: filePath,
    format: filePath.endsWith(".jsonl") ? "jsonl" : "json",
    scope,
    tier: tierLabel(basePath),
    entryCount,
    exists: true,
  };
}

/**
 * Discover all glossary files known to this machine: the global tiers plus
 * every project-tier file for roots in the registry.
 */
export function discoverGlossaries(): DiscoveryResult {
  // Use a neutral cwd so project tiers don't leak into the global enumeration.
  const globalBases = resolveGlossaryPaths(homedir()).global;
  const global: DiscoveredFile[] = [];
  for (const base of globalBases) {
    const file = inspectBasePath(base, "global");
    if (file) global.push(file);
  }

  const registry = readProjectRegistry();
  const projects: ProjectGlossaries[] = [];
  for (const { root, lastSeen } of registry.projects) {
    const projectBases = resolveGlossaryPaths(root).project;
    const files: DiscoveredFile[] = [];
    for (const base of projectBases) {
      const file = inspectBasePath(base, "project");
      if (file) files.push(file);
    }
    projects.push({ root, lastSeen, files });
  }

  return { global, projects };
}

/** Read the project registry, tolerating missing/corrupt files. */
export function readProjectRegistry(): ProjectRegistry {
  const path = projectRegistryPath();
  if (!existsSync(path)) return { version: 1, projects: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as ProjectRegistry;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return { version: 1, projects: [] };
    }
    return parsed;
  } catch {
    return { version: 1, projects: [] };
  }
}

/**
 * Upsert a project root into the registry, refreshing its `lastSeen`.
 * Deduplicated by root. Most-recently-seen first.
 */
export function registerProject(cwd: string): void {
  const registry = readProjectRegistry();
  const now = Date.now();
  const filtered = registry.projects.filter((p) => p.root !== cwd);
  filtered.unshift({ root: cwd, lastSeen: now });
  atomicWriteJson(projectRegistryPath(), {
    version: 1,
    projects: filtered,
  } satisfies ProjectRegistry);
}
