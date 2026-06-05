import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.ts";
import { Icon, ToastProvider } from "./components/ui.tsx";
import { CommandPalette } from "./components/CommandPalette.tsx";

const NAV = [
  { to: "/", label: "Overview", icon: "overview", end: true },
  { to: "/glossary", label: "Glossary", icon: "book" },
  { to: "/usage", label: "Usage", icon: "chart" },
  { to: "/config", label: "Config", icon: "sliders" },
];

const SCREEN_META: Record<string, { title: string; sub: string }> = {
  "/":         { title: "Overview",  sub: "discovery · merge order · session" },
  "/glossary": { title: "Glossary",  sub: "browse · edit · test patterns" },
  "/usage":    { title: "Usage",     sub: "lookups · injections · timeline" },
  "/config":   { title: "Config",    sub: "resolution stack · effective values" },
};

function useThemePref(): [string, (v: string) => void] {
  const [pref, setPref] = useState(() => localStorage.getItem("gloss-theme") || "system");
  useEffect(() => {
    const apply = () => {
      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const resolved = pref === "system" ? sys : pref;
      document.documentElement.setAttribute("data-theme", resolved);
    };
    apply();
    localStorage.setItem("gloss-theme", pref);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => pref === "system" && apply();
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [pref]);
  return [pref, setPref];
}

export function App() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 30_000 });
  const entries = useQuery({ queryKey: ["entries", "merged"], queryFn: () => api.entries("merged") });
  const [pref, setPref] = useThemePref();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const meta = SCREEN_META[location.pathname] || { title: "Glossary", sub: "" };
  const healthy = health.data?.ok !== false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refreshAll = () => queryClient.invalidateQueries();

  return (
    <ToastProvider>
      <div className="app">
        {/* ---- sidebar ---- */}
        <aside className="side">
          <div className="brand">
            <div className="brand-mark">G</div>
            <div>
              <div className="brand-name">glossary</div>
              <div className="brand-ver">v{health.data?.version ?? "—"}</div>
            </div>
          </div>

          <nav className="nav">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => ["nav-item", isActive && "on"].filter(Boolean).join(" ")}>
                <Icon name={n.icon} />
                {n.label}
                {n.to === "/glossary" && entries.data && (
                  <span className="count">{entries.data.entries.length}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="side-foot">
            <button className="cmdk-hint" onClick={() => setPaletteOpen(true)}>
              <Icon name="search" />
              <span>Search…</span>
              <span className="keys"><span className="kbd">⌘</span><span className="kbd">K</span></span>
            </button>
          </div>
        </aside>

        {/* ---- main ---- */}
        <div className="main">
          <header className="topbar">
            <span className="topbar-title">{meta.title}</span>
            {meta.sub && <span className="topbar-sub">{meta.sub}</span>}
            <div className="topbar-spacer" />

            <div className={["health", !healthy && "bad"].filter(Boolean).join(" ")}>
              <span className="pulse" />
              {healthy ? "online" : "offline"}
            </div>

            <div className="theme-toggle" role="group" aria-label="Theme">
              {(["light", "dark", "system"] as const).map((v, i) => (
                <button key={v} className={pref === v ? "on" : ""} onClick={() => setPref(v)}
                  title={`${v} theme`} aria-label={`${v} theme`}>
                  <Icon name={i === 0 ? "sun" : i === 1 ? "moon" : "monitor"} />
                </button>
              ))}
            </div>
          </header>

          <div className="scroll">
            <Outlet />
          </div>
        </div>
      </div>

      {paletteOpen && (
        <CommandPalette
          entries={entries.data?.entries ?? []}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(to) => { navigate(to); setPaletteOpen(false); }}
          onTheme={setPref}
          onRefresh={refreshAll}
        />
      )}
    </ToastProvider>
  );
}
