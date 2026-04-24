---
'@mastra/duckdb': patch
---

Speed up `listTraces` on DuckDB by splitting the query into a cheap scalar prefilter against raw `span_events` (start rows only, `parentSpanId IS NULL`) and a full reconstruction that runs only on the narrowed set. When no post-aggregation filters are in play, ordering and pagination happen inside the prefilter CTE so reconstruction touches at most one page of rows. `hasChildError` now runs directly against raw `span_events` instead of the reconstructed-spans CTE. API contract is unchanged.
