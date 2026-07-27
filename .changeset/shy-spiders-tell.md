---
'@mastra/duckdb': patch
---

Added idle-close for DuckDB file locks. The DuckDB instance now automatically closes after 500ms of inactivity, releasing its file lock so dev-server hot reloads no longer fail with "Conflicting lock" errors. The timeout is configurable via `idleTimeoutMs` in `DuckDBStorageConfig`.
