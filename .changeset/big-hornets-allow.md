---
'@mastra/core': patch
---

Fixed background tasks never completing when Mastra is used as a library. When running without `mastra start` (for example inside an Express server), nothing calls `startWorkers()`, so dispatched background tasks — including backgrounded sub-agent delegations — were picked up but never ran to completion. Agents now start the workers automatically on first use when a background task manager is configured, so background tasks complete without any manual `startWorkers()` call. Fixes [#19339](https://github.com/mastra-ai/mastra/issues/19339).
