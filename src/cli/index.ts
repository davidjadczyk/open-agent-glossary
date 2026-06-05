#!/usr/bin/env node
import { Command } from "commander";
import { injectCommand } from "./inject.js";
import { lookupCommand } from "./lookup.js";
import { addCommand } from "./add.js";
import { editCommand } from "./edit.js";
import { removeCommand } from "./remove.js";
import { listCommand } from "./list.js";
import { resetSessionCommand } from "./reset-session.js";
import { mcpServeCommand } from "./mcp-serve.js";
import { uiCommand } from "./ui.js";
import { initCommand } from "./init.js";

const program = new Command();

program
  .name("open-agent-glossary")
  .description("Tool-agnostic glossary management for coding agents")
  .version("0.1.0");

program
  .command("inject")
  .description("Match terms in prompt text, return injection context")
  .requiredOption("--prompt <text>", "Prompt text to match against")
  .option("--cwd <dir>", "Working directory")
  .action(injectCommand);

program
  .command("lookup")
  .description("Look up a single term definition")
  .argument("<term>", "Term to look up")
  .option("--cwd <dir>", "Working directory")
  .action(lookupCommand);

program
  .command("add")
  .description("Add a new term to the glossary")
  .argument("<term>", "Term name")
  .argument("<definition>", "Term definition")
  .option("--scope <scope>", "Target scope", "project")
  .option("--aliases <aliases>", "Comma-separated aliases")
  .option("--cwd <dir>", "Working directory")
  .action(addCommand);

program
  .command("edit")
  .description("Edit an existing term")
  .argument("<term>", "Term to edit")
  .option("--definition <definition>", "New definition")
  .option("--aliases <aliases>", "New comma-separated aliases")
  .option("--scope <scope>", "Target scope", "project")
  .option("--cwd <dir>", "Working directory")
  .action(editCommand);

program
  .command("remove")
  .description("Remove a term from the glossary")
  .argument("<term>", "Term to remove")
  .option("--scope <scope>", "Target scope", "project")
  .option("--cwd <dir>", "Working directory")
  .action(removeCommand);

program
  .command("list")
  .description("List all terms")
  .option("--scope <scope>", "Filter scope (global|project|merged)", "merged")
  .option("--cwd <dir>", "Working directory")
  .action(listCommand);

program
  .command("reset-session")
  .description("Clear session state")
  .action(resetSessionCommand);

program
  .command("mcp-serve")
  .description("Start MCP server on stdio")
  .option("--ui", "Also start the local UI control server")
  .option("--port <n>", "Control server port (with --ui)")
  .option("--open", "Open the browser (with --ui)")
  .action(mcpServeCommand);

program
  .command("init")
  .description("Scaffold a default config and empty glossary in the current directory")
  .option("--force", "Overwrite existing files")
  .option("--global", "Write to ~/.open-agent-glossary/ instead of ./.open-agent-glossary/")
  .option("--cwd <dir>", "Working directory")
  .action(initCommand);

program
  .command("ui")
  .description("Start the local glossary UI (control server + browser)")
  .option("--port <n>", "Control server port")
  .option("--no-open", "Do not open the browser")
  .option("--cwd <dir>", "Working directory")
  .action(uiCommand);

program.parse();
