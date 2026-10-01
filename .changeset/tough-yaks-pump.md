---
'@mastra/pg': minor
---

Added `aggregateTraces()` support to the PostgreSQL observability store. The store now advertises the `trace-aggregate` capability and returns grouped counts, error rates, duration statistics, and time-bucketed series over the same traces that `queryTraces()` selects.
