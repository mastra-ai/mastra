---
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/modal': patch
'@mastra/server': patch
'mastracode': patch
'@mastra/core': patch
---

Fixed ClickHouse score aggregates returning 0 instead of null when no scores match the filter, matching the other storage adapters.
