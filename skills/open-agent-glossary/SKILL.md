---
name: open-agent-glossary
description: >
  Use this skill when the user mentions a glossary term, project acronym, or domain-specific
  handle that may be defined in the project glossary. Automatically injects authoritative
  definitions into context when terms are matched. Also triggers on: "what is <term>",
  "look up <term>", "glossary lookup", "what does <acronym> mean", when an unfamiliar
  project-specific word appears in the prompt, or when the user needs help setting up,
  configuring, or debugging the open-agent-glossary package.
license: MIT
metadata:
  author: open-agent-glossary
  version: "1.2"
---

# open-agent-glossary Skill

This skill activates when a glossary term, project acronym, or domain-specific handle is
referenced in the user's prompt, or when the user needs help configuring or troubleshooting
the `open-agent-glossary` package.

## Behavior

- When you see an unfamiliar term that might be project-specific, use the `glossary_lookup`
  tool (if available via MCP) to retrieve its authoritative definition.
- At the start of a new conversation about a codebase, call `glossary_list` to load all
  known terms into context.
- Never guess what an acronym means. If unsure, look it up.
- Prefer the glossary definition over your own training knowledge when terms conflict.

---

## Glossary Entry Format

```json
{
  "term": "BFF",
  "definition": "Backend For Frontend — a dedicated backend service tailored to a specific frontend.",
  "aliases": ["backend for frontend"],
  "pattern": "BFF|backend.?for.?frontend",
  "flags": "iu",
  "enabled": true,
  "source": "project-glossary"
}
```

| Field | Required | Description |
|---|---|---|
| `term` | yes | canonical handle |
| `definition` | yes | authoritative definition injected when matched |
| `aliases` | no | additional plain-text triggers |
| `pattern` | no | explicit regex — overrides the default matcher |
| `flags` | no | regex flags, default `iu` |
| `enabled` | no | set `false` to disable |
| `source` | no | provenance label (e.g. `"project-glossary"`) |

---

## Config File Locations

Config uses **first-found wins**. Project-level config always beats global.

### Project-level (highest priority, checked first):

| Path | Notes |
|---|---|
| `.open-agent-glossary/config.json` | pkg-scoped project config |
| `.agents/open-agent-glossary/config.json` | tool-agnostic project config (recommended for teams) |
| `.pi/open-agent-glossary/config.json` | Pi project-local config |

### Global user-level (fallback):

| Path | Notes |
|---|---|
| `~/.open-agent-glossary/config.json` | pkg-scoped global config |
| `~/.agents/open-agent-glossary/config.json` | tool-agnostic global config |
| `~/.config/open-agent-glossary/config.json` | XDG standard |
| `~/.pi/agent/extensions/open-agent-glossary/config.json` | Pi global (Pi users) |

### Recommended team setup:

```
repo/
  .agents/
    glossary.jsonl                          ← shared team glossary (commit this)
    open-agent-glossary/
      config.json                           ← shared config (commit this)
~/.agents/
  glossary.json                             ← personal global terms (never commit)
```

---

## Glossary File Locations

Glossaries are **layered and merged**. Later tiers win on the same `term`.

| Priority | Path | Tier |
|---|---|---|
| 1 (lowest) | `~/.pi/agent/glossary.json(.l)` | Global Pi |
| 2 | `~/.agents/glossary.json(.l)` | Global tool-agnostic |
| 3 | `~/.open-agent-glossary/glossary.json(.l)` | Global pkg-scoped |
| 4 | `.pi/glossary.json(.l)` | Project Pi |
| 5 | `.agents/glossary.json(.l)` | Project tool-agnostic ← recommended for teams |
| 6 | `.open-agent-glossary/glossary.json(.l)` | Project pkg-scoped |
| 7 (highest) | `config.extraGlossaryPaths[]` | User-defined extras |
| — | `config.glossaryPin` | Overrides all tiers when mode is `pin` |

---

## Config Schema

```json
{
  "sessionTtlMinutes": 30,
  "glossaryMode": "merge",
  "glossaryPin": "",
  "extraGlossaryPaths": [],
  "disableGlobalGlossary": false,
  "disableProjectGlossary": false,
  "ui": { "autostart": false, "port": 7337, "open": true }
}
```

| Field | Default | Description |
|---|---|---|
| `sessionTtlMinutes` | `30` | How long (minutes) before session state resets |
| `glossaryMode` | `"merge"` | `"merge"` / `"first"` / `"pin"` — see below |
| `glossaryPin` | `""` | Path to a single file; only used when mode is `"pin"` |
| `extraGlossaryPaths` | `[]` | Extra paths appended after all built-in tiers |
| `disableGlobalGlossary` | `false` | Skip all global user-level tiers (useful in CI) |
| `disableProjectGlossary` | `false` | Skip all project-level tiers |
| `ui.autostart` | `false` | Start the local UI control server when a session starts |
| `ui.port` | `7337` | Control server port |
| `ui.open` | `true` | Open the browser when the UI starts |

