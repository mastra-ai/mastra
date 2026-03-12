---
'@mastra/observability': minor
---

Updated exporters and event bus to use renamed observability types from `@mastra/core`. Added `EventBuffer` for batching non-tracing signals with configurable flush intervals.

**Breaking changes:**

- `ObservabilityBus` now takes a config object in its constructor (`cardinalityFilter`, `autoExtractMetrics`); `setCardinalityFilter()` and `enableAutoExtractedMetrics()` removed
