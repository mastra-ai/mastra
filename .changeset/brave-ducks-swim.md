---
'@mastra/duckdb': patch
---

Trace lists load faster. `queryTraces()` now reads a trace's input, output, error and metadata only for the rows it returns, and builds their previews in DuckDB.
