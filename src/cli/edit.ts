import { editTerm } from "../core/store.js";

interface EditOptions {
  definition?: string;
  aliases?: string;
  scope?: string;
  cwd?: string;
}

export function editCommand(term: string, options: EditOptions): void {
  try {
    const scope = (options.scope ?? "project") as "global" | "project";
    const cwd = options.cwd ?? process.cwd();
    const updates: Record<string, unknown> = {};

    if (options.definition) updates.definition = options.definition;
    if (options.aliases) {
      updates.aliases = options.aliases.split(",").map((a) => a.trim());
    }

    if (Object.keys(updates).length === 0) {
      process.stderr.write("No updates specified.\n");
      process.exit(1);
    }

    editTerm(scope, term, updates, cwd);
    console.log(`Updated '${term}' in ${scope} glossary.`);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
