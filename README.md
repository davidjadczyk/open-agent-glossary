# open-agent-glossary

Tool-agnostic glossary management for coding agents.

Define domain terms once in a `glossary.json` or `glossary.jsonl` file and use them from:

- **Pi** via extension
- **Claude Code** via hooks
- **Any MCP-capable agent** via stdio MCP server
- **CLI scripts** directly

The goal is **fast setup** and **one shared source of truth**.

---

## Why this package exists

Project acronyms and domain language drift fast:

- `FOO`
- `BAR`
- `ABC`
- `DEF`
- `GHI`

Agents either guess, ask again, or use the wrong meaning.

`open-agent-glossary` fixes that by loading glossary terms from local files and making them available to agents automatically or on demand.

---

## Install

### Global install

```bash
npm install -g open-agent-glossary
```

### No install, use with npx

```bash
npx open-agent-glossary --help
```

---

## 60-second setup

### 1) Create a project glossary

Put one of these in your repo:

- `.agents/glossary.json`
- `.agents/glossary.jsonl`
- `.pi/glossary.json`
- `.pi/glossary.jsonl`

Recommended for shared team glossaries:

- use **`.agents/glossary.jsonl`** if many people edit it often
- use **`.agents/glossary.json`** if you prefer simple JSON arrays

Example:

```json
[
  {
    "term": "PROJ.abc",
    "definition": "PROJ.abc is an internal platform for agentic AI use cases.",
    "aliases": ["PABC", "proj-abc", "Project ABC"]
  },
  {
    "term": "BFF",
    "definition": "Backend For Frontend is an architecture pattern designed to build dedicated backends for frontends.",
    "aliases": ["bff-pattern"]
  }
]
```

Or JSONL:

```json
{"term":"PROJ.abc","definition":"PROJ.abc is an internal platform for agentic AI use cases.","aliases":["PABC","proj-abc","Project ABC"]}
{"term":"BFF","definition":"Backend For Frontend is an architecture pattern designed to build dedicated backends for frontends.","aliases":["bff-pattern"]}
```

### 2) Pick your integration

#### Pi

```bash
pi install git:github.com/username/open-agent-glossary --path src/adapters/pi
```

