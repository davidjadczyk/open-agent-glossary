# AGENTS.md

## Project Goal

`open-agent-glossary` gives coding agents a shared, authoritative glossary without injecting every definition on every turn.

It supports the same glossary data across four surfaces:
- CLI
- MCP server
- Pi extension
- local browser UI

Treat the glossary files as the source of truth. Adapters should stay thin.

## Dual Package Structure

This repo ships **two npm packages** from one codebase:

| Package | Path | Purpose |
|---|---|---|
| `open-agent-glossary` | repo root | core library, CLI, MCP server, control server, bundled Pi adapter |
| `open-agent-glossary-ui` | `ui/` | React/Vite frontend served by the control server |

Key rules:
- Keep **versions in lockstep** between root `package.json` and `ui/package.json`.
- The root package is the product entrypoint; the UI is a separately published companion.
- The root package declares `ui` as a workspace, but the UI is also published independently.
- The control server in `src/server/control.ts` serves prebuilt UI assets when the UI package is installed.
- Publish order matters: **UI first, core package second**.

## Setup Heuristic

- Work from the **repo root** by default.
- Only switch to `ui/` when changing React/Vite frontend code.
- Put product/user-facing documentation in `docs/`.
- Put static assets and images in `assets/`.
- Put scratch notes, plans, and implementation docs in `docs/dev/`.
- Treat `docs/dev/` as local development documentation only; it is gitignored.
- Change source files, not generated artifacts.

Do not edit generated outputs directly:
- `dist/`
- `src/adapters/pi/dist/`
- `ui/dist/`

## Commands (verified)

| Command | Purpose |
|---|---|
| `npm run typecheck` | Type-check root package |
| `npm test` | Run Vitest suite for core, CLI, MCP, and server |
| `npm run build` | Build root library, CLI, and Pi adapter dist |
| `npm --prefix ui run build` | Build the UI package |

## File Map

| Path | Purpose |
|---|---|
| `src/core/` | glossary loading, matching, config, session, usage, storage |
| `src/cli/` | thin CLI command handlers |
| `src/mcp/` | MCP server and tool definitions |
| `src/server/control.ts` | local HTTP control server + API + UI serving |
| `src/adapters/pi/` | Pi extension adapter |
| `ui/src/` | React UI app |
| `docs/` | committed project documentation |
| `assets/` | committed images and static documentation assets |
| `docs/dev/` | local gitignored plans, redesign notes, and implementation scratch docs |
| `hooks/` | example agent-hook integrations |
| `skills/open-agent-glossary/SKILL.md` | Pi skill for using this package |
| `.github/workflows/publish.yml` | trusted publishing pipeline |
| `scripts/release.mjs` | version bump + tag + release helper |

## Golden Samples

| Need | Reference |
|---|---|
| public API exports | `src/index.ts` |
| CLI command shape | `src/cli/index.ts` |
| thin adapter over core logic | `src/adapters/pi/index.ts` |
| control server + API composition | `src/server/control.ts` |
| app shell / navigation | `ui/src/App.tsx` |

## Heuristics

| When | Do |
|---|---|
| changing glossary behavior | update `src/core/` first, then adapters/tests |
| changing CLI behavior | keep command parsing in `src/cli/index.ts`, logic in command modules |
| changing Pi integration | preserve parity with documented glossary UX |
| changing UI behavior | prefer `ui/src/` only; do not couple React code into root package |
| changing release flow | update both root and `ui/` versioning/publish assumptions |
| adding docs | use `docs/` for committed docs, `assets/` for images, `docs/dev/` for local planning material |

## Boundaries

### Always
- preserve schema/tool-agnostic behavior
- keep adapters thin and delegate to core
- keep root and UI package versions aligned
- add or update tests for behavior changes
- keep docs in `docs/`, assets in `assets/`, and local dev docs in `docs/dev/`

### Ask First
- changing glossary file precedence or merge semantics
- changing CLI command names or MCP tool names
- changing publish order or package names
- changing the docs/assets/dev-docs directory convention

### Never
- edit generated `dist` files as source of truth
- move UI-only code into core runtime paths without clear need
- make the Pi adapter the place where core glossary logic lives
- commit scratch plans or redesign notes outside `docs/dev/`
