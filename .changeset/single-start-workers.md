---
'@mastra/core': patch
---

Fixed workflow steps running twice when `mastra.startWorkers()` runs at the same time as a lazy worker start (for example, a background task or durable agent dispatched during startup). Concurrent starts now share a single subscription per worker, and `stopWorkers()` waits for any in-progress start so no subscription is left behind.
