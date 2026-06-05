import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Icon, Button, IconButton, Badge, TagChip, TierBadge, Switch, Segmented,
  Field, Input, Textarea, ChipInput, ConfirmDialog, SkeletonLines, Empty, ErrBanner, Spinner, useToast,
} from "../components/ui.tsx";
import { api, type GlossaryEntry } from "../api.ts";

const LAYOUTS = [
  { value: "list", icon: "list", label: "List" },
  { value: "split", icon: "columns", label: "Split" },
  { value: "cards", icon: "grid", label: "Cards" },
];
const GROUPINGS = [
  { value: "none", label: "nothing" },
  { value: "scope", label: "storage" },
  { value: "tags", label: "tag" },
];


/* ---- entry row (list view) ---- */
function EntryRow({ entry, selected, onOpen, onToggle, onDelete }: {
  entry: GlossaryEntry; selected: boolean;
  onOpen: (e: GlossaryEntry) => void;
  onToggle: (e: GlossaryEntry) => void;
  onDelete: (e: GlossaryEntry) => void;
}) {
  const scope = entry.scope || "project";
  return (
    <div className={["entry-row", selected && "sel", entry.enabled === false && "disabled"].filter(Boolean).join(" ")}
      onClick={() => onOpen(entry)} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(entry); } }}>
      <span className={["er-state", entry.enabled === false && "off"].filter(Boolean).join(" ")} />
      <div className="er-main">
        <div className="er-termrow">
          <span className="er-term">{entry.term}</span>
          {entry.pattern && <span className="has-regex" title={`/${entry.pattern}/${entry.flags}`}>/regex/</span>}
          {(entry.aliases?.length ?? 0) > 0 && (
            <span className="er-aliases">{entry.aliases!.slice(0, 3).join(", ")}{entry.aliases!.length > 3 ? "…" : ""}</span>
          )}
          {(entry.overriddenBy?.length ?? 0) > 0 && (
            <Badge tone="amber"><Icon name="layers" size={10} />overrides</Badge>
          )}
        </div>
        <div className="er-def">{entry.definition || <span style={{ color: "var(--faint)" }}>no definition</span>}</div>
      </div>
      <div className="er-meta">
        {(entry.tags?.length ?? 0) > 0 && (
          <div className="er-tags">{entry.tags!.slice(0, 2).map(t => <TagChip key={t}>{t}</TagChip>)}</div>
        )}
        {entry.source && (
          <a className="er-prov" href={entry.source} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()} title={entry.source}><Icon name="link" /></a>
        )}
        <span className="er-prov"><Icon name={scope === "global" ? "globe" : "folder"} />{scope}</span>
      </div>
      <div className="er-actions" onClick={e => e.stopPropagation()}>
        <Switch on={entry.enabled !== false} onChange={() => onToggle(entry)} title={entry.enabled !== false ? "Disable" : "Enable"} />
        <IconButton icon="trash" size="sm" title="Delete" onClick={() => onDelete(entry)} />
      </div>
    </div>
  );
}

function EntryCard({ entry, selected, onOpen }: {
  entry: GlossaryEntry; selected: boolean; onOpen: (e: GlossaryEntry) => void;
}) {
  const scope = entry.scope || "project";
  return (
    <div className={["gcard", selected && "sel", entry.enabled === false && "disabled"].filter(Boolean).join(" ")}
      onClick={() => onOpen(entry)} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") onOpen(entry); }}>
      <div className="gc-top">
        <span className="gc-term">{entry.term}</span>
        <span className={["er-state", entry.enabled === false && "off"].filter(Boolean).join(" ")} style={{ marginTop: 5 }} />
      </div>
      <div className="gc-def">{entry.definition || "no definition"}</div>
      <div className="gc-foot">
        {entry.pattern && <span className="has-regex">/regex/</span>}
        {entry.tags?.slice(0, 2).map(t => <TagChip key={t}>{t}</TagChip>)}
        <span className="er-prov" style={{ marginLeft: "auto" }}>
          <Icon name={scope === "global" ? "globe" : "folder"} />{scope}
        </span>
      </div>
    </div>
  );
}

/* ---- pattern tester ---- */
const SAMPLE = "The team shipped a new RAG pipeline; the agent now does a tool call into the vector db, reranks, then injects the BFF definition. P95 latency dropped.";

