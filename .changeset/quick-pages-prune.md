---
'@mastra/duckdb': patch
---

Trace, span, and thread lists load much faster on large DuckDB databases. Loading a page no longer reads every stored input and output in the table.
