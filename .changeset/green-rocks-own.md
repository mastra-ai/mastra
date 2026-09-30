---
'@mastra/clickhouse': patch
---

Fixed ClickHouse score aggregates returning 0 instead of null when no scores match the filter, matching the other storage adapters.
