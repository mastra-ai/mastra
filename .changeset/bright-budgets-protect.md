---
'@mastra/clickhouse': minor
---

Added discovery-specific ClickHouse timeout and memory budgets with stable resource-limit errors.

```ts
const observability = new ObservabilityStorageClickhouseVNext({
  url: 'http://localhost:8123',
  username: 'default',
  password: 'password',
  traceQueryDiscoveryTimeoutMs: 5_000,
  traceQueryDiscoveryMemoryLimitBytes: 256 * 1024 * 1024,
})
```
