---
'@mastra/duckdb': patch
---

Improved span and thread list speed on large DuckDB databases. Filtered pages whose rows are far apart now read stored input and output only for rows that have no stored preview.
