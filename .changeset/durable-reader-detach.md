---
'@mastra/core': patch
---

Allow server-owned HTTP observers of durable and evented `untilIdle` runs to detach without aborting execution, including resumed streams. Detached loops continue processing background tasks and saving the final answer, while explicit run and thread cancellation remain effective.

Direct in-process reader cancellation still aborts active execution by default. The server opts into observer-only cancellation internally; ordinary agents retain their existing cancellation behavior.