### Glossary Modes

**`merge`** (default) — all tiers are loaded and merged. Later tiers win on collision.
Use this for teams where each developer has personal global terms and the project has shared ones.

**`first`** — stops at the first glossary file found. Nothing else is loaded.
Use this in CI or scripts where personal global terms must not bleed in.

**`pin`** — loads only the file at `glossaryPin`. All discovery is skipped.
Use this in mono-repos where a specific shared glossary file must always be used.

```json
{
  "glossaryMode": "pin",
  "glossaryPin": "../../shared/glossary.jsonl"
}
```

---

## Available Tools (via MCP)

| Tool | Description |
|---|---|
| `glossary_lookup` | Look up a single term by name or alias |
| `glossary_list` | List all loaded terms |
| `glossary_add` | Add a new entry |
| `glossary_edit` | Edit an existing entry |
| `glossary_remove` | Remove an entry |

## Commands (Pi only)

| Command | Description |
|---|---|
| `/glossary` | Show loaded glossary status and sources |
| `/glossary reload` | Reload glossary files without restarting Pi |

---

## Local UI

A local web UI is served by an embedded hono control server bound to
`127.0.0.1` only.

| Command | Description |
|---|---|
| `open-agent-glossary ui` | Start the control server + UI and open the browser |
| `open-agent-glossary ui --port 4319` | Start the UI on a custom port |
| `open-agent-glossary ui --no-open` | Start the UI without opening a browser |
| `open-agent-glossary mcp-serve --ui` | Run the UI alongside the MCP server |

### UI screens

- **Overview** — discovery, merge order, current session, top-level metrics
- **Glossary** — searchable entries browser, add/edit/delete, pattern tester
- **Usage** — timeline, top terms, all-time vs session analytics
- **Config** — config resolution stack and effective values with inline editing

Set `ui.autostart: true` in config to boot it automatically on session start.

### Recommended bootstrap flow

For a new project:

```bash
open-agent-glossary init
open-agent-glossary ui
```

`init` creates:

```text
.open-agent-glossary/
  config.json
  glossary.json
```

So the user gets a default config plus an empty glossary immediately.

Global state lives under `~/.open-agent-glossary/`:

| File | Purpose |
|---|---|
| `usages.json` | Usage tracking (per-term / per-session / global totals) |
| `projects.json` | Registry of project roots (powers "glossaries on this computer") |
| `config.json` | Optional package-scoped global config |
| `glossary.json` | Optional package-scoped global glossary |

### UI troubleshooting

- **Port already in use** — pass `--port <n>` or set `ui.port` in config.
- **UI not available** — run `open-agent-glossary ui`; it serves the local browser UI from the package.
- **UI did not autostart** — confirm `ui.autostart` is `true` in a config file the project resolves (see Config File Locations).

---

## Init command

Use `open-agent-glossary init` to scaffold a default setup.

| Command | Description |
|---|---|
| `open-agent-glossary init` | Create `.open-agent-glossary/config.json` and empty `.open-agent-glossary/glossary.json` |
| `open-agent-glossary init --force` | Overwrite an existing scaffold |
| `open-agent-glossary init --global` | Initialize `~/.open-agent-glossary/` instead of the project |

This command is the recommended starting point for fresh repos.

## Troubleshooting

### Terms are not being injected

1. Check that a glossary file exists at one of the tier paths above.
2. Run `open-agent-glossary list --cwd .` in your project directory to see what is loaded.
3. If nothing loads, run `open-agent-glossary inject --prompt "test" --cwd .` and check stderr for errors.
4. Verify the file is valid JSON / JSONL with correct `term` and `definition` fields.

### Wrong definition is being used (collision)

Later tiers win. Check your tier priority:
- A `.agents/glossary.jsonl` entry will override a `.pi/glossary.json` entry with the same term.
- An `extraGlossaryPaths` entry will override all built-in tiers.
- If using `pin` mode, only the pinned file is loaded — all others are ignored.

### Config file is not being picked up

Run `open-agent-glossary list --cwd .` and check which config was loaded.
Ensure your config file is at one of the expected paths and contains valid JSON.
Project-level paths are always checked before global paths.

### Personal terms appearing in CI

Set `disableGlobalGlossary: true` in the project config at `.agents/open-agent-glossary/config.json`:

```json
{
  "disableGlobalGlossary": true
}
```

### Pi: glossary not updating after file change

Run `/glossary reload` in your Pi session. Pi loads glossary entries into memory at session start — unlike Claude Code hooks and MCP, it does not re-read files on every turn.

### Both `.json` and `.jsonl` exist at the same path

This is an error. Remove one. You cannot have both `glossary.json` and `glossary.jsonl` at the same location.

### `glossaryMode: pin` throws "no glossaryPin path is set"

You set `glossaryMode` to `"pin"` but forgot to also set `glossaryPin`. Add the path:

```json
{
  "glossaryMode": "pin",
  "glossaryPin": "./path/to/your/glossary.json"
}
```
