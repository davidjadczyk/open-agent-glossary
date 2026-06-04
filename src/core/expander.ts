import { execSync } from "node:child_process";

/**
 * Expand shell templates in a string.
 * Replaces `{{command}}` with the stdout of running that command.
 * Example: "Current branch: {{git branch --show-current}}"
 */
export function expandTemplates(text: string, cwd?: string): string {
  return text.replace(/\{\{(.+?)\}\}/g, (_match, command: string) => {
    try {
      const result = execSync(command.trim(), {
        encoding: "utf-8",
        cwd: cwd ?? process.cwd(),
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return result.trim();
    } catch {
      return `{{${command.trim()}}}`;  // Leave as-is on failure
    }
  });
}

/**
 * Expand cross-references in a definition.
 * Replaces `[[term-name]]` with a hint to look up that term.
 */
export function expandCrossRefs(text: string): string {
  return text.replace(/\[\[(.+?)\]\]/g, (_match, term: string) => {
    return `${term.trim()} (see glossary)`;
  });
}

/**
 * Apply all expansions to a definition string.
 */
export function expandDefinition(definition: string, cwd?: string): string {
  let result = expandTemplates(definition, cwd);
  result = expandCrossRefs(result);
  return result;
}
