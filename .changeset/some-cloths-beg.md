---
'@mastra/clickhouse': minor
---

Added an opt-in replicated table engine mode for ClickHouse stores. Configure replicated engines to create `ReplicatedMergeTree` and `ReplicatedReplacingMergeTree` tables, with optional `ON CLUSTER` DDL for replicated ClickHouse clusters.

```ts
const storage = new ClickhouseStore({
  id: 'clickhouse',
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USERNAME!,
  password: process.env.CLICKHOUSE_PASSWORD!,
  engine: {
    type: 'replicated',
    cluster: 'production_cluster',
    zooPath: '/clickhouse/tables/{shard}/{database}/{table}',
    replica: '{replica}',
  },
});
```
