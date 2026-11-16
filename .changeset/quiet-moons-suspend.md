---
'@mastra/core': patch
---

Fixed background tasks on a durable agent with memory failing with `DURABLE_AGENT_EXECUTION_UNVERIFIED` when the task suspended after the run that dispatched it had already finished.

The background task's `suspend()` first awaited the finished run's own suspension bookkeeping. That bookkeeping flushes memory before parking the run, and the flush re-checks that the execution still owns the run — which a settled run can no longer prove. The rejection then propagated out of the task instead of reaching the task's own suspension, so the task was recorded as `failed` and could not be resumed. A task's suspension is now independent of the run that dispatched it: execution-ownership errors (such as `DURABLE_AGENT_EXECUTION_UNVERIFIED` and `DURABLE_AGENT_EXECUTION_SUPERSEDED`) are skipped, and other errors still propagate.
