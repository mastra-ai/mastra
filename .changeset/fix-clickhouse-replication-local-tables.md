---
'@mastra/clickhouse': patch
---

Pre-existing local (non-replicated) ClickHouse tables no longer prevent storage initialization when replication is enabled. Instead of throwing an error, initialization logs a warning and leaves existing tables untouched.

Added the `allowMixedEngines: true` configuration option under `replication` to explicitly allow and suppress the warning for intentional mixed-engine deployments.

```typescript
const storage = new ObservabilityStorageClickhouseVNext({
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  replication: {
    cluster: 'my_cluster',
    allowMixedEngines: true,
  },
});
```

