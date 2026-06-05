---
name: open-agent-glossary
description: >
  Use this skill when the user mentions a glossary term, project acronym, or domain-specific
  handle that may be defined in the project glossary. Automatically injects authoritative
  definitions into context when terms are matched. Also triggers on: "what is <term>",
  "look up <term>", "glossary lookup", "what does <acronym> mean", or when an unfamiliar
  project-specific word appears in the prompt.
license: MIT
metadata:
  author: open-agent-glossary
  version: "1.0"
---

# open-agent-glossary Skill

This skill activates when a glossary term, project acronym, or domain-specific handle is
referenced in the user's prompt. It injects authoritative definitions from the project
glossary so you can answer accurately without guessing.

## Behavior

- When you see an unfamiliar term that might be project-specific, use the `glossary_lookup`
  tool (if available via MCP) to retrieve its authoritative definition.
- At the start of a new conversation about a codebase, call `glossary_list` to load all
  known terms into context.
- Never guess what an acronym means. If unsure, look it up.
- Prefer the glossary definition over your own training knowledge when terms conflict.

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

## Glossary File Locations

Glossaries are layered and merged. Later tiers win on the same `term`:

1. `~/.pi/agent/glossary.json(.l)` — global user terms
2. `~/.agents/glossary.json(.l)` — global cross-tool terms
3. `.pi/glossary.json(.l)` — project terms (Pi-scoped)
4. `.agents/glossary.json(.l)` — project terms (tool-agnostic)

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
| `/glossary` | Show loaded glossary status |
| `/glossary reload` | Reload glossary files without restarting Pi |

## When to Trigger

- User asks "what is [TERM]?" or "what does [ACRONYM] stand for?"
- An unfamiliar project-specific abbreviation appears in the prompt
- Agent needs to reference a domain-specific concept that may have a project-local meaning
- User asks to add, update, or remove a glossary entry
