import { removeTerm } from "../core/store.js";

interface RemoveOptions {
  scope?: string;
  cwd?: string;
}

export function removeCommand(term: string, options: RemoveOptions): void {
  try {
    const scope = (options.scope ?? "project") as "global" | "project";
    const cwd = options.cwd ?? process.cwd();

    removeTerm(scope, term, cwd);
    console.log(`Removed '${term}' from ${scope} glossary.`);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
