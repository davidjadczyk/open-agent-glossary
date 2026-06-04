import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GlossaryConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

/**
 * Config resolution paths (first found wins).
 */
function configPaths(cwd?: string): string[] {
  const home = homedir();
  const projectDir = cwd ?? process.cwd();

  return [
    join(projectDir, ".agents", "open-agent-glossary", "config.json"),
    join(home, ".pi", "open-agent-glossary", "config.json"),
    join(home, ".config", "open-agent-glossary", "config.json"),
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
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch {
        // Invalid config, fall through to next
        continue;
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}
