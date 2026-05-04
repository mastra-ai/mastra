---
'@mastra/duckdb': patch
---

Improved `listTraces` and `listBranches` performance on DuckDB. Both queries now prefilter raw `span_events` on scalar columns before reconstructing rows, and when no post-aggregation filters are in play, ordering and pagination happen inside the prefilter so reconstruction only touches the rows on the current page. `listTraces` also runs `hasChildError` directly against raw `span_events` instead of the reconstructed-spans CTE. The `SpanRecord` shape returned to callers is unchanged.
