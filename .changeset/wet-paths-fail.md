---
"@mastra/clickhouse": minor
---

Added opt-in replicated ClickHouse table support for multi-replica clusters.

Configure `replication` to have Mastra create replicated MergeTree tables and add `ON CLUSTER` to Mastra-owned DDL when a cluster name is provided:

```ts
new ClickhouseStoreVNext({
  id: 'clickhouse-storage',
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USERNAME!,
  password: process.env.CLICKHOUSE_PASSWORD!,
  replication: {
    cluster: 'company_cluster',
  },
})
```
