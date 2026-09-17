---
'@mastra/clickhouse': minor
---

Added discovery-specific ClickHouse timeout and memory budgets with stable resource-limit errors.

```ts
const store = new ClickhouseStoreVNext({
  id: 'clickhouse-storage',
  url: 'http://localhost:8123',
  username: 'default',
  password: 'password',
  observability: {
    traceQuery: {
      discovery: {
        timeoutMs: 5_000,
        memoryLimitBytes: 256 * 1024 * 1024,
      },
    },
  },
})
```
