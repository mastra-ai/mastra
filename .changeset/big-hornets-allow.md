---
'@mastra/core': patch
---

Fixed background tasks never completing when Mastra is used as a library. When running without `mastra start` (for example inside an Express server), nothing calls `startWorkers()`, so dispatched background tasks — including backgrounded sub-agent delegations — were picked up but never ran to completion. Workers now start automatically when the first background task is dispatched — whether from a backgrounded sub-agent delegation, a direct `createBackgroundTask()`, a restart or resume, or stale-task recovery after a process restart — so background tasks complete without any manual `startWorkers()` call. Only the background-task execution workers are started: the scheduler and agent-schedule workers are never booted as a side effect of dispatching a task. Fixes [#19339](https://github.com/mastra-ai/mastra/issues/19339).
