---
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added `getTraceLight` method to the observability storage, returning only lightweight span fields needed for timeline rendering. This avoids transferring heavy fields like `input`, `output`, `attributes`, and `metadata` when they are not needed.
