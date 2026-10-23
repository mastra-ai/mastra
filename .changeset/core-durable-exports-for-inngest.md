---
'@mastra/core': patch
---

Exported durable-agent helpers that `@mastra/inngest` reuses instead of copying: `applyReservedMemoryContextKeys`, `emitAbortEvent`, `createDurableIsTaskCompleteStep` and `createDurableGoalStep` from `@mastra/core/agent/durable`, and `createTimeoutAbortSignal` from `@mastra/core/loop`.

Fixed `observe().abort()` on a durable run parked on a tool approval or suspension: it now releases the run like the stream `abort()` does, so a later `approveToolCall()` or `resumeStream()` is rejected instead of continuing the aborted run.

Fixed an empty step text on durable agents when an output processor holds parts (such as `BatchPartsProcessor`) and the `step-start` event reached the stream after those parts were released. The run that holds the output processors now runs them on `step-start` itself, like every other chunk, so each processor sees it exactly once. A processor that throws on `step-start` now fails the run with an `error` chunk and `finishReason: 'error'`, matching a throw on any other chunk, instead of throwing from `fullStream`.
