---
'@mastra/duckdb': patch
---

Fixed `aggregateTraces()` on DuckDB failing with a Binder Error when grouping by `executionSource` or counting distinct `executionSource` values. These requests now return one row per execution source (such as `cloud` or `local`), including a row for traces without one.
