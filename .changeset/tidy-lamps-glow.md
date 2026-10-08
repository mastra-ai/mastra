---
'@mastra/clickhouse': patch
---

Trace lists use much less memory. `queryTraces()` now reads a trace's input, output, error and metadata only for the rows it returns, and builds their previews in ClickHouse, so only short previews leave the database.
