---
'@mastra/core': patch
---

Exported durable-agent helpers that `@mastra/inngest` reuses instead of copying: `applyReservedMemoryContextKeys`, `emitAbortEvent`, `createDurableIsTaskCompleteStep` and `createDurableGoalStep` from `@mastra/core/agent/durable`, and `createTimeoutAbortSignal` from `@mastra/core/loop`.
