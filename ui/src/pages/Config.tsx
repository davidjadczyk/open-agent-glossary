import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type GlossaryConfigShape } from "../api.ts";
import { Icon, Button, IconButton, Badge, Switch, Input, SkeletonLines, ErrBanner, Spinner, useToast } from "../components/ui.tsx";

const CFG_FIELDS: Record<string, {
  type: "select" | "bool" | "number" | "text";
  label: string; code: string; desc: string;
  options?: string[]; unit?: string; placeholder?: string; group: string;
  dependsOn?: (c: GlossaryConfigShape) => boolean;
}> = {
  glossaryMode:         { type: "select", label: "Glossary mode",         code: "mode",           desc: "How files combine. merge = layer all; first = highest-priority file only; pin = use one fixed file.", options: ["merge", "first", "pin"], group: "Resolution" },
  glossaryPin:          { type: "text",   label: "Pin path",              code: "pin_path",       desc: "File used when mode is pin. Ignored otherwise.", placeholder: "./.agent/pinned.json", group: "Resolution", dependsOn: (c) => c.glossaryMode === "pin" },
  disableProjectGlossary: { type: "bool", label: "Disable project glossary", code: "disable_project", desc: "Skip discovery of project-tier files entirely.", group: "Resolution" },
  disableGlobalGlossary:  { type: "bool", label: "Disable global glossary",  code: "disable_global",  desc: "Skip discovery of global-tier files entirely.", group: "Resolution" },
  sessionTtlMinutes:    { type: "number", unit: "min", label: "Session TTL", code: "session_ttl",  desc: "How long a session's loaded terms stay warm before re-resolution.", group: "Session" },
  uiPort:               { type: "number", label: "UI port",               code: "ui_port",        desc: "Port this control UI binds to on localhost.", group: "UI" },
  uiAutostart:          { type: "bool",   label: "UI autostart",          code: "ui_autostart",   desc: "Start the UI server automatically with the agent.", group: "UI" },
  uiOpen:               { type: "bool",   label: "Open on start",         code: "ui_open",        desc: "Open the UI in a browser when the server starts.", group: "UI" },
};
const CFG_ORDER = ["glossaryMode", "glossaryPin", "disableProjectGlossary", "disableGlobalGlossary", "sessionTtlMinutes", "uiPort", "uiAutostart", "uiOpen"];
const CFG_GROUPS = ["Resolution", "Session", "UI"];

// Map config shape to the fields we expose
function getFieldValue(config: GlossaryConfigShape, key: string): unknown {
  if (key === "uiPort") return config.ui?.port;
  if (key === "uiAutostart") return config.ui?.autostart;
  if (key === "uiOpen") return config.ui?.open;
  return (config as unknown as Record<string, unknown>)[key];
}

function statusBadge(c: { exists: boolean; used: boolean }) {
  if (!c.exists) return <Badge><Icon name="x" size={10} />not found</Badge>;
  if (c.used) return <Badge tone="green" dot>active</Badge>;
  return <Badge tone="amber"><Icon name="layers" size={10} />shadowed</Badge>;
}

