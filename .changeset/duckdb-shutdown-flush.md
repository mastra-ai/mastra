---
'@mastra/core': patch
'@mastra/duckdb': patch
'@mastra/code-sdk': patch
---

Flush observability exporters before closing storage on Mastra shutdown, so final spans persist when using DuckDB. Release DuckDB file locks on shutdown, including composed observability storage, concurrent operations, and public connection cleanup. Prevent closed DuckDB connections from reopening, and avoid leaving a connection open while checking Mastra Code's local observability store.
