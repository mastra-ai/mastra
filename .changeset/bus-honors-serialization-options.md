---
'@mastra/observability': patch
---

ObservabilityBus now honors per-instance `serializationOptions` (maxStringLength, maxDepth, maxArrayLength, maxObjectKeys) when deep-cleaning log/metric/score/feedback payloads, matching the behavior of tracing spans. Previously these signals always used the built-in defaults regardless of user configuration.
