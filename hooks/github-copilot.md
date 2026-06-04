# GitHub Copilot Integration

## VS Code Copilot (Agent Mode)

VS Code Copilot agent mode supports **MCP servers only** (no hooks). 

### Setup MCP

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "glossary": {
      "command": "node",
      "args": ["/Users/username/Dev/open-agent-glossary/bin/cli.js", "mcp-serve"]
    }
  }
}
```

Then add `.github/copilot-instructions.md` to make Copilot use it proactively:

```markdown
## Glossary

This project uses a glossary for domain-specific terms. When the user mentions
an unfamiliar project term or acronym, use the `glossary_lookup` tool to get its
authoritative definition. At the start of a conversation, use `glossary_list` to
see all available terms.
```

---

## Copilot CLI (Terminal — supports hooks)

Copilot CLI supports both hooks and MCP.

### Setup Hook (auto-injection)

Create `.github/hooks/glossary.json` in your project:

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": "node /Users/username/Dev/open-agent-glossary/bin/cli.js inject --prompt \"${COPILOT_AGENT_PROMPT:-hello}\" --cwd \"$PWD\"",
        "timeoutSec": 5
      }
    ]
  }
}
```

> Note: `sessionStart` can return `additionalContext` to inject into the session.
> `userPromptSubmitted` is fire-and-forget (no output processed).

For the hook to inject context, create a wrapper script at `.github/hooks/glossary-inject.sh`:

```bash
#!/bin/bash
# Read the JSON input from stdin
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.prompt||j.initialPrompt||'')")
CWD=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.cwd||process.cwd())")

# Run glossary inject
CONTEXT=$(node /Users/username/Dev/open-agent-glossary/bin/cli.js inject --prompt "$PROMPT" --cwd "$CWD" 2>/dev/null)

# Output JSON with additionalContext if terms matched
if [ -n "$CONTEXT" ]; then
  node -e "console.log(JSON.stringify({additionalContext: process.argv[1]}))" "$CONTEXT"
fi
```

Then reference it:

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": ".github/hooks/glossary-inject.sh",
        "timeoutSec": 5
      }
    ]
  }
}
```

### Setup MCP (alongside hook)

Add to `.github/copilot/settings.json`:

```json
{
  "mcpServers": {
    "glossary": {
      "command": "node",
      "args": ["/Users/username/Dev/open-agent-glossary/bin/cli.js", "mcp-serve"]
    }
  }
}
```

---

## Copilot Cloud Agent (GitHub.com)

Cloud agent supports hooks from `.github/hooks/*.json` only.

Same hook setup as CLI above, but use absolute paths to the installed package
(or `npx open-agent-glossary` once published to npm).

---

## Summary

| Surface | MCP | Hooks | Auto-inject |
|---------|-----|-------|-------------|
| VS Code Copilot (agent mode) | ✅ | ❌ | Via instruction + `glossary_list` |
| Copilot CLI | ✅ | ✅ | `sessionStart` hook |
| Copilot Cloud Agent | ❌ | ✅ | `sessionStart` hook |
