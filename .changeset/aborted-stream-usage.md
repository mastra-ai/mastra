---
'@mastra/core': patch
---

Fixed aborted agent streams reporting empty token usage. When a stream is aborted, `onFinish` now receives the usage of steps that completed before the abort: `totalUsage` is the sum across those steps and `usage` is the last completed step. The model generation span is closed with that same usage instead of `usage: {}`, so cancelled runs are no longer under-reported in cost tracking. Usage remains undefined when no step completed before the abort.
