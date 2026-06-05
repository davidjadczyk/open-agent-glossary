# UI Redesign Draft — open-agent-glossary

> Status: **DRAFT for review.** No code yet. This proposes the full new layout,
> theming, data-model clarifications, and the screens. Decisions marked **[Q]**
> need your confirmation before implementation.

---

## 1. Goals

1. **Modern, dev-focused look** — dense, keyboard-friendly, monospace where it
   matters, subtle depth, a real accent color.
2. **Dark mode + light mode** — first-class, system-aware, toggleable, persisted.
3. **Config editing in the UI** — view the resolved config, see *which file each
   value comes from*, and edit + write back safely.
4. **Richer usage analytics** — beyond one bar chart: split, treemap, scatter,
   session activity.
5. **Expose the full entry model** — `pattern` (regex) with a live tester,
   `enabled` toggle, and a *disambiguated* notion of "source" and "scope".
6. **Hierarchy made visible** — trees for the glossary tier stack and the config
   resolution stack, so you understand *why* a value/term wins.

---

## 2. The "source" and "scope" disambiguation (the important part)

Today both words are overloaded. The redesign splits each into two distinct,
clearly-named concepts.

### 2.1 "source" → split into **Defined-in** vs **Reference**

| Concept | Meaning | Where it lives | UI label |
|---|---|---|---|
| **Defined-in** (provenance) | *Which glossary file/tier* the entry was loaded & merged from (e.g. `.agents/glossary.json`, global tier 3). Computed at load time. | Not stored on the entry — derived by the loader. | **"Defined in"** + tier badge |
| **Reference** (source of truth) | *Where the human knowledge came from*: an internal wiki page, an RFC, a Confluence link, a person. Optional, may be a URL. | The entry's existing `source` field (pi-glossary compatible). | **"Reference"** (clickable if URL) |

So `entry.source` keeps its schema slot but is now *clearly* the external
reference. The file provenance becomes a computed `definedIn` annotation the API
already half-produces (`sourcePath` + `scope` + `tier`).

**[Q1]** Should `Reference` support **multiple** references (array) and a
structured shape `{ label, url }`, or stay a single free string for pi-glossary
compatibility? Proposed: accept both — `source: string` *or*
`source: { label, url } | Array<...>`, normalize in the UI. Backward compatible.

### 2.2 "scope" → split into **Location** vs **Domains**

| Concept | Meaning | Where it lives | UI label |
|---|---|---|---|
| **Location** (storage tier) | global vs project, and the exact file. Determines merge precedence. | Computed by loader (already exists as `scope`). | **"Location"** (Global / Project) |
| **Tags** (semantic scope) | *Which projects / teams / bounded contexts* a term belongs to — e.g. `["payments", "checkout"]`. Free-form tags. | **NEW** optional field `tags?: string[]` (LOCKED: was "domains"). | **"Tags"** chips |

This lets one global glossary hold terms tagged by domain, and the UI can filter
/ group / color by domain without affecting where the file physically lives.

**[Q2]** Field name for semantic scope: `domains` (proposed) vs `tags` vs
`contexts`. `domains` reads best for DDD-style teams; `tags` is more generic.

### 2.3 Resulting entry model

```ts
interface GlossaryEntry {
  term: string;
  definition: string;
  aliases?: string[];
  pattern?: string;          // regex — now editable + testable in UI
  flags?: string;            // regex flags
  enabled?: boolean;         // now a visible toggle
  source?: string | Reference | Reference[];   // EXTERNAL reference (clarified)
  domains?: string[];        // NEW semantic scope
}

interface Reference { label: string; url?: string }

// Computed at load time, never persisted on the entry:
interface EntryAnnotation {
  definedIn: { path: string; tier: string; location: "global" | "project" };
  overriddenBy?: string[];   // higher-tier files that shadow this term
}
```

---

## 3. Theming — dark / light

- CSS variables on `:root` (already in place); add `:root[data-theme="dark"]`.
- Resolution order: explicit user choice (localStorage) → `prefers-color-scheme`
  → light default.
- Toggle in the top bar: ☀️ / 🌙 / 🖥️ (light / dark / system).
- Token set (both themes): `--bg`, `--surface`, `--surface-2`, `--border`,
  `--text`, `--muted`, `--accent`, `--accent-fg`, `--success`, `--warning`,
  `--danger`, plus chart palette tokens so Recharts follows the theme.
