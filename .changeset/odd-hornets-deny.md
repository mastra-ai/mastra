---
'@mastra/clickhouse': patch
---

Fixed the ClickHouse v-next observability init error so it now includes the underlying ClickHouse error message. Previously the thrown MastraError only showed `Failed to initialize ClickHouse v-next observability tables`, hiding the real cause behind `error.cause` which many loggers don't render. The cause is still attached for full stacks.
