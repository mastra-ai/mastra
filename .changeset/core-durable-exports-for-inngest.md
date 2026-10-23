---
'@mastra/core': patch
---

Exported durable-agent helpers that `@mastra/inngest` reuses instead of copying: `applyReservedMemoryContextKeys`, `emitAbortEvent`, `createDurableIsTaskCompleteStep` and `createDurableGoalStep` from `@mastra/core/agent/durable`, and `createTimeoutAbortSignal` from `@mastra/core/loop`.

Fixed `observe().abort()` on a durable run parked on a tool approval or suspension: it now releases the run like the stream `abort()` does, so a later `approveToolCall()` or `resumeStream()` is rejected instead of continuing the aborted run.

Added a `skipOutputProcessorsOnStepStart` option to `createDurableAgentStream` for engines that deliver `step-start` asynchronously. With it set, a processor that holds parts (such as `BatchPartsProcessor`) can no longer hold a late `step-start` past the step's text and leave the step text empty. Default behavior is unchanged.