function ConfigRow({ fieldKey, field, value, origin, draft, setDraft, onSave, saving, disabled }: {
  fieldKey: string;
  field: typeof CFG_FIELDS[string];
  value: unknown; origin: string;
  draft: unknown; setDraft: (k: string, v: unknown) => void;
  onSave: (k: string, v: unknown) => void;
  saving: boolean; disabled: boolean;
}) {
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const fromDefault = !origin || origin === "default";

  const control = () => {
    if (field.type === "bool") return <Switch on={!!draft} onChange={(v) => onSave(fieldKey, v)} />;
    if (field.type === "select") return (
      <select className="select" value={String(draft)} onChange={e => onSave(fieldKey, e.target.value)}>
        {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
      </select>);
    if (field.type === "number") return (
      <div className="cfg-num">
        <Input mono type="number" value={String(draft ?? "")}
          onChange={e => setDraft(fieldKey, e.target.value === "" ? "" : Number(e.target.value))} />
        {field.unit && <span className="cfg-unit">{field.unit}</span>}
      </div>);
    return <Input mono value={String(draft ?? "")} placeholder={field.placeholder}
      onChange={e => setDraft(fieldKey, e.target.value)} />;
  };

  const showSave = (field.type === "text" || field.type === "number") && dirty;

  return (
    <div className={["cfg-row", disabled && "disabled"].filter(Boolean).join(" ")}>
      <div className="cfg-rinfo">
        <div className="cfg-key">
          {field.label}<code>{field.code}</code>
          {dirty && <span className="cfg-dirty-dot" title="unsaved" />}
        </div>
        <div className="cfg-desc">{field.desc}</div>
        <div className="cfg-origin">
          {fromDefault
            ? <span className="from-default"><Icon name="dot" size={10} /> using default</span>
            : <span className="from-file"><Icon name="file" size={11} /> from {origin}</span>}
        </div>
      </div>
      <div className="cfg-control">
        {control()}
        {showSave && (
          <div className="cfg-save">
            <IconButton icon="refresh" size="sm" title="Revert" onClick={() => setDraft(fieldKey, value)} />
            <Button variant="primary" size="sm" icon={saving ? undefined : "check"} disabled={saving}
              onClick={() => onSave(fieldKey, draft)}>
              {saving ? <Spinner /> : "Save"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Config() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const cfgQ = useQuery({ queryKey: ["config"], queryFn: api.config });
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const data = cfgQ.data;
  const config = data?.config;
  const origins = data?.origins ?? {};
  const activeFile = data?.activeFile ?? null;

  useEffect(() => {
    if (!config) return;
    const d: Record<string, unknown> = {};
    for (const key of CFG_ORDER) d[key] = getFieldValue(config, key);
    setDrafts(d);
  }, [config]);

  const setDraft = (k: string, v: unknown) => setDrafts(d => ({ ...d, [k]: v }));

  const save = (key: string, value: unknown) => {
    if (!config || !activeFile) return;
    setSavingKey(key);
    setDraft(key, value);

    // Build updated config shape
    const next = { ...config };
    if (key === "uiPort") next.ui = { ...next.ui, port: value as number };
    else if (key === "uiAutostart") next.ui = { ...next.ui, autostart: value as boolean };
    else if (key === "uiOpen") next.ui = { ...next.ui, open: value as boolean };
    else (next as Record<string, unknown>)[key] = value;

    api.saveConfig(activeFile, next).then(() => {
      setSavingKey(null);
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success(`Saved ${CFG_FIELDS[key]?.code ?? key}`, `written to ${activeFile}`);
    }).catch((e: Error) => {
      setSavingKey(null);
      toast.error("Write failed", e.message);
      if (config) setDraft(key, getFieldValue(config, key)); // revert
    });
  };

  if (cfgQ.isError) return (
    <div className="page">
      <div className="page-head"><h1 className="page-h1">Config</h1></div>
      <div className="panel" style={{ padding: 16 }}>
        <ErrBanner message={String(cfgQ.error)} onRetry={() => cfgQ.refetch()} />
      </div>
    </div>
  );

  const loading = cfgQ.isLoading && !data;
  const stack = data?.stack ?? [];
  const anyExists = stack.some(c => c.exists);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-h1">Config</h1>
        <p className="page-desc">Effective settings resolved across candidate files. Edits are written back to the active file — nothing else is touched.</p>
      </div>

      {!loading && !anyExists && (
        <div className="cfg-suggest"><Icon name="info" />
          <div>No config file exists yet. To set values, create <code>./.agent/config.json</code> — this UI won't create it for you.</div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <span className="section-title"><Icon name="layers" />Resolution stack</span>
          <span className="section-note">highest priority first · active file wins</span>
        </div>
        <div className="panel">
          {loading ? <div style={{ padding: 16 }}><SkeletonLines n={4} /></div> : (
            <div className="cfg-stack">
              {stack.map((c, i) => (
                <div key={c.path} className={["cfg-file", c.used && "active", !c.exists && "missing"].filter(Boolean).join(" ")}>
                  <span className="rank">{i + 1}</span>
                  <span className="cf-path">{c.path}</span>
                  {statusBadge(c)}
                </div>
              ))}
              {stack.length === 0 && <div style={{ padding: 12 }} className="section-note">No config candidates discovered.</div>}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="section-title"><Icon name="sliders" />Effective settings</span>
          <span className="section-note">
            {activeFile ? <>writes go to <code style={{ color: "var(--accent)" }}>{activeFile}</code></> : ""}
          </span>
        </div>

        {loading ? <div className="panel" style={{ padding: 20 }}><SkeletonLines n={6} /></div> : config && (
          CFG_GROUPS.map(group => (
            <div key={group} className="panel cfg-group" style={{ marginBottom: 14 }}>
              <div className="panel-head"><div className="panel-title">{group}</div></div>
              {CFG_ORDER.filter(k => CFG_FIELDS[k].group === group).map(key => {
                const field = CFG_FIELDS[key];
                const disabled = !!(field.dependsOn && !field.dependsOn(config));
                return (
                  <ConfigRow key={key} fieldKey={key} field={field}
                    value={getFieldValue(config, key)} origin={origins[key] ?? ""}
                    draft={drafts[key] ?? getFieldValue(config, key)}
                    setDraft={setDraft} onSave={save}
                    saving={savingKey === key} disabled={disabled}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
