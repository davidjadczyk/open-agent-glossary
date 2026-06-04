import { loadGlossary, loadGlossaryByScope } from "../core/loader.js";

interface ListOptions {
  scope?: string;
  cwd?: string;
}

export function listCommand(options: ListOptions): void {
  try {
    const scope = options.scope ?? "merged";
    const cwd = options.cwd ?? process.cwd();

    const glossary =
      scope === "merged"
        ? loadGlossary(cwd)
        : loadGlossaryByScope(scope as "global" | "project", cwd);

    if (glossary.entries.length === 0) {
      console.log("No glossary entries found.");
      return;
    }

    console.log(`Terms (${scope}, ${glossary.entries.length} entries):\n`);
    for (const entry of glossary.entries) {
      const aliases = entry.aliases?.length
        ? ` [aliases: ${entry.aliases.join(", ")}]`
        : "";
      console.log(`  ${entry.term}${aliases}`);
      console.log(`    ${entry.definition}`);
      console.log();
    }

    if (glossary.sources.length > 0) {
      console.log(`Sources: ${glossary.sources.join(", ")}`);
    }
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
