---
'@mastra/core': patch
---

Keep durable and evented agent execution running when an active `untilIdle` stream reader is cancelled, including resumed streams. Reader cancellation now detaches the observer without aborting the underlying run. Reattach with `observe(runId)` to follow its progress. Use `abortRunStream(runId)`, `abortThreadStream()`, or an execution `abortSignal` to explicitly cancel an active run; ordinary agents retain their existing cancellation behavior.
