---
'@mastra/duckdb': minor
---

**Added** `listBranches` and `getSpans` implementations. Both reuse the existing `arg_max(field, timestamp) FILTER` reconstruction CTE with a `spanType IN (...)` prefilter on raw `span_events`, so no new tables or migrations are needed and historical span data is queryable immediately.
