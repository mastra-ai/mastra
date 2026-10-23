---
'@mastra/core': patch
---

Exported durable-agent helpers that `@mastra/inngest` reuses instead of copying: `applyReservedMemoryContextKeys`, `emitAbortEvent`, `createDurableIsTaskCompleteStep` and `createDurableGoalStep` from `@mastra/core/agent/durable`, and `createTimeoutAbortSignal` from `@mastra/core/loop`.

Fixed `observe().abort()` on a durable run parked on a tool approval or suspension: it now releases the run like the stream `abort()` does, so a later `approveToolCall()` or `resumeStream()` is rejected instead of continuing the aborted run.
