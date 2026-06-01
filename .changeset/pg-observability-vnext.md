---
'@mastra/pg': minor
'@mastra/core': patch
---

Add the v-next observability storage domain for `@mastra/pg`, an insert-only,
partitioned Postgres adapter for low-volume observability (~100 calls/sec).

The new `ObservabilityStoragePostgresVNext` (and `PostgresStoreVNext`) emit
spans, logs, metrics, scores, and feedback through a single multi-row
`INSERT ... ON CONFLICT DO NOTHING` path. Storage is partitioned per day with
three modes auto-detected at init time: TimescaleDB hypertables, pg_partman
(4.x or 5.x), or native Postgres range partitions. Root-span lookups are
served by partial indexes, and OLAP queries (aggregates, breakdowns,
time-series, percentiles) prune partitions by `timestamp`. A small
discovery cache table powers stale-while-revalidate lookups for entity
names/types/labels.

Two correctness fixes shipped alongside the initial domain:

- **`@mastra/core`**: `observability-delta-polling` is no longer enabled by
  default in `coreFeatures`. The current delta poller reads with
  `WHERE cursorId > $after` over a `bigserial` cursor that is assigned
  outside of transactions, so a late-committing row whose id falls below
  the cursor can be permanently skipped. Empirically the loss rate scales
  with concurrent writers (~0.6%–6% at 2 writers, ~58% at 16 writers).
  Callers can still opt in explicitly with
  `coreFeatures.add('observability-delta-polling')`. The complete fix
  (cap the cursor at a safe horizon derived from `pg_snapshot_xmin()` and
  drain) will land in a follow-up.
- **`@mastra/pg`**: `ensureNativePartitions()` now swallows the
  `42P07 relation already exists` error around
  `CREATE TABLE IF NOT EXISTS … PARTITION OF`, matching the existing guard
  used for base-table and index DDL. This makes concurrent `init()` from
  two processes (serverless cold-start, blue/green overlap, two stores
  sharing a schema) idempotent instead of letting the loser surface an
  unhandled duplicate-relation error.
