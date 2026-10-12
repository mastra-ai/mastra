---
'@mastra/clickhouse': minor
---

Added `clickhouse_settings` to `ObservabilityStorageClickhouseVNext` and the other ClickHouse storage domains, so settings such as `filesystem_prefetches_limit` can be applied to every query without passing a pre-configured client.

```typescript
const observabilityStore = new ObservabilityStorageClickhouseVNext({
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USERNAME!,
  password: process.env.CLICKHOUSE_PASSWORD!,
  clickhouse_settings: { filesystem_prefetches_limit: 8 },
});
```