#### Claude Code hook

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPrompt": [
      {
        "matcher": ".*",
        "command": "npx open-agent-glossary inject --prompt \"$USER_PROMPT\" --cwd \"$CWD\""
      }
    ]
  }
}
```

#### MCP

Add to your MCP config:

```json
{
  "mcpServers": {
    "glossary": {
      "command": "npx",
      "args": ["open-agent-glossary", "mcp-serve"]
    }
  }
}
```

That is enough to start.

---

## Fast setup by environment

## Pi

Pi is the closest to a native glossary experience.

### Install

```bash
pi install git:github.com/username/open-agent-glossary --path src/adapters/pi
```

### What you get

- automatic glossary injection
- matched term highlighting while typing
- footer status for loaded glossary info
- `glossary_lookup` tool
- `/glossary`
- `/glossary reload`

### When glossary files change

Pi keeps glossary entries in memory for the current session.

If your shared project glossary changes:

- run `/glossary reload`, or
- start a new Pi session

This is the only integration that does **not** re-read files on every turn, because the Pi adapter maintains UI state and highlighting.

---

## Claude Code hooks

This is the fastest passive setup outside Pi.

### Config

```json
{
  "hooks": {
    "UserPrompt": [
      {
        "matcher": ".*",
        "command": "npx open-agent-glossary inject --prompt \"$USER_PROMPT\" --cwd \"$CWD\""
      }
    ]
  }
}
```

### Behavior

On every prompt:

1. glossary files are loaded from disk
2. terms are matched against the prompt
3. matching definitions are returned to the agent as context

### When glossary files change

Nothing special required.

Because the hook runs the CLI on every prompt, changes to a shared project glossary are picked up automatically on the **next prompt**.

---

## MCP

Use MCP when:

- your agent supports MCP but not prompt hooks
- you want explicit tools for lookup/edit/list
- you want fresh file reads every tool call

### Config

```json
{
  "mcpServers": {
    "glossary": {
      "command": "npx",
      "args": ["open-agent-glossary", "mcp-serve"]
    }
  }
}
```

### Tools exposed

- `glossary_lookup`
- `glossary_list`
- `glossary_add`
- `glossary_edit`
- `glossary_remove`

### When glossary files change

Nothing special required.

The MCP server re-loads glossary files on each tool invocation, so changes in a shared project glossary are visible on the **next lookup/list call**.

---

## Shared project glossaries that change often

This is a first-class use case.

### Recommended setup

Put the team glossary in the repo at:

```text
.agents/glossary.jsonl
```

Why `.jsonl`?

- easier line-based diffs
- fewer merge conflicts
- easy to append entries
- better for frequently changing shared files

### Current behavior by integration

| Integration | Reload behavior |
|---|---|
| Pi | Loaded at session start; use `/glossary reload` after changes |
| Claude hook | Re-read on every prompt |
| MCP | Re-read on every tool call |
| CLI commands | Re-read on every command |

### Merge rules

Glossaries are layered and merged in this order:

1. `~/.pi/agent/glossary.json(.l)`
2. `~/.agents/glossary.json(.l)`
3. `.pi/glossary.json(.l)`
4. `.agents/glossary.json(.l)`

Later entries win on the same `term`.

So the normal pattern is:

- keep team/shared terms in `.agents/glossary.jsonl`
- keep personal/global terms in `~/.agents/glossary.json`
- let project terms override globals when needed

### Important rule

If both `.json` and `.jsonl` exist for the same path, loading fails with an error.

Pick one format per location.

---

## CLI quick reference

```bash
open-agent-glossary inject --prompt "what is BFF" --cwd .
open-agent-glossary lookup BFF --cwd .
open-agent-glossary list --cwd .
open-agent-glossary add "BFF" "Definition here" --scope project --cwd .
open-agent-glossary edit BFF --definition "Updated definition" --scope project --cwd .
open-agent-glossary remove BFF --scope project --cwd .
open-agent-glossary reset-session
open-agent-glossary mcp-serve
```

### Commands

| Command | Description |
|---|---|
| `inject --prompt <text>` | Match glossary terms and print injection text |
| `lookup <term>` | Look up one term |
| `list` | List loaded terms |
| `add <term> <definition>` | Add an entry |
| `edit <term>` | Edit an entry |
| `remove <term>` | Remove an entry |
| `reset-session` | Reset CLI hook session state |
| `mcp-serve` | Start MCP server on stdio |

---

## Glossary entry format

```json
{
  "term": "BFF",
  "definition": "Backend For Frontend ...",
  "aliases": ["BFF"],
  "pattern": "BFF",
  "flags": "iu",
  "enabled": true,
  "source": "shared-project-glossary"
}
```

| Field | Required | Description |
|---|---|---|
| `term` | yes | canonical handle |
| `definition` | yes | authoritative definition |
| `aliases` | no | extra plain-text triggers |
| `pattern` | no | explicit regex matcher |
| `flags` | no | regex flags, default `iu` |
| `enabled` | no | set `false` to disable |
| `source` | no | provenance label |

---

## Config

Optional config file locations:

- `.agents/open-agent-glossary/config.json`
- `~/.pi/open-agent-glossary/config.json`
- `~/.config/open-agent-glossary/config.json`

Example:

```json
{
  "sessionTtlMinutes": 30
}
```

This currently affects CLI/session dedup behavior used by hook-style flows.

---

## Compatibility

`open-agent-glossary` is schema-compatible with [`pi-glossary`](https://github.com/ruliana/pi-glossary).

That means existing `glossary.json` files can be reused unchanged.

---

## Repository integrations

Additional integration notes live here:

- `hooks/README.md`
- `hooks/github-copilot.md`

---

## License

MIT
