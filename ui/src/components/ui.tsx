import React, {
  createContext, useContext, useCallback, useMemo, useState, useEffect, useRef,
  type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes,
} from "react";

/* ===================== ICONS ===================== */
const ICONS: Record<string, string> = {
  overview:  '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  book:      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/>',
  chart:     '<path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/>',
  sliders:   '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  trash:     '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  check:     '<path d="M20 6L9 17l-5-5"/>',
  x:         '<path d="M18 6L6 18M6 6l12 12"/>',
  chevR:     '<path d="M9 18l6-6-6-6"/>',
  chevD:     '<path d="M6 9l6 6 6-6"/>',
  dot:       '<circle cx="12" cy="12" r="4"/>',
  file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  layers:    '<path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  link:      '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  tag:       '<path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  command:   '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6z"/>',
  sun:       '<circle cx="12" cy="12" r="4.5"/><path d="M12 1v2.5M12 20.5V23M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1 12h2.5M20.5 12H23M4.2 19.8L6 18M18 6l1.8-1.8"/>',
  moon:      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor:   '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  warn:      '<path d="M10.3 3.3L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  copy:      '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit:      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  play:      '<path d="M5 3l16 9-16 9z"/>',
  refresh:   '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  list:      '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  columns:   '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
  grid:      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  terminal:  '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  alert:     '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  info:      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowUp:   '<path d="M12 19V5M5 12l7-7 7 7"/>',
  eye:       '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:    '<path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c7 0 11 8 11 8a17 17 0 0 1-2.6 3.6M6.6 6.6A17 17 0 0 0 1 12s4 8 11 8a9.5 9.5 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M1 1l22 22"/>',
  pin:       '<path d="M9 4v6l-2 4h10l-2-4V4M12 14v7M9 4h6"/>',
  flask:     '<path d="M9 2v6L4 18a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 18L15 8V2M9 2h6M7.5 13h9"/>',
  hash:      '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  folder:    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  globe:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  enter:     '<path d="M9 10l-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
  zap:       '<path d="M13 2L3 14h8l-1 8 10-12h-8z"/>',
};

export function Icon({ name, size, className, style }: {
  name: string; size?: number; className?: string; style?: React.CSSProperties;
}) {
  const path = ICONS[name] || ICONS.dot;
  return (
    <svg className={className} style={style} width={size || 16} height={size || 16}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }} />
  );
}

/* ===================== BUTTON ===================== */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm";
  icon?: string;
  iconRight?: string;
}
export function Button({ variant, size, icon, iconRight, children, className = "", ...rest }: BtnProps) {
  const cls = ["btn", variant && `btn--${variant}`, size && `btn--${size}`, className].filter(Boolean).join(" ");
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
}

