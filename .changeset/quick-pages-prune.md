---
'@mastra/duckdb': patch
---

Improved list speed on large DuckDB databases. Trace, span, and thread pages now read far less stored input and output, which makes a large difference on slow disks.
