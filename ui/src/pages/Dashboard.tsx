import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type DiscoveryResult, type GlossaryEntry } from "../api.ts";
import { Icon, Badge, TierBadge, StatCard, SkeletonLines, ErrBanner, relTime } from "../components/ui.tsx";

function flatFiles(data: DiscoveryResult) {
  const files: Array<{ id: string; path: string; tier: string; label: string; count: number; scope: string }> = [];
  for (const proj of data.projects) {
    for (const f of proj.files) {
      files.push({ id: f.path, path: f.path, tier: f.tier, label: `project · ${f.tier}`, count: f.entryCount, scope: "project" });
    }
  }
  for (const f of data.global) {
    files.push({ id: f.path, path: f.path, tier: f.tier, label: `global · ${f.tier}`, count: f.entryCount, scope: "global" });
  }
  return files;
}

function MergeStack({ files, mode }: { files: ReturnType<typeof flatFiles>; mode: string }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title"><Icon name="layers" />Merge order</div>
        <Badge tone="amber"><Icon name="zap" size={11} />mode: {mode}</Badge>
      </div>
      <div className="merge-stack">
        {files.map((f, i) => (
          <div key={f.id}>
            <div className={["merge-file", i === 0 && "top"].filter(Boolean).join(" ")}>
              {i === 0 && <span className="merge-win-label">wins conflicts</span>}
              <span className="rank">{i + 1}</span>
              <div className="finfo">
                <div className="fpath">{f.path}</div>
                <div className="fmeta"><TierBadge tier={f.scope} /><span>{f.label}</span></div>
              </div>
              <span className="fcount">{f.count}<span style={{ color: "var(--faint)", fontWeight: 400 }}> entries</span></span>
            </div>
            {i < files.length - 1 && (
              <div className="merge-arrow"><Icon name="arrowDown" /></div>
            )}
          </div>
        ))}
        <div className="legend" style={{ marginTop: 10, padding: "0 11px 6px" }}>
          <div className="li"><span className="sw" style={{ background: "var(--accent)" }} /> highest priority — overrides below</div>
          <div className="li">when a term appears in multiple files, the top file's definition is used</div>
        </div>
      </div>
    </div>
  );
}

function SessionPanel({ navigate }: { navigate: (p: string) => void }) {
  const session = useQuery({ queryKey: ["session"], queryFn: api.session, refetchInterval: 5000 });
  const s = session.data;
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title"><Icon name="terminal" />Current session</div>
        {s && <Badge tone="green" dot>live</Badge>}
      </div>
      <div style={{ padding: "10px 16px 16px" }}>
        {session.isLoading && !s ? <SkeletonLines n={4} />
          : session.isError ? <ErrBanner message={String(session.error)} onRetry={() => session.refetch()} />
          : s ? (
            <>
              <div className="kv-list">
                <div className="kv"><span className="k"><Icon name="hash" />session id</span><span className="v">{s.sessionId}</span></div>
                <div className="kv"><span className="k"><Icon name="folder" />cwd</span><span className="v" title={s.cwd}>{s.cwd}</span></div>
                <div className="kv"><span className="k"><Icon name="clock" />last updated</span><span className="v">{relTime(s.lastUpdated)}</span></div>
                <div className="kv"><span className="k"><Icon name="book" />terms loaded</span><span className="v">{s.loadedTerms.length}</span></div>
              </div>
              {s.loadedTerms.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="section-note" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
                    <Icon name="arrowDown" size={12} style={{ color: "var(--green)" }} />
                    loaded this session ({s.loadedTerms.length})
                  </div>
                  <div className="term-flow">
                    {s.loadedTerms.map(t => (
                      <button key={t} className="flow-term"
                        onClick={() => navigate(`/glossary?term=${encodeURIComponent(t)}`)}>
                        <Icon name="hash" size={11} style={{ color: "var(--green)" }} />{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : <div className="section-note">no active session</div>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const discovery = useQuery({ queryKey: ["discovery"], queryFn: api.discovery });
  const entries = useQuery({ queryKey: ["entries", "merged"], queryFn: () => api.entries("merged") });
  const usage = useQuery({ queryKey: ["usage"], queryFn: api.usage });

  const files = discovery.data ? flatFiles(discovery.data) : [];
  const allEntries: GlossaryEntry[] = entries.data?.entries ?? [];
  const enabledCount = allEntries.filter(e => e.enabled !== false).length;

  const u = usage.data;
  const totals = u?.totals;

  const projFiles = files.filter(f => f.scope === "project").length;
  const globalFiles = files.filter(f => f.scope === "global").length;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-h1">Overview</h1>
        <p className="page-desc">Where your glossary lives, how files resolve against each other, and what the agent is doing with it right now.</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Glossary files" icon="file"
          value={discovery.isLoading ? "—" : files.length}
          sub={<><b>{projFiles}</b> project · <b>{globalFiles}</b> global</>} />
        <StatCard label="Total entries" icon="book"
          value={entries.isLoading ? "—" : allEntries.length}
          sub={<><b>{enabledCount}</b> enabled</>} />
        <StatCard label="Lookups" icon="search"
          value={u ? (totals?.lookups ?? 0).toLocaleString() : "—"}
          sub="all time" />
        <StatCard label="Injections" icon="arrowDown"
          value={u ? (totals?.injections ?? 0).toLocaleString() : "—"}
          sub="all time" />
      </div>

      <div className="section">
        <div className="two-col">
          <div>
            {discovery.isError
              ? <div className="panel" style={{ padding: 16 }}><ErrBanner message={String(discovery.error)} onRetry={() => discovery.refetch()} /></div>
              : discovery.isLoading
              ? <div className="panel" style={{ padding: 16 }}><SkeletonLines n={4} /></div>
              : <MergeStack files={files} mode="merge" />}

            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head">
                <div className="panel-title"><Icon name="chart" />At a glance</div>
                <button className="btn btn--ghost btn--sm" style={{ display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => navigate("/usage")}>
                  Usage <Icon name="chevR" />
                </button>
              </div>
              <div style={{ padding: 16 }}>
                {usage.isLoading && !u ? <SkeletonLines n={3} /> : u ? (
                  <div className="kv-list">
                    <div className="kv"><span className="k"><Icon name="search" />lifetime lookups</span><span className="v">{(totals?.lookups ?? 0).toLocaleString()}</span></div>
                    <div className="kv"><span className="k"><Icon name="arrowDown" />lifetime injections</span><span className="v">{(totals?.injections ?? 0).toLocaleString()}</span></div>
                    <div className="kv"><span className="k"><Icon name="zap" />inject rate</span>
                      <span className="v">
                        {totals?.lookups ? Math.round((totals.injections / totals.lookups) * 100) + "%" : "—"}
                      </span>
                    </div>
                  </div>
                ) : <ErrBanner message={String(usage.error)} onRetry={() => usage.refetch()} />}
              </div>
            </div>
          </div>

          <SessionPanel navigate={navigate} />
        </div>
      </div>
    </div>
  );
}
