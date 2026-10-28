---
'@mastra/playground-ui': minor
---

The Metrics page **Latency** card now charts P99 alongside P50 and P95 for agent runs, workflow runs and tool calls, so slow outliers show up without opening traces. It also loads only the tab you have open, instead of all three at once.

`useMetricsLatency(entity)` now takes the entity type to load, and its buckets use `p50`, `p95` and `p99` keys.