- Accent: indigo by default; **[Q3]** allow an accent picker? (low effort, nice
  for techies). Proposed: yes, 6 presets persisted to localStorage.

---

## 4. Information architecture / navigation

Switch from top tabs to a **left sidebar** (scales better, familiar to devs):

```
┌──────────────────────────────────────────────────────────────────────┐
│  📖 open-agent-glossary            ⌘K search      ☀/🌙   v0.1.2        │  top bar
├───────────────┬──────────────────────────────────────────────────────┤
│  ▸ Dashboard  │                                                        │
│  ▸ Glossary   │                  ← main content →                      │
│  ▸ Usage      │                                                        │
│  ▸ Config     │                                                        │
│  ▸ Sources    │                                                        │
│               │                                                        │
│  ── status ── │                                                        │
│  session a1b2 │                                                        │
│  5 terms      │                                                        │
└───────────────┴──────────────────────────────────────────────────────┘
```

- **⌘K command palette**: jump to any term, run actions (add term, reload,
  toggle theme, open config). Devs expect this.
- Sidebar footer shows live session id + loaded-term count.

---

## 5. Screens

### 5.1 Dashboard

Overview + entry points. Cards on top, two columns below.

```
┌── Glossaries ──┐ ┌── Entries ──┐ ┌── Lookups ──┐ ┌── Injections ──┐
│       6        │ │     142     │ │  88 / 12🟢  │ │   210 / 31🟢   │   (global / session)
└────────────────┘ └─────────────┘ └─────────────┘ └────────────────┘

┌── Tier hierarchy (why terms win) ──────┐  ┌── Loaded this session ──────────┐
│ ▾ Global                                │  │ chips: BFF · REST · DDD …        │
│   • ~/.pi/agent/glossary.json    (10)   │  │ session a1b2c3 · /Users/me/proj  │
│   • ~/.agents/glossary.jsonl     (24)   │  └─────────────────────────────────┘
│ ▾ Project  /Users/me/proj               │  ┌── Recent activity ──────────────┐
│   • .agents/glossary.json        (31)←  │  │ mini bar: lookups vs injections  │
│     (wins on collisions)                │  │ last 5 sessions sparkline        │
└─────────────────────────────────────────┘  └─────────────────────────────────┘
```

The **tier hierarchy tree** is the key new element — it visualizes merge order
(later wins) so you understand precedence at a glance.

### 5.2 Glossary (the main workspace) — master / detail with a tree

Three panes: **tree** (group/filter) · **table** (list) · **detail** (editor).

```
┌── Group by: [Location ▾] [Domain] [Source] ──── search ⌘K ──── + Add ──┐
├──────────────┬───────────────────────────────┬───────────────────────┤
│ TREE         │ TABLE                         │ DETAIL / EDITOR       │
│              │                               │                       │
│ ▾ Project    │ Term    Def…      Dom   ●     │ Term:  BFF            │
│   .agents 31 │ BFF     Backend…  pay   ●on   │ Aliases: bff, …       │
│ ▾ Global     │ REST    Represe…  —     ●on   │ Pattern: \bBFF\b  [▶ test]│
│   .pi     10 │ DTO     Data Tr…  core  ○off  │   ┌ live match preview ┐│
│   .agents 24 │ …                             │   │ "...the BFF layer"  ││
│              │                               │   └─────────────────────┘│
│ Domains      │                               │ Enabled: [✔]          │
│  payments 9  │                               │ Location: Project ▾   │
│  checkout 4  │                               │ Domains: [payments ×]+│
│  core 12     │                               │ Reference: wiki ↗     │
│              │                               │ Defined in: .agents/… │
│              │                               │ Shadows: global .agents│
│              │                               │      [Save] [Delete]  │
└──────────────┴───────────────────────────────┴───────────────────────┘
```

Highlights:
- **Tree grouping toggle**: by Location (tier), by Domain, or by Reference
  source. Clicking a node filters the table.
- **Table** columns: term, definition (truncated), domains (chips), enabled
  (toggle dot), and an "overridden" indicator when a term is shadowed.
- **Detail editor** exposes *everything*: aliases, **regex pattern with a live
  tester** (paste sample text, see matches highlighted), flags, enabled toggle,
  Location selector, Domains chip editor, Reference (label+url), and read-only
  **Defined-in** + **Shadows/Shadowed-by** provenance.
- Smart suggestions (already built) stay in the Add flow.