function PatternTester({ draft }: { draft: { pattern: string; flags: string; term: string; aliases: string[] } }) {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<{ matches: Array<{start:number;end:number;text:string}>; count: number }>({ matches: [], count: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true); setErr(null);
    const t = setTimeout(() => {
      api.testPattern({ pattern: draft.pattern || undefined, flags: draft.flags || undefined, term: draft.term, aliases: draft.aliases, sample: text })
        .then(r => { if (!cancelled) { setResult({ matches: r.matches, count: r.matches.length }); setBusy(false); } })
        .catch(e => { if (!cancelled) { setErr((e as Error).message || "invalid pattern"); setBusy(false); } });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [draft.pattern, draft.flags, draft.term, JSON.stringify(draft.aliases), text]); // eslint-disable-line

  const highlighted = useMemo(() => {
    if (err) return null;
    const ms = [...result.matches].sort((a, b) => a.start - b.start);
    const out: React.ReactNode[] = []; let cur = 0;
    ms.forEach((m, i) => {
      if (m.start > cur) out.push(text.slice(cur, m.start));
      out.push(<mark key={i}>{text.slice(m.start, m.end)}</mark>);
      cur = m.end;
    });
    if (cur < text.length) out.push(text.slice(cur));
    return out;
  }, [result, text, err]);

  return (
    <div className="tester">
      <div className="tester-head">
        <div className="th-title"><Icon name="flask" />Pattern tester</div>
        <div className="tester-stat">
          {busy ? <Spinner /> : err ? <span className="none">error</span>
            : result.count > 0 ? <span className="ok">{result.count} match{result.count > 1 ? "es" : ""}</span>
            : <span className="none">no match</span>}
        </div>
      </div>
      <div className="field-hint">
        {draft.pattern
          ? <>using regex <code style={{ color: "var(--amber)" }}>/{draft.pattern}/{draft.flags}</code></>
          : <>matching <code style={{ color: "var(--text-2)" }}>{[draft.term, ...draft.aliases].filter(Boolean).join(" · ") || "(term)"}</code> on word boundaries</>}
      </div>
      <Textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Type sample text…" />
      {err ? <ErrBanner message={err} /> : <div className="tester-out">{highlighted}</div>}
      <div className="field-hint">Runs the same matching logic the agent uses at injection time.</div>
    </div>
  );
}

/* ---- entry editor ---- */
interface Draft { term: string; definition: string; aliases: string[]; pattern: string; flags: string; enabled: boolean; source: string; tags: string[]; scope: "global" | "project"; }

function EntryEditor({ entry, mode, panelized, onClose, onSaved, onDeleted }: {
  entry?: GlossaryEntry; mode: "add" | "edit"; panelized?: boolean;
  onClose: () => void; onSaved: (e: GlossaryEntry) => void; onDeleted?: () => void;
}) {
  const toast = useToast();
  const isAdd = mode === "add";
  const blank: Draft = { term: "", definition: "", aliases: [], pattern: "", flags: "", enabled: true, source: "", tags: [], scope: "project" };
  const init: Draft = entry ? {
    term: entry.term, definition: entry.definition,
    aliases: entry.aliases || [], pattern: entry.pattern || "",
    flags: entry.flags || "", enabled: entry.enabled !== false,
    source: entry.source || "", tags: entry.tags || [],
    scope: (entry.scope as "global" | "project") || "project",
  } : blank;

  const [draft, setDraft] = useState<Draft>(init);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => { setDraft(init); setErr(null); }, [entry?.term, mode]); // eslint-disable-line
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(init);

  const doSave = () => {
    if (!draft.term.trim()) { setErr("term is required"); return; }
    setSaving(true); setErr(null);
    const p = isAdd
      ? api.addEntry({ ...draft })
      : api.editEntry(entry!.term, { ...draft, scope: draft.scope });
    p.then(() => {
      setSaving(false);
      toast.success(isAdd ? `Added "${draft.term}"` : `Saved "${draft.term}"`);
      onSaved({ ...draft } as GlossaryEntry);
    }).catch((e: Error) => { setSaving(false); setErr(e.message || "save failed"); });
  };

  const doDelete = () => {
    if (!entry) return;
    setDelBusy(true);
    api.deleteEntry(entry.term, entry.scope as "global" | "project" || "project")
      .then(() => { setDelBusy(false); setConfirmDel(false); toast.success(`Deleted "${entry.term}"`); onDeleted?.(); })
      .catch((e: Error) => { setDelBusy(false); setErr(e.message); });
  };

  const toggleEnabled = () => {
    if (isAdd) { set("enabled", !draft.enabled); return; }
    const next = !draft.enabled;
    set("enabled", next);
    api.editEntry(entry!.term, { enabled: next, scope: draft.scope })
      .then(() => toast.info(next ? "Enabled" : "Disabled — won't be injected", entry!.term))
      .catch((e: Error) => { set("enabled", !next); setErr(e.message); });
  };

  return (
    <div className={["editor", panelized && "panelized"].filter(Boolean).join(" ")}>
      <div className="editor-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="eh-pre">{isAdd ? "NEW ENTRY" : "EDITING"}</div>
          <div className="eh-term">{draft.term || (isAdd ? "untitled" : entry?.term)}</div>
        </div>
        {!isAdd && <Switch on={draft.enabled} onChange={toggleEnabled} title={draft.enabled ? "Disable" : "Enable"} />}
        <IconButton icon="x" title="Close" onClick={onClose} />
      </div>

      <div className="editor-body">
        {err && <ErrBanner message={err} />}

        {isAdd && (
          <Field label="Write to file">
            <div className="file-pills">
              {(["project", "global"] as const).map(s => (
                <div key={s} className={["file-pill", draft.scope === s && "on"].filter(Boolean).join(" ")}
                  onClick={() => set("scope", s)}>
                  <span className="radio" />
                  <span className="fp-path">{s === "project" ? "./.agent/glossary.json" : "~/.config/agent/glossary.json"}</span>
                  <TierBadge tier={s} />
                </div>
              ))}
            </div>
          </Field>
        )}

        <Field label="Term" error={err && !draft.term.trim() ? "required" : null}>
          <Input mono value={draft.term} placeholder="e.g. RAG" onChange={e => set("term", e.target.value)} />
        </Field>

        <Field label="Definition">
          <Textarea value={draft.definition} placeholder="Free-text definition the agent injects…" rows={4}
            onChange={e => set("definition", e.target.value)} />
        </Field>

        <Field label="Aliases" hint="Alternative names that should also match">
          <ChipInput values={draft.aliases} onChange={v => set("aliases", v)} placeholder="add alias + Enter" prefix="≈ " />
        </Field>

        <Field label="Pattern" hint="Optional regex — overrides term/alias matching when set">
          <div className="form-row2">
            <Input mono value={draft.pattern} placeholder="\bvector\s?(db|store)\b" onChange={e => set("pattern", e.target.value)} />
            <Input mono value={draft.flags} placeholder="flags" onChange={e => set("flags", e.target.value)} />
          </div>
        </Field>

        <PatternTester draft={draft} />

        <Field label="Tags" hint="Semantic grouping — team, domain, project">
          <ChipInput values={draft.tags} onChange={v => set("tags", v)} placeholder="add tag + Enter" prefix="#" />
        </Field>

        <Field label="Source" hint="External source of truth (URL)">
          <Input value={draft.source} placeholder="https://wiki…" onChange={e => set("source", e.target.value)} />
        </Field>

        {!isAdd && entry && (
          <Field label="Provenance">
            <div className="prov-block">
              <div className="prov-line"><span className="pk">file</span><code>{entry.sourcePath || entry.definedIn?.path || `(${entry.scope})`}</code></div>
              <div className="prov-line"><span className="pk">storage</span><TierBadge tier={entry.scope || "project"} /></div>
            </div>
          </Field>
        )}
      </div>

      <div className="editor-foot">
        {!isAdd && <Button variant="danger" size={panelized ? "sm" : undefined} icon="trash" onClick={() => setConfirmDel(true)}>Delete</Button>}
        <div className="spacer" />
        <Button variant="ghost" onClick={onClose}>{isAdd ? "Cancel" : "Close"}</Button>
        <Button variant="primary" icon={saving ? undefined : "check"} disabled={saving || (!isAdd && !dirty)} onClick={doSave}>
          {saving ? <Spinner /> : isAdd ? "Create entry" : "Save changes"}
        </Button>
      </div>

      {confirmDel && entry && (
        <ConfirmDialog title={`Delete "${entry.term}"?`}
          text={`Removes the entry from ${entry.sourcePath || entry.scope}. The agent will stop injecting it. This can't be undone.`}
          confirmLabel="Delete entry" danger busy={delBusy} onConfirm={doDelete} onClose={() => setConfirmDel(false)} />
      )}
    </div>
  );
}

/* ============================================================ */
export function Glossary() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [layout, setLayout] = useState(() => localStorage.getItem("gloss-layout") || "split");
  const [groupBy, setGroupBy] = useState("none");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ action: "delete" | "disable"; entry: GlossaryEntry } | null>(null);
  const [pendBusy, setPendBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem("gloss-layout", layout); }, [layout]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["entries", "merged"], queryFn: () => api.entries("merged"),
  });
  const all = data?.entries ?? [];

  const selTerm = params.get("term");
  const addOpen = params.has("add");
  const selected = useMemo(() =>
    selTerm ? all.find(e => e.term.toLowerCase() === selTerm.toLowerCase()) || null : null,
    [selTerm, all]);

  const openEntry = (e: GlossaryEntry) => navigate(`/glossary?term=${encodeURIComponent(e.term)}`);
  const openAdd = () => navigate("/glossary?add=1");
  const closeDetail = () => navigate("/glossary");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all.filter(e =>
      e.term.toLowerCase().includes(query) ||
      (e.definition || "").toLowerCase().includes(query) ||
      (e.aliases || []).some(a => a.toLowerCase().includes(query)) ||
      (e.tags || []).some(t => t.toLowerCase().includes(query)));
  }, [all, q]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: null as string | null, icon: "", entries: filtered }];
    const map = new Map<string, { key: string; label: string; icon: string; entries: GlossaryEntry[] }>();
    const push = (key: string, meta: { label: string; icon: string }, e: GlossaryEntry) => {
      if (!map.has(key)) map.set(key, { key, ...meta, entries: [] });
      map.get(key)!.entries.push(e);
    };
    for (const e of filtered) {
      if (groupBy === "scope") push(e.scope || "project", { label: e.scope || "project", icon: e.scope === "global" ? "globe" : "folder" }, e);
      else if (groupBy === "tags") {
        if (!e.tags?.length) push("∅untagged", { label: "untagged", icon: "hash" }, e);
        else e.tags.forEach(t => push("tag:" + t, { label: t, icon: "hash" }, e));
      }
    }
    return [...map.values()].sort((a, b) => (a.key.startsWith("∅") ? 1 : 0) - (b.key.startsWith("∅") ? 1 : 0) || b.entries.length - a.entries.length);
  }, [filtered, groupBy]);

  const runPending = () => {
    if (!pending) return;
    setPendBusy(true);
    const { action, entry } = pending;
    const p = action === "delete"
      ? api.deleteEntry(entry.term, entry.scope as "global" | "project" || "project")
      : api.editEntry(entry.term, { enabled: false, scope: entry.scope as "global" | "project" || "project" });
    p.then(() => {
      setPendBusy(false); setPending(null);
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      if (action === "delete") { toast.success(`Deleted "${entry.term}"`); if (selTerm === entry.term) closeDetail(); }
      else toast.info("Disabled — won't be injected", entry.term);
    }).catch((e: Error) => { setPendBusy(false); setPending(null); toast.error("Action failed", e.message); });
  };

  const onToggle = (e: GlossaryEntry) => {
    if (e.enabled !== false) setPending({ action: "disable", entry: e });
    else {
      api.editEntry(e.term, { enabled: true, scope: e.scope as "global" | "project" || "project" })
        .then(() => { queryClient.invalidateQueries({ queryKey: ["entries"] }); toast.info("Enabled", e.term); })
        .catch((err: Error) => toast.error("Failed", err.message));
    }
  };
  const onQuickDelete = (e: GlossaryEntry) => setPending({ action: "delete", entry: e });

  const afterSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["entries"] });
  }, [queryClient]);

  const afterAdded = useCallback((e: GlossaryEntry) => {
    queryClient.invalidateQueries({ queryKey: ["entries"] });
    navigate(`/glossary?term=${encodeURIComponent(e.term)}`);
  }, [queryClient, navigate]);

  // "/" to focus search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const loading = isLoading && !all.length;

  const renderRows = (list: GlossaryEntry[]) => list.map(e => (
    <EntryRow key={e.term} entry={e} selected={selected?.term === e.term}
      onOpen={openEntry} onToggle={onToggle} onDelete={onQuickDelete} />
  ));

  const ListBody = (
    <div>
      {isError ? <div className="panel" style={{ padding: 16 }}><ErrBanner message={String(error)} onRetry={() => refetch()} /></div>
        : loading ? <div className="panel" style={{ padding: 16 }}><SkeletonLines n={6} /></div>
        : filtered.length === 0 ? (
          <Empty title="No matching entries" text={q ? `Nothing matches "${q}".` : "This glossary is empty."}>
            <Button variant="primary" size="sm" icon="plus" onClick={openAdd}>Add term</Button>
          </Empty>
        ) : groups.map(g => (
          <div key={g.key}>
            {g.label && <div className="grp-head"><span className="grp-title"><Icon name={g.icon} />{g.label}</span><span className="grp-count">{g.entries.length}</span></div>}
            {renderRows(g.entries)}
          </div>
        ))}
    </div>
  );

  const CardsBody = (
    <div>
      {loading ? <div className="card-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="gcard skel" style={{ minHeight: 120 }} />)}</div>
        : filtered.length === 0 ? <Empty title="No matching entries" text={q ? `Nothing matches "${q}".` : "Empty glossary."} />
        : groups.map(g => (
          <div key={g.key}>
            {g.label && <div className="grp-head"><span className="grp-title"><Icon name={g.icon} />{g.label}</span><span className="grp-count">{g.entries.length}</span></div>}
            <div className="card-grid">{g.entries.map(e => <EntryCard key={e.term} entry={e} selected={selected?.term === e.term} onOpen={openEntry} />)}</div>
          </div>
        ))}
    </div>
  );

  return (
    <div className="page page-wide">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="page-h1">Glossary</h1>
          <p className="page-desc">{all.length} terms after merge · {all.filter(e => e.enabled !== false).length} enabled · the agent injects matching definitions into context.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={openAdd}>Add term</Button>
      </div>

      <div className="gloss-toolbar">
        <div className="search-box">
          <Icon name="search" />
          <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Filter by term, definition, alias, tag…   ( / )" spellCheck={false} />
          {q && <span className="hitcount">{filtered.length} / {all.length}</span>}
          {q && <IconButton icon="x" size="sm" title="Clear" onClick={() => setQ("")} />}
        </div>
        <div className="groupby">
          <Icon name="layers" size={13} style={{ color: "var(--faint)" }} />
          group by
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            {GROUPINGS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <Segmented value={layout} onChange={setLayout} options={LAYOUTS} />
      </div>

      {layout === "split" ? (
        <div className="split">
          <div className="split-list"><div className="scroll-list">{ListBody}</div></div>
          <div className="split-detail">
            {addOpen ? <EntryEditor mode="add" panelized onClose={closeDetail} onSaved={afterAdded} />
              : selected ? <EntryEditor key={selected.term} mode="edit" panelized entry={selected} onClose={closeDetail} onSaved={afterSaved} onDeleted={() => { queryClient.invalidateQueries({ queryKey: ["entries"] }); closeDetail(); }} />
              : <div className="editor panelized" style={{ minHeight: 320 }}>
                  <Empty icon="book" title="Select an entry" text="Pick a term on the left to view its definition, provenance, and pattern — or add a new one.">
                    <Button variant="primary" size="sm" icon="plus" onClick={openAdd}>Add term</Button>
                  </Empty>
                </div>}
          </div>
        </div>
      ) : layout === "cards" ? CardsBody : ListBody}

      {layout !== "split" && (addOpen || selected) && (
        <>
          <div className="detail-drawer-scrim" onClick={closeDetail} />
          <div className="detail-drawer">
            {addOpen ? <EntryEditor mode="add" onClose={closeDetail} onSaved={afterAdded} />
              : selected && <EntryEditor key={selected.term} mode="edit" entry={selected} onClose={closeDetail} onSaved={afterSaved} onDeleted={() => { queryClient.invalidateQueries({ queryKey: ["entries"] }); closeDetail(); }} />}
          </div>
        </>
      )}

      {pending && (
        <ConfirmDialog
          title={pending.action === "delete" ? `Delete "${pending.entry.term}"?` : `Disable "${pending.entry.term}"?`}
          text={pending.action === "delete"
            ? `Removes the entry. The agent will stop injecting it. This can't be undone.`
            : "Disabled entries stay in the file but are never injected. You can re-enable any time."}
          confirmLabel={pending.action === "delete" ? "Delete entry" : "Disable"}
          danger={pending.action === "delete"} busy={pendBusy}
          onConfirm={runPending} onClose={() => setPending(null)} />
      )}
    </div>
  );
}
