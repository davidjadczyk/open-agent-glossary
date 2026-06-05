import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { GlossaryConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

/**
 * Config resolution: first found wins (project-level beats global).
 *
 * Search order (highest priority first):
 *   Project-level:
 *     .open-agent-glossary/config.json
 *     .agents/open-agent-glossary/config.json
 *     .pi/open-agent-glossary/config.json
 *   Global user-level:
 *     ~/.open-agent-glossary/config.json
 *     ~/.agents/open-agent-glossary/config.json
 *     ~/.config/open-agent-glossary/config.json      (XDG standard)
 *     ~/.pi/agent/extensions/open-agent-glossary/config.json  (Pi global)
 */
export function configPaths(cwd?: string): string[] {
  const home = homedir();
  const projectDir = cwd ?? process.cwd();

  return [
    // Project-level (highest priority — checked first)
    join(projectDir, ".open-agent-glossary", "config.json"),
    join(projectDir, ".agents", "open-agent-glossary", "config.json"),
    join(projectDir, ".pi", "open-agent-glossary", "config.json"),
    // Global user-level (fallback)
    join(home, ".open-agent-glossary", "config.json"),
    join(home, ".agents", "open-agent-glossary", "config.json"),
    join(home, ".config", "open-agent-glossary", "config.json"),
    join(home, ".pi", "agent", "extensions", "open-agent-glossary", "config.json"),
  ];
}

/**
 * Load config from first found path, merged with defaults.
 */
export function loadConfig(cwd?: string): Required<GlossaryConfig> {
  const paths = configPaths(cwd);

  for (const configPath of paths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(content) as GlossaryConfig;
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          // ensure arrays are always arrays even if partially specified
          extraGlossaryPaths: parsed.extraGlossaryPaths ?? DEFAULT_CONFIG.extraGlossaryPaths,
        };
      } catch {
        // Invalid JSON — fall through to next path
        continue;
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Resolve extraGlossaryPaths relative to cwd.
 */
export function resolveExtraPaths(paths: string[], cwd?: string): string[] {
  const base = cwd ?? process.cwd();
  return paths.map((p) => (p.startsWith("/") ? p : resolve(base, p)));
}
