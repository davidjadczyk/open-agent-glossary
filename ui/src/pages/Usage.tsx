import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type UsageEvent } from "../api.ts";
import { Icon, Badge, Segmented, StatCard, SkeletonLines, ErrBanner, Empty, relTime } from "../components/ui.tsx";

function fmtClock(ts: number) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}
function fmtDay(ts: number) { return new Date(ts).toLocaleDateString(undefined, { weekday: "short" }); }

function TimelineChart({ events, scope, sessionStart }: {
  events: UsageEvent[]; scope: string; sessionStart?: number;
}) {
  const buckets = useMemo(() => {
    if (!events.length) return [];
    const session = scope === "session";
    const start = session && sessionStart ? sessionStart : events[0].ts;
    const end = Date.now();
    const span = Math.max(end - start, 1);
    const N = session ? 16 : 28;
    const size = span / N;
    const b = Array.from({ length: N }, (_, i) => ({ t0: start + i * size, lk: 0, inj: 0 }));
    for (const e of events) {
      let idx = Math.floor((e.ts - start) / size);
      if (idx < 0) idx = 0; if (idx >= N) idx = N - 1;
      if (e.kind === "injection") b[idx].inj++; else b[idx].lk++;
    }
    return b;
  }, [events, scope, sessionStart]);

  const max = Math.max(1, ...buckets.map(b => b.lk + b.inj));
  const session = scope === "session";

  return (
    <div className="panel chart-card">
      <div className="panel-title" style={{ marginBottom: 4 }}><Icon name="chart" />Activity over time</div>
      <div className="chart-wrap">
        {buckets.map((b, i) => (
          <div key={i} className="chart-bar">
            <div className="chart-tip">
              <div className="tt-time">{session ? fmtClock(b.t0) : `${fmtDay(b.t0)} ${fmtClock(b.t0)}`}</div>
              <div className="tt-row"><span className="sw" style={{ background: "var(--accent)" }} />{b.inj} injected</div>
              <div className="tt-row"><span className="sw" style={{ background: "var(--surface-hi)" }} />{b.lk} looked up</div>
            </div>
            <div className="chart-seg inj" style={{ height: `${b.inj / max * 160}px` }} />
            <div className="chart-seg lk" style={{ height: `${b.lk / max * 160}px` }} />
          </div>
        ))}
      </div>
      <div className="chart-axis">
        <span>{buckets[0] ? (session ? fmtClock(buckets[0].t0) : fmtDay(buckets[0].t0)) : ""}</span>
        <span>{session ? "now" : "today"}</span>
      </div>
      <div className="chart-legend">
        <div className="li"><span className="sw" style={{ background: "var(--accent)" }} />injections</div>
        <div className="li"><span className="sw" style={{ background: "var(--surface-hi)" }} />lookups</div>
      </div>
    </div>
  );
}

