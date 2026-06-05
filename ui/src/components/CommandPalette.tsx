import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Icon, IconButton } from "./ui.tsx";
import type { GlossaryEntry } from "../api.ts";

interface CmdItem {
  type: string; id: string; label: string; sub?: string;
  icon: string; disabled?: boolean; run: () => void; haystack?: string;
}

interface Props {
  entries: GlossaryEntry[];
  onClose: () => void;
  onNavigate: (to: string) => void;
  onTheme: (t: string) => void;
  onRefresh: () => void;
}

export function CommandPalette({ entries, onClose, onNavigate, onTheme, onRefresh }: Props) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const actions = useMemo<CmdItem[]>(() => ([
    { type: "action", id: "add", label: "Add new term", sub: "create entry", icon: "plus", run: () => onNavigate("/glossary?add=1") },
    { type: "action", id: "theme-dark", label: "Theme: Dark", icon: "moon", run: () => onTheme("dark") },
    { type: "action", id: "theme-light", label: "Theme: Light", icon: "sun", run: () => onTheme("light") },
    { type: "action", id: "theme-system", label: "Theme: System", icon: "monitor", run: () => onTheme("system") },
    { type: "action", id: "refresh", label: "Refresh all data", icon: "refresh", run: () => { onRefresh(); onClose(); } },
  ]), [onNavigate, onTheme, onRefresh, onClose]);

  const navTargets = useMemo<CmdItem[]>(() => ([
    { type: "nav", id: "overview", label: "Overview", sub: "discovery · session", icon: "overview", run: () => onNavigate("/") },
    { type: "nav", id: "glossary", label: "Glossary", sub: "browse entries", icon: "book", run: () => onNavigate("/glossary") },
    { type: "nav", id: "usage", label: "Usage", sub: "analytics", icon: "chart", run: () => onNavigate("/usage") },
    { type: "nav", id: "config", label: "Config", sub: "settings", icon: "sliders", run: () => onNavigate("/config") },
  ]), [onNavigate]);

  const termItems = useMemo<CmdItem[]>(() => entries.map(e => ({
    type: "term", id: "term-" + e.term, label: e.term, sub: e.definition,
    icon: "hash", disabled: !e.enabled,
    run: () => onNavigate(`/glossary?term=${encodeURIComponent(e.term)}`),
    haystack: (e.term + " " + (e.aliases || []).join(" ") + " " + e.definition).toLowerCase(),
  })), [entries, onNavigate]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const match = (it: CmdItem) => !query || (it.haystack || (it.label + " " + (it.sub || "")).toLowerCase()).includes(query);
    return [
      { title: "Navigation", items: navTargets.filter(match) },
      { title: "Actions", items: actions.filter(match) },
      { title: "Terms", items: termItems.filter(match).slice(0, query ? 40 : 8) },
    ].filter(g => g.items.length);
  }, [q, navTargets, actions, termItems]);

  const flat = useMemo(() => filtered.flatMap(g => g.items), [filtered]);
  useEffect(() => { setSel(0); }, [q]);

  const choose = useCallback((it?: CmdItem) => { if (!it) return; it.run(); onClose(); }, [onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(flat[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(".cmdk-item.sel");
    if (el) {
      const r = el.getBoundingClientRect(), pr = listRef.current.getBoundingClientRect();
      if (r.bottom > pr.bottom) listRef.current.scrollTop += r.bottom - pr.bottom + 6;
      else if (r.top < pr.top) listRef.current.scrollTop -= pr.top - r.top + 6;
    }
  }, [sel]);

  let idx = -1;
  return (
    <div className="cmdk-scrim" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={e => e.stopPropagation()} onKeyDown={onKey}>
        <div className="cmdk-search">
          <Icon name="search" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search terms, actions, screens…" spellCheck={false} />
          {q && <IconButton icon="x" size="sm" title="Clear" onClick={() => setQ("")} />}
        </div>
        <div className="cmdk-results" ref={listRef}>
          {flat.length === 0 && <div className="cmdk-empty">No matches for "{q}"</div>}
          {filtered.map(g => (
            <div key={g.title}>
              <div className="cmdk-group">{g.title}</div>
              {g.items.map(it => {
                idx++; const here = idx;
                return (
                  <button key={it.id} className={["cmdk-item", here === sel && "sel"].filter(Boolean).join(" ")}
                    onMouseEnter={() => setSel(here)} onClick={() => choose(it)}>
                    <span className="ico"><Icon name={it.icon} /></span>
                    <span className="label" style={it.disabled ? { textDecoration: "line-through", opacity: .6 } : undefined}>{it.label}</span>
                    {it.sub && <span className="sub">{it.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span className="fk"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="fk"><span className="kbd">↵</span> select</span>
          <span className="fk"><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
