---
'create-agentbuilder': patch
'@mastra/core': patch
'@mastra/duckdb': patch
'mastra': patch
---

Added close() to the DuckDB observability storage so the native DuckDB file lock is released on Mastra.shutdown() when the store is composed in as the observability domain of a MastraCompositeStore. Previously the lock could persist across dev server restarts and cause "Conflicting lock is held" errors.