export function IconButton({ icon, active, size, title, className = "", ...rest }:
  { icon: string; active?: boolean; size?: "sm"; title?: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["iconbtn", size && `iconbtn--${size}`, active && "is-active", className].filter(Boolean).join(" ");
  return <button className={cls} title={title} aria-label={title} {...rest}><Icon name={icon} /></button>;
}

/* ===================== BADGE ===================== */
export function Badge({ tone, dot, children, className = "", ...rest }:
  { tone?: string; dot?: boolean; children?: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={["badge", tone && `badge--${tone}`, className].filter(Boolean).join(" ")} {...rest}>
    {dot && <span className="dot" />}{children}
  </span>;
}

export function TagChip({ children, ...rest }: { children: ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className="tag-chip" {...rest}>{children}</span>;
}

export function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, [string, string, string]> = {
    project: ["accent", "folder", "project"],
    global: ["blue", "globe", "global"],
    system: ["violet", "sliders", "system"],
  };
  const [tone, icon, label] = map[tier] || ["", "file", tier];
  return <Badge tone={tone}><Icon name={icon} size={11} />{label}</Badge>;
}

/* ===================== SWITCH ===================== */
export function Switch({ on, onChange, disabled, title }: {
  on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; title?: string;
}) {
  return <button className={["switch", on && "on"].filter(Boolean).join(" ")} disabled={disabled}
    title={title} aria-pressed={on} role="switch"
    onClick={(e) => { e.stopPropagation(); onChange && onChange(!on); }} />;
}

/* ===================== SEGMENTED ===================== */
export function Segmented({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label?: string; icon?: string; title?: string }>;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}
          role="tab" aria-selected={value === o.value} title={o.title || o.label}>
          {o.icon && <Icon name={o.icon} />}{o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ===================== FIELD / INPUT / TEXTAREA ===================== */
export function Field({ label, hint, error, children }: {
  label?: string; hint?: string; error?: string | null; children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      {children}
      {error ? <div className="field-err"><Icon name="warn" size={12} />{error}</div>
        : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function Input({ mono, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={["input", mono && "input--mono", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={["textarea", className].filter(Boolean).join(" ")} {...rest} />;
}

/* ===================== MODAL / CONFIRM ===================== */
export function Modal({ onClose, children, width }: { onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" style={width ? { width } : undefined} onMouseDown={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel = "Confirm", danger, busy, onConfirm, onClose }: {
  title: string; text: string; confirmLabel?: string; danger?: boolean;
  busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal onClose={busy ? () => {} : onClose}>
      <div className="modal-body">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-text">{text}</p>
      </div>
      <div className="modal-foot">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}
          icon={busy ? undefined : (danger ? "trash" : "check")}>
          {busy ? <span className="spinner" /> : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ===================== TOAST ===================== */
interface ToastItem { id: string; kind: "success" | "error" | "info"; msg: string; sub?: string; duration?: number; }
interface ToastApi {
  success: (msg: string, sub?: string) => void;
  error: (msg: string, sub?: string) => void;
  info: (msg: string, sub?: string) => void;
}
const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, ...t }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.duration || 3800);
  }, []);
  const api = useMemo<ToastApi>(() => ({
    success: (msg, sub) => push({ kind: "success", msg, sub }),
    error: (msg, sub) => push({ kind: "error", msg, sub, duration: 5200 }),
    info: (msg, sub) => push({ kind: "info", msg, sub }),
  }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <Icon name={t.kind === "success" ? "check" : t.kind === "error" ? "warn" : "info"} />
            <div><div className="toast-msg">{t.msg}</div>{t.sub && <div className="toast-sub">{t.sub}</div>}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

/* ===================== MISC ===================== */
export function Empty({ icon = "search", title, text, children }: {
  icon?: string; title: string; text?: string; children?: ReactNode;
}) {
  return <div className="empty"><Icon name={icon} /><div className="empty-title">{title}</div>
    {text && <div className="empty-text">{text}</div>}{children}</div>;
}

export function ErrBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="err-banner"><Icon name="warn" />
    <span>{message}</span>{onRetry && <button className="retry" onClick={onRetry}>retry</button>}</div>;
}

export function Spinner() { return <span className="spinner" />; }

export function SkeletonLines({ n = 3 }: { n?: number }) {
  return <div>{Array.from({ length: n }).map((_, i) => (
    <div key={i} className="skel sk-row" style={{ width: `${90 - i * 12}%` }} />
  ))}</div>;
}

export function StatCard({ label, icon, value, sub }: {
  label: string; icon?: string; value: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{icon && <Icon name={icon} />}{label}</div>
      <div className="stat-value mono-num">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* ===================== CHIP INPUT ===================== */
export function ChipInput({ values, onChange, placeholder, prefix }: {
  values: string[]; onChange: (v: string[]) => void; placeholder?: string; prefix?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (v: string) => { v = v.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft(""); };
  const remove = (v: string) => onChange(values.filter(x => x !== v));
  return (
    <div className="chip-input" onClick={() => inputRef.current?.focus()}>
      {values.map(v => (
        <span className="chip" key={v}>{prefix}{v}
          <button type="button" onClick={() => remove(v)} aria-label={`remove ${v}`}><Icon name="x" /></button>
        </span>
      ))}
      <input ref={inputRef} value={draft} placeholder={values.length ? "" : placeholder} spellCheck={false}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && values.length) remove(values[values.length - 1]);
        }}
        onBlur={() => draft && add(draft)} />
    </div>
  );
}

/* ===================== RELATIVE TIME ===================== */
export function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.round(s / 60); if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
