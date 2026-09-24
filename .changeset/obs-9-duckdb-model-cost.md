---
'@mastra/duckdb': minor
---

Added DuckDB support for filtering and ordering trace queries by `modelCost`, and for returning it in the table summary. Unavailable costs stay `NULL` and cost ordering pages deterministically with `traceId` as the tie-breaker.
