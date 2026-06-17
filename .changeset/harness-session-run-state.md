---
'@mastra/core': patch
'mastracode': patch
---

Move Harness run identity and abort control onto the Session class.

The transient per-run state now lives on `session.run` (`SessionRun`) instead
of being flattened on the Harness:

- run identity — `getRunId()` / `setRunId({ runId })`, `getTraceId()` /
  `setTraceId({ traceId })`, and `nextOperation()` (monotonic operation counter)
- abort control — `ensureAbortController()`, `getAbortSignal()`,
  `isRunning()` / `hasAbortController()`, `clearAbortRequested()`,
  `isAbortRequested()`, and `requestAbort()` (fires the controller and marks
  the run aborting)
- `reset()` — clears run id, trace id, and abort state when a run ends

This is transient scratch state and is never persisted.

The pure pass-through accessors `Harness.isRunning()` and
`Harness.getCurrentTraceId()` are **removed** — read these through the session
instead (`harness.session.run.isRunning()` /
`harness.session.run.getTraceId()`). `Harness.abort()` and
`Harness.getCurrentRunId()` are kept, because they compose the Harness-private
agent subscription rather than being simple delegators; they will move once the
subscription itself is owned by the session.
