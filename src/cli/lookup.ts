import { loadGlossary } from "../core/loader.js";

interface LookupOptions {
  cwd?: string;
}

export function lookupCommand(term: string, options: LookupOptions): void {
  try {
    const cwd = options.cwd ?? process.cwd();
    const glossary = loadGlossary(cwd);
    const entry = glossary.entries.find(
      (e) => e.term.toLowerCase() === term.toLowerCase()
    );

    if (!entry) {
      process.stderr.write(`Term '${term}' not found.\n`);
      process.exit(1);
    }

    console.log(JSON.stringify(entry, null, 2));
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
