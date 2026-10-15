---
'@mastra/server': minor
---

Added `traceAggregate` to `GET /observability/capabilities`, so clients can tell whether `POST /observability/traces/aggregate` is available. Trace-scope field discovery (`POST /observability/traces/query/fields`) now also returns an `aggregate` block listing the groupable dimensions and available measures when the store supports aggregation.