**[Q4]** Inline-edit in the table vs detail-pane-only editing? Proposed: detail
pane is the editor; table supports quick toggles (enabled) + row actions only.

### 5.3 Config — resolved view + per-value provenance + editor

Config uses "first found wins". The screen makes that legible and editable.

```
┌── Active config file:  .open-agent-glossary/config.json   [switch ▾] ──┐
├──────────────────────────────┬─────────────────────────────────────────┤
│ RESOLUTION STACK (tree)      │ EFFECTIVE CONFIG (form, editable)        │
│ ▾ Project                    │ sessionTtlMinutes   [ 30 ]  ← project    │
│   ✔ .open-agent-glossary ←   │ glossaryMode        [merge ▾] ← default  │
│     .agents/…  (shadowed)    │ glossaryPin         [ … ]                │
│   ✗ .pi/…  (not found)       │ extraGlossaryPaths  [＋ list editor]     │
│ ▾ Global                     │ disableGlobalGlossary  [ ]               │
│   ✗ ~/.open-agent-glossary   │ disableProjectGlossary [ ]               │
│   ✗ ~/.config/…              │ ▾ ui                                     │
│                              │   autostart [✔]  port [7337]  open [✔]   │
└──────────────────────────────┴─────────────────────────────────────────┘
        each field shows a badge: which file it came from / "default"
                         [ Save to <file> ]   [ Revert ]
```

- **Resolution stack tree**: every candidate path, marked found ✔ / shadowed /
  not-found ✗, so you see exactly why a file is or isn't used.
- **Effective config form**: each value annotated with its origin (project file
  vs default). Editing writes back to a chosen target file (atomic write).
- Validates before save (mode/pin coherence, port range).

**[Q5]** Editing config writes files on disk. OK to allow create-new-config-file
from the UI (e.g. "create `.open-agent-glossary/config.json`")? Proposed: yes,
with a confirm step.

### 5.4 Usage — real analytics

Toggle **Global / Session** at top. Grid of charts:

```
┌── Lookups vs Injections (donut) ─┐ ┌── Top terms (horizontal bars) ──────┐
│        ●  total split            │ │ BFF   ████████████ 42               │
└──────────────────────────────────┘ │ REST  ████████ 28                   │
┌── Usage by glossary source ──────┐ │ DTO   █████ 17                      │
│  treemap, sized by usage,        │ └─────────────────────────────────────┘
│  colored by domain               │ ┌── Lookup-heavy vs inject-heavy ─────┐
└──────────────────────────────────┘ │ scatter: x=lookups y=injections     │
┌── Session activity (timeline) ───┐ │ (find terms agents look up but the  │
│ area/line over sessions.startedAt│ │  matcher never auto-injects)        │
└──────────────────────────────────┘ └─────────────────────────────────────┘
┌── Per-term table: term · lookups · injections · domains · last used ─────┐
```

Charts & why each:
- **Donut** — lookups vs injections balance at a glance.
- **Horizontal bars** — top terms (cleaner than vertical for long labels).
- **Treemap** — usage by glossary source/domain; shows where attention goes.
- **Scatter** — lookups (manual) vs injections (auto). Outliers = terms worth a
  better `pattern` (looked up a lot but rarely auto-injected) or pruning.
- **Activity timeline** — sessions over time using `startedAt`/`lastUsed`.

**[Q6]** We currently store only counts + `lastUsed` (no event history). The
timeline is therefore session-granular, not per-event. Add an optional **event
ring-buffer** (last N usage events with timestamps) to enable a true time-series?
It was listed as a non-blocking future item in the plan. Proposed: add a small
capped buffer so the timeline is real, not approximated.

### 5.5 Sources (manage external references)

A light view listing all distinct `Reference`s across entries, so you can see
"these 9 terms come from the Payments wiki" and fix a moved URL in one place.

```
┌── External sources ───────────────────────────────────────────────┐
│ Payments Wiki  ↗ confluence/...   used by 9 terms   [edit url]     │
│ RFC 7231       ↗ ietf.org/...     used by 3 terms                  │
│ (no reference)                    61 terms                         │
└────────────────────────────────────────────────────────────────────┘
```

**[Q7]** Is the Sources screen worth it for v1, or fold it into a filter on the
Glossary tree? Proposed: ship as a simple read-only view first; bulk-edit later.

---

