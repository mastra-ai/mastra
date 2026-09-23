---
'@mastra/clickhouse': minor
---

Added support for saving and returning span usage (`inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`, `cachedTokens`, `estimatedCost`, `costUnit`) in ClickHouse observability storage. Existing databases are upgraded automatically on `init()`, and previously stored spans return `null` for these fields.