function TopTerms({ byTerm, metric, setMetric, navigate, sessionTerms, scope }: {
  byTerm: Record<string, { lookups: number; injections: number; lastUsed: number }>;
  metric: string; setMetric: (m: string) => void;
  navigate: (p: string) => void;
  sessionTerms: Set<string>; scope: string;
}) {
  const data = useMemo(() => {
    let rows = Object.entries(byTerm).map(([term, v]) => ({ term, ...v }));
    if (scope === "session") rows = rows.filter(r => sessionTerms.has(r.term));
    const maxL = Math.max(1, ...rows.map(r => r.lookups));
    const key = metric as "lookups" | "injections";
    rows.sort((a, b) => b[key] - a[key]);
    return rows.slice(0, 12).map(r => ({ ...r, ratio: r.lookups ? r.injections / r.lookups : 0, maxL }));
  }, [byTerm, metric, scope, sessionTerms]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title"><Icon name="arrowUp" />Top terms</div>
        <Segmented value={metric} onChange={setMetric} options={[
          { value: "lookups", label: "by lookups" }, { value: "injections", label: "by injections" }]} />
      </div>
      <div style={{ padding: "8px 10px 12px" }}>
        {data.length === 0 ? <Empty icon="chart" title="No activity in this session yet" /> : (
          <div className="toplist">
            {data.map((r, i) => {
              const leaky = r.lookups >= 20 && r.ratio < 0.3;
              return (
                <div key={r.term} className={["toprow", leaky && "leaky"].filter(Boolean).join(" ")}
                  onClick={() => navigate(`/glossary?term=${encodeURIComponent(r.term)}`)} title="View in glossary">
                  <span className="tt-term">
                    <span className="tt-rank">{i + 1}</span>{r.term}
                    {leaky && <Icon name="warn" size={12} style={{ color: "var(--amber)" }} />}
                  </span>
                  <div className="bars">
                    <div className="bar-track"><div className="bar-fill lk" style={{ width: `${r.lookups / r.maxL * 100}%` }} /></div>
                    <div className="bar-track"><div className="bar-fill inj" style={{ width: `${r.injections / r.maxL * 100}%` }} /></div>
                  </div>
                  <div className="tt-nums">
                    <span className="n-lk" title="lookups">{r.lookups}</span>
                    <span className="n-inj" title="injections">{r.injections}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EventFeed({ events }: { events: UsageEvent[] }) {
  const recent = useMemo(() => events.slice(-60).reverse(), [events]);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title"><Icon name="clock" />Recent events</div>
        <Badge>{events.length} buffered</Badge>
      </div>
      <div style={{ padding: "6px 14px 10px" }}>
        <div className="event-feed">
          {recent.length === 0 ? <div className="section-note" style={{ padding: 12 }}>No events yet.</div> : (
            recent.map((e, i) => (
              <div className="event-item" key={i}>
                <span className={["ev-kind", e.kind === "injection" ? "inj" : "lk"].filter(Boolean).join(" ")}>
                  <Icon name={e.kind === "injection" ? "arrowDown" : "search"} />
                </span>
                <span className="ev-term">{e.term}</span>
                <span className="ev-time">{relTime(e.ts)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function Usage() {
  const navigate = useNavigate();
  const usageQ = useQuery({ queryKey: ["usage"], queryFn: api.usage });
  const timelineQ = useQuery({ queryKey: ["timeline"], queryFn: () => api.timeline(2000) });
  const [scope, setScope] = useState("all");
  const [metric, setMetric] = useState("lookups");

  const u = usageQ.data;
  const allEvents = timelineQ.data?.events ?? [];

  // Determine current session from sessions map
  const sessions = u?.sessions ? Object.values(u.sessions) : [];
  const currentSession = sessions.sort((a, b) => b.lastUsed - a.lastUsed)[0];
  const sessionId = currentSession?.sessionId;
  const sessionStart = currentSession?.startedAt;

  const sessionEvents = useMemo(() => sessionId ? allEvents.filter(e => e.sessionId === sessionId) : [], [allEvents, sessionId]);
  const sessionTerms = useMemo(() => new Set(sessionEvents.map(e => e.term)), [sessionEvents]);
  const shownEvents = scope === "session" ? sessionEvents : allEvents;

  const totals = scope === "session"
    ? { lookups: currentSession?.lookups ?? 0, injections: currentSession?.injections ?? 0 }
    : u?.totals;

  const byTerm = u?.totals?.byTerm ?? {};
  const leakyTerms = useMemo(() =>
    Object.entries(byTerm)
      .filter(([, v]) => v.lookups >= 20 && v.injections / v.lookups < 0.3)
      .sort(([, a], [, b]) => b.lookups - a.lookups)
      .map(([term]) => term),
    [byTerm]);

  const loading = (usageQ.isLoading && !u) || (timelineQ.isLoading && !timelineQ.data);

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1 className="page-h1">Usage</h1>
        <p className="page-desc">How often terms are looked up versus actually injected. A high lookup count with few injections usually means a pattern isn't matching.</p>
      </div>

      <div className="usage-scopebar">
        <Segmented value={scope} onChange={setScope} options={[
          { value: "all", icon: "globe", label: "All time" },
          { value: "session", icon: "terminal", label: "This session" }]} />
        {scope === "session" && sessionId && (
          <span className="section-note">session {sessionId.slice(0, 12)} · {sessionEvents.length} events</span>
        )}
      </div>

      {usageQ.isError ? (
        <div className="panel" style={{ padding: 16 }}><ErrBanner message={String(usageQ.error)} onRetry={() => usageQ.refetch()} /></div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Lookups" icon="search" value={loading ? "—" : (totals?.lookups ?? 0).toLocaleString()} sub={scope === "all" ? "all time" : "this session"} />
            <StatCard label="Injections" icon="arrowDown" value={loading ? "—" : (totals?.injections ?? 0).toLocaleString()} sub={scope === "all" ? "all time" : "this session"} />
            <StatCard label="Inject rate" icon="zap"
              value={loading || !totals?.lookups ? "—" : Math.round(totals.injections / totals.lookups * 100) + "%"}
              sub="injections ÷ lookups" />
            <StatCard label="Distinct terms" icon="hash"
              value={loading ? "—" : (scope === "session" ? sessionTerms.size : Object.keys(byTerm).length)}
              sub={scope === "session" ? "touched this session" : "with activity"} />
          </div>

          {scope === "all" && leakyTerms.length > 0 && (
            <div className="section">
              <div className="leaky-banner">
                <Icon name="warn" />
                <div>
                  <b>{leakyTerms.length} terms are looked up often but rarely injected.</b>{" "}
                  This usually points to a pattern that isn't matching real text. Worth checking:{" "}
                  <span className="terms">{leakyTerms.slice(0, 4).join(", ")}</span>.
                </div>
              </div>
            </div>
          )}

          <div className="section">
            {loading ? <div className="panel" style={{ padding: 20 }}><SkeletonLines n={5} /></div>
              : <TimelineChart events={shownEvents} scope={scope} sessionStart={sessionStart} />}
          </div>

          <div className="section two-col">
            {loading ? <div className="panel" style={{ padding: 20 }}><SkeletonLines n={6} /></div>
              : <TopTerms byTerm={byTerm} metric={metric} setMetric={setMetric} navigate={navigate} sessionTerms={sessionTerms} scope={scope} />}
            {loading ? <div className="panel" style={{ padding: 20 }}><SkeletonLines n={6} /></div>
              : <EventFeed events={shownEvents} />}
          </div>
        </>
      )}
    </div>
  );
}
