---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added support for filtering and grouping span and trace queries by `outcome` and `stopReason`, and returned `outcome`, `stopReason`, and `stopReasonContext` on span and trace results. Trace-level values come from the root span.
