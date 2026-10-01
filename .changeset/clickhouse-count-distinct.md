---
'@mastra/clickhouse': patch
---

Fixed ClickHouse feedback and score aggregates returning a sum when `count_distinct` was requested. They now return the number of distinct values.
