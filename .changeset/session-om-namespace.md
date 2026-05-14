---
'@mastra/core': minor
---

Harness v1 — `session.om` Observational Memory namespace shipped.

- `session.om.getObserverModelId()` / `session.om.getReflectorModelId()`
  resolve the model used to observe / reflect, falling back through the
  session record, harness `omConfig` defaults, and finally `null`.
- `session.om.getObservationThreshold()` /
  `session.om.getReflectionThreshold()` resolve token thresholds with the
  same fallback chain plus built-in defaults.
- `session.om.switchObserverModel({ model })` /
  `session.om.switchReflectorModel({ model })` persist the override on the
  session record under the session lease and emit `om_model_changed`.
- `session.om.getRecord()` reads the row from memory storage and projects
  it through a strict allow-list redactor into `ObservationalMemorySnapshot`
  (no raw config / metadata / buffered chunks / processor internals
  exposed). Returns `null` when no record exists or memory storage isn't
  configured.
- `session.om.loadProgress()` is an advisory no-op for now (future cache
  refresh hook).
- New `ObservationalMemorySnapshot` and `HarnessOMConfig` types and
  `OmModelChangedEvent`. `HarnessConfig.omConfig` carries the harness-wide
  defaults.
- `session.om` is available on `RemoteSafeSession` (privileged read, but
  remote-safe — only redacted projection ever leaves the session).

Internal-only API; no breaking changes.
