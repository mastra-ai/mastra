---
'@mastra/duckdb': minor
---

Added `aggregateSpans()` to the DuckDB observability store, so `POST /observability/spans/aggregate` works with DuckDB. The store now reports the `span-aggregate` feature.

DuckDB now stores each span's parent and root entity (type, ID, name), and `querySpans()` returns them and the span's execution source instead of `null`. Spans written before this change keep `null` for the parent and root entity fields.
