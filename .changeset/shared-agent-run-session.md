---
'@mastra/core': patch
'@mastra/inngest': patch
---

Internal: durable and Inngest agents now share one helper for wiring a caller's `abortSignal` into a run. No behavior change.
