---
'@mastra/core': minor
---

Harness v1: ship `Session.abort()` + `Session.isRunning()` and `Harness.listModes()` / `Harness.getMode()`.

- `Session.abort(opts?: { reason?: string })` cancels the in-flight turn (message, queued, or resume). Decoupled from messaging — `abort` is its own primitive per spec §4.2.
- `Session.isRunning()` returns `true` while a turn is in flight, `false` otherwise. Backed by a session-owned `AbortController` that wraps any caller-supplied `abortSignal`, so `session.abort()` cancels both the harness-internal run and any external listener.
- `Harness.listModes()` enumerates every registered mode in declaration order (fresh array per call). `Harness.getMode(id)` returns a single mode or `undefined`.
- Internal: turn entry/exit goes through `_beginTurn` / `_endTurn` helpers wrapping `message`, queue-drain, and resume in try/finally so `isRunning()` flips back to `false` on every exit path including throws.

Internal-only API; no breaking changes to existing surfaces.
