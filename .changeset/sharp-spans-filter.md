---
'@mastra/clickhouse': patch
---

Fixed `listTraces` failing with a SQL syntax error when filtering by `hasChildError` in the ClickHouse observability store.
