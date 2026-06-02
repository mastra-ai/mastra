---
'@mastra/duckdb': patch
---

Fixed DuckDB "Conflicting lock is held" error on `mastra dev` hot reload. `DuckDBStore` now releases its native file lock on shutdown so the restarted dev process can reopen the same database file.
