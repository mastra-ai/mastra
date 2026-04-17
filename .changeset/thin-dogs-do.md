---
'@mastra/core': minor
---

Preserve full iteration history for `.dountil()` / `.dowhile()` loop steps on the step result under `metadata.iterations` (and `metadata.iterationCount`). Each entry records `iterationIndex`, `output`, `status`, `startedAt`, and `endedAt` for that iteration. The step's top-level `output` still reflects the latest iteration, so this change is fully backward compatible.

This makes it possible to inspect or reason about any past iteration of a loop (for debugging, tracing, or state reconstruction) without using `setState()` as a workaround. `.foreach()` is unaffected — it already stores per-item results in its output array.

Also fixes an adjacent bug in the evented workflow engine where `perStep`, `state`, and `outputOptions` were not forwarded into `processWorkflowLoop`, causing them to be `undefined` on the pubsub events emitted from loop iterations.
