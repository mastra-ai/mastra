---
'@mastra/server': minor
---

Added `spanQueryOutcomeFields` and `traceQueryOutcomeFields` to the observability capabilities response. Span and trace query, aggregate, and discovery routes return `501` when a request uses `outcome` or `stopReason` against a store that does not support them.
