import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GlossaryConfig } from "../core/types.js";

interface InitOptions {
  cwd?: string;
  force?: boolean;
  global?: boolean;
}

const DEFAULT_CONFIG_CONTENT: GlossaryConfig = {
  glossaryMode: "merge",
  sessionTtlMinutes: 30,
  ui: {
    autostart: false,
    port: 7337,
    open: true,
  },
};

const DEFAULT_GLOSSARY_CONTENT = {
  _comment:
    "open-agent-glossary — add terms here and the agent will inject their definitions into context when matched.",
  entries: [] as unknown[],
};

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const dir = options.global
    ? join(process.env.HOME ?? "~", ".open-agent-glossary")
    : join(cwd, ".open-agent-glossary");

  const configPath = join(dir, "config.json");
  const glossaryPath = join(dir, "glossary.json");

  const configExists = existsSync(configPath);
  const glossaryExists = existsSync(glossaryPath);

  if (!options.force && (configExists || glossaryExists)) {
    const existing = [
      configExists && configPath,
      glossaryExists && glossaryPath,
    ]
      .filter(Boolean)
      .join("\n  ");
    process.stderr.write(
      `Already initialised — these files already exist:\n  ${existing}\n\nUse --force to overwrite.\n`
    );
    process.exit(1);
  }

  // Create directory if needed
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    process.stdout.write(`  created  ${dir}/\n`);
  }

  // Write config
  if (!configExists || options.force) {
    writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_CONFIG_CONTENT, null, 2) + "\n",
      "utf-8"
    );
    process.stdout.write(`  ${configExists ? "overwrote" : "created "} ${configPath}\n`);
  }

  // Write empty glossary
  if (!glossaryExists || options.force) {
    writeFileSync(
      glossaryPath,
      JSON.stringify(DEFAULT_GLOSSARY_CONTENT, null, 2) + "\n",
      "utf-8"
    );
    process.stdout.write(`  ${glossaryExists ? "overwrote" : "created "} ${glossaryPath}\n`);
  }

  process.stdout.write(`\nDone. Next steps:\n`);
  process.stdout.write(`  open-agent-glossary ui        # open the browser UI\n`);
  process.stdout.write(`  open-agent-glossary add <term> <definition>\n`);
}
