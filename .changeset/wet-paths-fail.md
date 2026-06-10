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

Notes:

- If existing Mastra tables use local `MergeTree` or `ReplacingMergeTree` engines, initialization fails. Migrate existing local tables to `Replicated*` engines before enabling `replication`.
- vNext observability signal-table migrations (`migrateSpans()`) are blocked while `replication` is configured. Migrate legacy signal tables before turning on replication.
- The default `zookeeperPath` is `/clickhouse/tables/{shard}/{database}/{table}`. Override it if your cluster uses a different convention.