## 6. New / changed API surface

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/entries` (extend) | add `definedIn`, `domains`, `overriddenBy` to each entry |
| GET | `/api/domains` | distinct domains + counts (tree/filter) |
| GET | `/api/sources` | distinct references + usage counts |
| POST | `/api/pattern/test` | `{ pattern, flags, sample }` → match ranges (live tester) |
| GET | `/api/config` | resolved config + per-field origin + resolution stack |
| PUT | `/api/config` | write config to a target file (validated, atomic) |
| GET | `/api/config/paths` | candidate config paths with found/shadowed/missing |
| GET | `/api/usage/timeline` | session/event series (if ring-buffer added) |

Regex testing **[Q8]**: run server-side (Node `RegExp`, matches the matcher's
real behavior) vs client-side (instant, but JS-engine differences). Proposed:
server-side via `/api/pattern/test` to mirror actual injection matching exactly.

---

## 7. Component inventory (additions)

`ThemeToggle`, `CommandPalette (⌘K)`, `Sidebar`, `TierTree`, `ConfigTree`,
`EntryDetail` (replaces the add/edit dialog as a pane), `RegexTester`,
`DomainChips`, `ReferenceField`, `EnabledToggle`, `Treemap`, `DonutChart`,
`ScatterChart`, `ActivityTimeline`, `ProvenanceBadge`.

---

## 8. Proposed build phases

| Phase | Deliverable |
|---|---|
| **R1** | Theming (dark/light/system + tokens), sidebar shell, ⌘K palette |
| **R2** | Entry model fields surfaced: `pattern` + RegexTester, `enabled`, `domains`; "Defined-in" vs "Reference" split; glossary tree + detail pane |
| **R3** | Config screen: resolution-stack tree + editable effective-config form + write-back API |
| **R4** | Usage analytics: donut, treemap, scatter, timeline (+ optional event ring-buffer) |
| **R5** | Sources view + bulk reference edit (optional) |

Backend (core) changes are additive and keep pi-glossary compatibility:
`domains` is new-optional; `source` is widened (string still valid); provenance
is computed, not stored.

---

## 9. Decisions — LOCKED

- **[Q1] Reference** → keep a **single string** for now. (Schema unchanged.)
- **[Q2] Semantic-scope field** → **`tags`** (`tags?: string[]`).
- **[Q3] Accent picker** → **no**. Theming is automatic only: system → dark /
  light, with a manual light/dark/system toggle. Single fixed accent.
- **[Q4] Editing** → **detail pane** for full editing. The **table shows `term`
  and `aliases`** (plus a truncated definition, `tags` chips, and an `enabled`
  quick-toggle); everything else is edited in the detail pane.
- **[Q5] Create config files from UI** → **no**. The config editor only writes
  to config files that already exist; it never creates new ones.
- **[Q6] Usage event ring-buffer** → **yes**. Add a small capped buffer of recent
  usage events (term, kind, ts, sessionId) so the timeline is a real series.
- **[Q7] Sources screen** → **no separate screen**. Fold it into the Glossary
  tree's **"group by Source"** filter (Reference is a single string, so the tree
  grouping covers it). Revisit a dedicated screen only if bulk-edit is needed.
- **[Q8] Regex tester** → **server-side (package logic)**. The browser POSTs
  `{ pattern, flags, sample }` to `/api/pattern/test`, which runs it through the
  real `buildEntryRegex` matcher so the preview equals actual injection behavior.

### Knock-on changes from the locked decisions

- Entry model: drop `domains`, add `tags?: string[]`. `source` stays
  `string | undefined` (single Reference).
- Glossary tree grouping options: **Location · Tag · Source** (Source = the
  `source` string; the "Sources screen" is just this grouping).
- No `/api/sources` screen route needed; `/api/tags` (distinct tags + counts)
  replaces `/api/domains`. Keep `/api/pattern/test`, `/api/config*`,
  `/api/usage/timeline`.
- Usage store gains `events: Array<{ term; kind; ts; sessionId }>` (capped ring,
  e.g. last 1–2k), written via the same atomic + debounced path.

### Build order (unchanged phases, now unblocked)

R1 theming + sidebar shell + ⌘K → R2 entry fields (`pattern`+tester, `enabled`,
`tags`, Defined-in vs Reference split, tree + detail pane) → R3 config screen →
R4 usage analytics + event ring-buffer.

Next: implement **R1** so the new look + dark mode are visible immediately.
