---
'@mastra/core': patch
---

Keep durable and evented agents running when an active `untilIdle` reader disconnects, including resumed streams. Background tasks can still complete and produce a saved final answer.

Reconnect with `observe(runId)`. To cancel execution, use `abortRunStream(runId)`, `abortThreadStream()`, or an execution `abortSignal`. Ordinary agents keep their existing cancellation behavior.
