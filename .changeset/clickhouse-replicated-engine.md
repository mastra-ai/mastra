---
'@mastra/clickhouse': minor
---

Added opt-in replicated table engine support for multi-replica ClickHouse clusters. Without it, plain `MergeTree` engines do not replicate data across nodes — reads behind a load balancer return whichever slice was written to whichever replica was hit, causing observability dashboards to flicker between trace counts. Set `engine: { type: 'replicated', cluster: '<name>' }` (or `externallyManagedDDL: true` if your deploy pipeline runs DDL on every replica) and Mastra emits `Replicated*MergeTree` engines so writes replicate via ClickHouse Keeper. Engine config is honored for base tables, delta tables and MVs (the new delta-polling indexes), and the additive migration/retention `ALTER` statements. Mastra refuses to migrate between engine modes; if pre-existing tables disagree with the configured mode, init aborts on startup with an explicit error. Fixes [#15618](https://github.com/mastra-ai/mastra/issues/15618).

```ts
import { ClickhouseStoreVNext } from '@mastra/clickhouse';

const storage = new ClickhouseStoreVNext({
  id: 'clickhouse-storage',
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USERNAME!,
  password: process.env.CLICKHOUSE_PASSWORD!,
  engine: {
    type: 'replicated',
    cluster: 'production_cluster',
  },
});
```
