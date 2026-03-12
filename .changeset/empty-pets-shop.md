---
'@mastra/observability': minor
---

Updated exporters and event bus to use renamed observability types from `@mastra/core`. Added `EventBuffer` to the ObservabilityBus for batching non-tracing signals (scores, logs, metrics, feedback) with configurable flush intervals.
