// Public API
export type {
  GlossaryEntry,
  GlossaryConfig,
  SessionState,
  LoadedGlossary,
  GlossaryFile,
  InjectionResult,
  MatchResult,
} from "./core/types.js";
export { DEFAULT_CONFIG } from "./core/types.js";

export { loadGlossary, loadGlossaryByScope } from "./core/loader.js";
export { matchEntries, buildEntryRegex } from "./core/matcher.js";
export { buildInjection } from "./core/injector.js";
export { addTerm, editTerm, removeTerm } from "./core/store.js";
export { loadSession, saveSession, markTermsLoaded, resetSession } from "./core/session.js";
export { loadConfig } from "./core/config.js";
export { expandTemplates, expandCrossRefs, expandDefinition } from "./core/expander.js";
