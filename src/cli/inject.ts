import { loadGlossary } from "../core/loader.js";
import { matchEntries } from "../core/matcher.js";
import { buildInjection } from "../core/injector.js";
import { loadSession, markTermsLoaded } from "../core/session.js";
import { loadConfig } from "../core/config.js";
import { recordUsage, flushUsage } from "../core/usage.js";

interface InjectOptions {
  prompt: string;
  cwd?: string;
}

export function injectCommand(options: InjectOptions): void {
  try {
    const cwd = options.cwd ?? process.cwd();
    const config = loadConfig(cwd);
    const glossary = loadGlossary(cwd);

    if (glossary.entries.length === 0) {
      // No glossary entries, nothing to inject
      process.exit(0);
    }

    const session = loadSession(cwd, config);
    const matches = matchEntries(options.prompt, glossary.entries);

    if (matches.length === 0) {
      process.exit(0);
    }

    const injection = buildInjection(matches, session, cwd);

    if (injection.text) {
      process.stdout.write(injection.text + "\n");
      markTermsLoaded(session, injection.newTerms);
      if (injection.newTerms.length > 0) {
        recordUsage("injection", injection.newTerms, session.sessionId, cwd);
        flushUsage();
      }
    }

    process.exit(0);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}
