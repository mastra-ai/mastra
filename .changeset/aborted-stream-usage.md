---
'@mastra/core': patch
---

Fixed aborted agent streams reporting empty token usage. When a stream is aborted, `onFinish` now receives the usage of steps that completed before the abort: `totalUsage` is the sum across those steps and `usage` is the last completed step. Cancelled runs are no longer under-reported in observability and cost tracking. If no step completed before the abort, `usage` and `totalUsage` still have undefined token counts.
