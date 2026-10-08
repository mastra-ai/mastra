---
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
'@mastra/pg': patch
---

Trace list queries now return the raw root span input and output so the core can build typed input and output previews.
