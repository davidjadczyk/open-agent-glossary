# Hook Integration

## Claude Code

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPrompt": [
      {
        "matcher": ".*",
        "command": "npx open-agent-glossary inject --prompt \"$USER_PROMPT\""
      }
    ]
  }
}
```

The `inject` command:
1. Loads all glossary files (global + project, merged)
2. Loads session state (tracks already-injected terms)
3. Matches the prompt text against glossary entries
4. Outputs injection text to stdout (only new/unseen terms)
5. Updates session state

**Exit codes:**
- `0` with output → terms matched, inject the stdout content
- `0` with empty stdout → no new terms to inject
- `1` → error (logged to stderr)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `$USER_PROMPT` | The user's prompt text (provided by Claude Code) |
| `$CWD` | Current working directory (if available) |

## Session Behavior

- Terms are only injected once per session (30-minute TTL by default)
- Changing project directory resets the session
- Use `npx open-agent-glossary reset-session` to manually clear

## Other Agent Harnesses

For any agent that supports shell-based hooks:

```bash
# Match and inject
npx open-agent-glossary inject --prompt "your prompt text" --cwd /path/to/project
```

For MCP-compatible agents:

```json
{
  "mcpServers": {
    "glossary": {
      "command": "npx",
      "args": ["open-agent-glossary", "mcp-serve"],
      "transport": "stdio"
    }
  }
}
```
