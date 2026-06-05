---
'@mastra/pg': minor
---

Add the v-next observability storage domain for `@mastra/pg`, an insert-only,
partitioned Postgres adapter for low-volume observability (~100 calls/sec,
up to roughly 1,500 calls/sec sustained on a single primary).

The new `PostgresStoreVNext` composes a primary `PostgresStore` (memory,
workflows, scores, agents, etc.) with an `ObservabilityStoragePostgresVNext`
for spans, logs, metrics, scores, and feedback. All observability writes go
through a single multi-row `INSERT ... ON CONFLICT DO NOTHING` path. Storage
is partitioned per day with three modes auto-detected at `init()` time:
TimescaleDB hypertables, pg_partman (4.x or 5.x), or native Postgres range
partitions. Root-span lookups are served by partial indexes, and OLAP queries
(aggregates, breakdowns, time-series, percentiles) prune partitions by
`timestamp`. A small discovery cache table powers stale-while-revalidate
lookups for entity names/types/labels.

The `observability` connection is **required** — callers always make an
explicit decision about where observability data lives. For production,
point it at a dedicated Postgres instance to keep OLAP scans from
contending with your primary OLTP workload. Reusing the primary
connection works for local development and logs a runtime warning on every
construction.

```typescript
import { Mastra } from '@mastra/core';
import { PostgresStoreVNext } from '@mastra/pg';

export const mastra = new Mastra({
  storage: new PostgresStoreVNext({
    id: 'app',
    connectionString: process.env.DATABASE_URL!,
    observability: {
      connectionString: process.env.OBSERVABILITY_DATABASE_URL!,
    },
  }),
});
```

Delta polling uses Postgres transaction IDs and a safe transaction horizon so
concurrent writers cannot cause late-committing rows to be skipped. The
`observability-delta-polling` feature flag is opt-in.

`ensureNativePartitions()` swallows the `42P07 relation already exists`
error around `CREATE TABLE IF NOT EXISTS … PARTITION OF`, matching the
existing guard used for base-table and index DDL. This makes concurrent
`init()` from two processes (serverless cold-start, blue/green overlap, two
stores sharing a schema) idempotent instead of letting the loser surface an
unhandled duplicate-relation error.
