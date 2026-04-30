---
'@mastra/observability': minor
---

Auto-attach the Mastra-level `environment` to every span, log, and metric.

When a parent `Mastra` instance has `environment` configured (or `process.env.NODE_ENV` set), `Observability` propagates it to every registered instance during `setMastraContext`. Spans use it as a fallback for `CorrelationContext.environment` when `metadata.environment` is not set on a specific call.
