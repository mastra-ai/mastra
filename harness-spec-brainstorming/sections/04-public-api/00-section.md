## 4. Public API

This chapter is the authoritative declaration of the TypeScript surface a
Harness host program calls. Earlier vocabulary sections frame the concepts;
§4 is where the method signatures, option types, error classes, and shared
public types are pinned down.

The children below own the canonical declarations. Shared public type names
and import ownership live in §4.8, so earlier children may reference those
names directly instead of repeating their declarations.

- §4.1 Harness — top-level `Harness` API: lifecycle, sessions, channels,
  threads, catalogs, cross-session subscriptions, and background task
  observation.
- §4.2 Session — the per-session surface: state/mode/model, operations,
  skill discovery, messages/thread/display, inbox/permissions/OM/workspace/
  goals, and the required-agent signal/resume boundaries.
- §4.3 Per-turn overrides — the rules for `model` / `mode` / `addTools` /
  `yolo` overrides that apply to `message`, `useSkill`, and the serializable
  subset accepted by `queue`.
- §4.4 Operation option types — the option-bag declarations used across the
  Harness/Session surface: list/message options, queue and skill options,
  request-context options, inbox-response options, and thread/file options.
- §4.5 Errors — the typed `Harness*Error` class hierarchy: admission,
  channel, inbox, session lifecycle, abort, storage, state, workspace, and
  lock-class errors. The wire projection of these classes lives in §13.3f.
- §4.6 Skills — the `useSkill(...)` contract and the two skill sources
  (code-registered and workspace-resolved) that feed it.
- §4.7 Goals — the goal lifecycle, judge-decision contract, and continuation
  / waiting / done outcomes.
- §4.8 Public type surface — the shared public types, the canonical import
  map, message/result/stream shapes, background task projections, remote-safe
  supporting types, and the portable `RemoteSafeSession` declaration.
