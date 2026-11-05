---
'@mastra/duckdb': patch
---

Trace, span, and thread lists load much faster on large DuckDB databases, because loading a page now reads far less stored input and output.
