---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/react': patch
'mastra': patch
---

Added `POST /observability/spans/aggregate`, which groups and measures individual spans (counts, durations, error rates, tokens, cost) over a time window. `GET /observability/capabilities` now reports `spanAggregate`; the route returns 501 when the configured observability store does not support span aggregation.
