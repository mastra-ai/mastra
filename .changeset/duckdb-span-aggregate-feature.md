---
'@mastra/duckdb': patch
---

DuckDB now reports that it supports span aggregation. The store has answered `aggregateSpans()` since it was added, but `DuckDBStore` never listed the `span-aggregate` feature, so the server's capabilities said `spanAggregate: false` and Studio's Metrics page fell back to its older layout.
