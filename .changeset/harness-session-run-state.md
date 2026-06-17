---
'@mastra/core': patch
---

Move Harness run identity onto the Session class.

The transient per-run state — current run id, trace id, and the monotonic
operation counter — now lives on `session.run` (`SessionRun`) instead of being
flattened on the Harness:

- `getRunId()` / `setRunId({ runId })`
- `getTraceId()` / `setTraceId({ traceId })`
- `reset()` — clears run id and trace id when a run ends
- `nextOperation()` — bumps the operation counter at the start of a new operation

This is transient scratch state and is never persisted. The Harness still owns
the live agent subscription (`activeRunId()`) and the public
`getCurrentRunId()` / `getCurrentTraceId()` accessors, which now delegate to
`session.run`, so external consumers are unaffected.
