---
'@mastra/clickhouse': patch
---

Improved ClickHouse v-next observability initialization errors to include the underlying ClickHouse message in the standard error text. This makes init failures actionable in loggers that only print `error.message`.
