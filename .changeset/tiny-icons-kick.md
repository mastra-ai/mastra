---
'@mastra/core': patch
'@mastra/duckdb': patch
'@mastra/clickhouse': patch
---

Added direct score lookup support to observability storage so score records can be fetched by `scoreId` without scanning paginated score lists, including DuckDB and ClickHouse vNext observability stores.
