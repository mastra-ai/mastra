---
'@mastra/observability': minor
---

Auto-attach the Mastra-level `environment` to every observability signal: spans, logs, metrics, scores, and feedbacks.

When a parent `Mastra` instance has `environment` configured (or `process.env.NODE_ENV` set), `Observability` propagates it during `setMastraContext` and `startSpan` injects it into the root span's metadata when not explicitly provided. Child spans inherit through metadata propagation, and the value is persisted on the `SpanRecord` so stored scores and feedbacks emitted via `RecordedSpan` / `RecordedTrace.addScore` carry it on `correlationContext.environment` too. Per-call `tracingOptions.metadata.environment` always takes precedence.
