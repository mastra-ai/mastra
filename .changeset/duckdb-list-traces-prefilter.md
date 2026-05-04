---
'@mastra/duckdb': patch
---

Improved `listTraces` performance on DuckDB. The query now prefilters raw `span_events` on scalar columns and `parentSpanId IS NULL` before reconstructing rows, and when no post-aggregation filters are in play, ordering and pagination happen inside the prefilter so reconstruction only touches the rows on the current page. `hasChildError` runs directly against raw `span_events` instead of the reconstructed-spans CTE. The `SpanRecord` shape returned to callers is unchanged.
