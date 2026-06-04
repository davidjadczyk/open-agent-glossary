# open-agent-glossary — Implementation Plan

> Tool-agnostic glossary management for coding agents.
> Manages `glossary.json` at global and project levels, interacts via CLI, MCP, or agent-specific adapters.

---

## Architecture Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Language | TypeScript-first |
| 2 | Merge strategy | Global first, project overrides on collision (same `term`) |
| 3 | Source of truth | Direct `glossary.json` files; MCP/hooks are just interfaces |
| 4 | Package topology | Shared core + thin adapters (Pi extension, hook CLI, MCP server) |
| 6 | Injection model | Context injection after user message, not prompt rewrite; dedupe per session |
| 7 | Concurrency | Optimistic locking for multi-adapter writes |
| 8 | Hook style | Claude Code-style hooks — CLI entrypoint invoked by hook config |
| 9 | MCP server | Bundled into core as subcommand (`npx open-agent-glossary mcp-serve`) |
| 10 | Package name | Unscoped `open-agent-glossary` on npm |
| 11 | Repo location | Standalone at `/Users/username/Dev/open-agent-glossary` |
| 12 | Pi adapter | Directory within this repo (not separate package) |
| 13 | Session dedup (hooks) | Lightweight session state file with TTL-based expiry |
| 14 | TTL default | 30 minutes, configurable |
| 15 | Config paths | Multi-path lookup (see below) |
| 16 | Glossary paths | Multi-path lookup with tier-based merge (see below) |

---

## File Lookup Paths

### Config Resolution (first found wins)

| Path | Scope |
|------|-------|
| `.agents/open-agent-glossary/config.json` | Project |
| `~/.pi/open-agent-glossary/config.json` | Global |
| `~/.config/open-agent-glossary/config.json` | Global |

### Glossary Resolution (layered merge, later tier wins)

**Global tier** (merged in order, later wins on collision):
1. `~/.pi/agent/glossary.json`
2. `~/.agents/glossary.json`

**Project tier** (overrides global, later wins on collision):
3. `.pi/glossary.json`
4. `.agents/glossary.json`

All paths also accept `.jsonl` variant. If both `.json` and `.jsonl` exist in the same scope/path, raise an error.

---

## Glossary Entry Schema (pi-glossary compatible)

```typescript
interface GlossaryEntry {
  term: string;          // Required — canonical handle
  definition: string;    // Required — injected when matched
  aliases?: string[];    // Additional plain-text triggers
  pattern?: string;      // Explicit regex (overrides default matcher)
  flags?: string;        // Regex flags (default: "iu")
  enabled?: boolean;     // Set false to disable
  source?: string;       // Provenance label
}
```

---

## Config Schema

```typescript
interface GlossaryConfig {
  sessionTtlMinutes?: number;  // Default: 30
  // Future: custom paths, logging, etc.
}
```

---

## Repo Structure

```
open-agent-glossary/
├── package.json                    # Root package, npm: open-agent-glossary
├── tsconfig.json
├── README.md
├── PLAN.md                         # This file
├── src/
│   ├── index.ts                    # Public API barrel
│   ├── core/
│   │   ├── types.ts                # GlossaryEntry, GlossaryConfig, SessionState
│   │   ├── loader.ts               # Multi-path discovery + layered merge
│   │   ├── matcher.ts              # Term/alias/regex matching against prompt text
│   │   ├── injector.ts             # Build injection payload (heading, preamble, dedupe)
│   │   ├── store.ts                # CRUD operations on glossary.json (optimistic locking)
│   │   ├── session.ts              # Session state: loaded terms, TTL expiry
│   │   └── config.ts               # Config resolution across paths
│   ├── cli/
│   │   ├── index.ts                # CLI entrypoint (commander/yargs)
│   │   ├── inject.ts               # `inject` command — match prompt, return context
│   │   ├── lookup.ts               # `lookup` command — single term lookup
│   │   ├── add.ts                  # `add` command — add term to glossary
│   │   ├── edit.ts                 # `edit` command — modify existing term
│   │   ├── remove.ts               # `remove` command — remove term
│   │   ├── list.ts                 # `list` command — show all terms
│   │   ├── reset-session.ts        # `reset-session` command
│   │   └── mcp-serve.ts            # `mcp-serve` command — start MCP server
│   ├── mcp/
│   │   ├── server.ts               # MCP server setup (stdio transport)
│   │   └── tools.ts                # MCP tool definitions (lookup, add, edit, remove, list)
│   └── adapters/
│       └── pi/
│           ├── index.ts            # Pi extension entry (registerTool, registerCommand, pi.on)
│           └── package.json        # Pi manifest: { "extensions": ["./index.ts"] }
├── hooks/
│   ├── claude-code.json            # Example Claude Code hook config
│   └── README.md                   # Hook setup instructions
├── test/
│   ├── core/
│   │   ├── loader.test.ts
│   │   ├── matcher.test.ts
│   │   ├── injector.test.ts
│   │   ├── store.test.ts
│   │   └── session.test.ts
│   ├── cli/
│   │   └── inject.test.ts
│   └── mcp/
│       └── tools.test.ts
└── examples/
    ├── glossary.json               # Example global glossary
    └── project-glossary.json       # Example project glossary
```

---

## Phase 1 — MVP (Core + CLI + Hooks + MCP)

### 1.1 Core Library

