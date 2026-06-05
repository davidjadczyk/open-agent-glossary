import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadGlossary, loadGlossaryByScope } from "../core/loader.js";
import { addTerm, editTerm, removeTerm } from "../core/store.js";
import { loadSession } from "../core/session.js";
import { recordUsage } from "../core/usage.js";

export function registerTools(server: McpServer): void {
  server.tool(
    "glossary_lookup",
    "Look up a glossary term by name",
    { term: z.string().describe("Term to look up") },
    async ({ term }) => {
      const glossary = loadGlossary();
      const entry = glossary.entries.find(
        (e) => e.term.toLowerCase() === term.toLowerCase()
      );
      if (!entry) {
        return { content: [{ type: "text", text: `Term '${term}' not found.` }] };
      }
      try {
        const session = loadSession();
        recordUsage("lookup", [entry.term], session.sessionId, session.cwd);
      } catch {
        // Usage tracking is best-effort; never block a lookup.
      }
      return {
        content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
      };
    }
  );

  server.tool(
    "glossary_list",
    "List all glossary terms",
    {
      scope: z
        .enum(["global", "project", "merged"])
        .optional()
        .describe("Scope filter"),
    },
    async ({ scope }) => {
      const s = scope ?? "merged";
      const glossary =
        s === "merged"
          ? loadGlossary()
          : loadGlossaryByScope(s as "global" | "project");

      if (glossary.entries.length === 0) {
        return { content: [{ type: "text", text: "No glossary entries found." }] };
      }

      const lines = glossary.entries.map(
        (e) =>
          `- **${e.term}**: ${e.definition}${e.aliases?.length ? ` [aliases: ${e.aliases.join(", ")}]` : ""}`
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "glossary_add",
    "Add a new term to the glossary",
    {
      term: z.string().describe("Term name"),
      definition: z.string().describe("Term definition"),
      scope: z
        .enum(["global", "project"])
        .optional()
        .describe("Target scope (default: project)"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternative triggers"),
    },
    async ({ term, definition, scope, aliases }) => {
      try {
        addTerm(scope ?? "project", { term, definition, aliases });
        return {
          content: [
            { type: "text", text: `Added '${term}' to ${scope ?? "project"} glossary.` },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
          ],
        };
      }
    }
  );

  server.tool(
    "glossary_edit",
    "Edit an existing glossary term",
    {
      term: z.string().describe("Term to edit"),
      definition: z.string().optional().describe("New definition"),
      aliases: z.array(z.string()).optional().describe("New aliases"),
      scope: z
        .enum(["global", "project"])
        .optional()
        .describe("Target scope (default: project)"),
    },
    async ({ term, definition, aliases, scope }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (definition) updates.definition = definition;
        if (aliases) updates.aliases = aliases;
        editTerm(scope ?? "project", term, updates);
        return {
          content: [
            { type: "text", text: `Updated '${term}' in ${scope ?? "project"} glossary.` },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
          ],
        };
      }
    }
  );

  server.tool(
    "glossary_remove",
    "Remove a term from the glossary",
    {
      term: z.string().describe("Term to remove"),
      scope: z
        .enum(["global", "project"])
        .optional()
        .describe("Target scope (default: project)"),
    },
    async ({ term, scope }) => {
      try {
        removeTerm(scope ?? "project", term);
        return {
          content: [
            { type: "text", text: `Removed '${term}' from ${scope ?? "project"} glossary.` },
          ],
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
          ],
        };
      }
    }
  );
}