| Module | Responsibility |
|--------|---------------|
| `types.ts` | All shared types/interfaces |
| `loader.ts` | Discover glossary files across all paths, parse JSON/JSONL, validate entries, merge with tier precedence |
| `matcher.ts` | Build regex from term+aliases, match against prompt text, return matched entries |
| `injector.ts` | Given matched entries + session state → produce injection payload (preamble on first, heading + defs on subsequent, skip already-loaded) |
| `store.ts` | Read/write glossary.json with optimistic locking (content hash or mtime check), CRUD operations |
| `session.ts` | Read/write session state file (temp dir), TTL check, mark terms as loaded, reset |
| `config.ts` | Resolve config from multi-path, merge defaults |

### 1.2 CLI

```
npx open-agent-glossary <command> [options]

Commands:
  inject --prompt <text> [--cwd <dir>]   Match terms, return injection context (stdout)
  lookup <term> [--cwd <dir>]            Look up a single term definition
  add <term> <definition> [--scope global|project] [--cwd <dir>]
  edit <term> [--definition <d>] [--aliases <a,b>] [--scope global|project]
  remove <term> [--scope global|project] [--cwd <dir>]
  list [--scope global|project|merged] [--cwd <dir>]
  reset-session                          Clear session state
  mcp-serve                              Start MCP server on stdio
```

The `inject` command is the hook entrypoint:
1. Load glossary (all paths, merged)
2. Load session state
3. Match prompt against entries
4. Filter out already-loaded terms
5. Output injection text to stdout
6. Update session state with newly matched terms

Exit codes:
- `0` — terms matched, injection output on stdout
- `0` (empty stdout) — no new terms matched
- `1` — error (invalid glossary, missing files, etc.)

### 1.3 Claude Code Hook Integration

Example `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "command": "npx open-agent-glossary inject --prompt \"$PROMPT\" --cwd \"$CWD\""
      }
    ]
  }
}
```

> Note: Exact hook event and env variable names depend on CC's hook API. Document the mapping.

### 1.4 MCP Server

Tools exposed:
| Tool | Description |
|------|-------------|
| `glossary_lookup` | Look up a term by name, return definition |
| `glossary_list` | List all terms (with scope filter) |
| `glossary_add` | Add a new term (specify scope) |
| `glossary_edit` | Edit an existing term's fields |
| `glossary_remove` | Remove a term |

Transport: stdio (standard MCP pattern).

MCP config example (`.claude/mcp.json` or `.pi/mcp.json`):
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

---

## Phase 2 — Pi Extension Adapter

### 2.1 Pi Extension (`src/adapters/pi/`)

Thin wrapper that:
- Calls `core/loader` on `session_start`
- Calls `core/matcher` + `core/injector` on `before_agent_start`
- Registers `glossary_lookup` tool via `pi.registerTool()`
- Registers `/glossary` and `/glossary reload` commands
- Shows loaded terms in footer status

Install: `pi install git:github.com/you/open-agent-glossary --path src/adapters/pi`

### 2.2 JSONL Support

Already in schema/loader design. Implement parsing for `.jsonl` files in `loader.ts`.

---

## Phase 3 — Polish & Publish

### 3.1 Advanced Features
- Shell template expansion (`{{git branch --show-current}}`)
- Cross-references (`[[term-name]]` → `glossary_lookup` hint)
- Editor highlighting (Pi-specific, in adapter)

### 3.2 Config Discovery
- Full multi-path config resolution
- Validation and actionable error messages

### 3.3 Publishing
- npm publish as `open-agent-glossary`
- `pi install npm:open-agent-glossary` support (Pi manifest in adapter subpath)
- README with setup guides for each harness

---

## Optimistic Locking Strategy

```typescript
// On read:
const { content, hash } = readGlossaryWithHash(filePath);

// On write:
const currentHash = hashFile(filePath);
if (currentHash !== hash) {
  throw new ConflictError("Glossary modified externally. Reload and retry.");
}
writeGlossary(filePath, updatedContent);
```

Hash: SHA-256 of file content. Stored in memory during the CRUD operation lifecycle.

---

## Session State

File: `$TMPDIR/open-agent-glossary-session.json` (or OS temp dir)

```typescript
interface SessionState {
  loadedTerms: string[];      // Terms already injected
  lastUpdated: number;        // Unix timestamp (ms)
  cwd: string;                // Working directory (session boundary)
}
```

**Expiry logic:**
- If `Date.now() - lastUpdated > sessionTtlMinutes * 60_000` → reset state
- If `cwd` differs from current invocation → reset state (new project = new session)

---

## Dependencies (minimal)

| Package | Purpose |
|---------|---------|
| `commander` or `yargs` | CLI parsing |
| `@modelcontextprotocol/sdk` | MCP server |
| `@sinclair/typebox` | Schema validation (matches Pi ecosystem) |

Dev:
| Package | Purpose |
|---------|---------|
| `vitest` | Testing |
| `typescript` | Build |
| `tsup` or `unbuild` | Bundling |

Peer (Pi adapter only):
| Package | Purpose |
|---------|---------|
| `@some-scope/pi-coding-agent` | Pi extension types |

---

## Open Questions (deferred to execution)

- Exact Claude Code hook event names and environment variables available
- Whether `pi install --path` supports subdirectories or needs a workspace reference
- JSONL streaming parse vs full-file read (perf consideration for very large glossaries)
- Whether to support `glossary.yaml` in the future

---

## Success Criteria

- [ ] `npx open-agent-glossary inject --prompt "use EPER for this"` returns glossary context
- [ ] Claude Code hook injects terms without duplicates across turns
- [ ] MCP server allows lookup/add/edit/remove from any agent
- [ ] Pi adapter provides identical UX to `pi-glossary`
- [ ] Same `glossary.json` works unchanged across all harnesses
- [ ] Optimistic locking prevents silent overwrites
- [ ] Session TTL resets correctly after 30min inactivity
