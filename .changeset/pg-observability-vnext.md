---
'@mastra/pg': minor
---

Added `PostgresStoreVNext` and `ObservabilityStoragePostgresVNext`: a new Postgres observability storage adapter that mirrors the ClickHouse v-next layout. One partitioned table per signal (`mastra_span_events`, `mastra_trace_roots`, `mastra_metric_events`, `mastra_log_events`, `mastra_score_events`, `mastra_feedback_events`), insert-only writes with `ON CONFLICT DO NOTHING` for retry idempotency, a trigger-based root-span projection, and a discovery cache table with stale-while-revalidate refresh.

The adapter detects `timescaledb` and `pg_partman` at `init()` and opts into hypertables or partman-managed partitioning when available; otherwise it pre-creates a rolling window of native daily partitions. The existing `ObservabilityPG` is unchanged. Use `PostgresStoreVNext` to opt in:

```ts
import { PostgresStoreVNext } from '@mastra/pg';

const storage = new PostgresStoreVNext({
  id: 'pg-observability',
  connectionString: process.env.OBSERVABILITY_PG_URL!,
});
```

**Intended for low-volume production workloads only.** Point it at a Postgres instance that is separate from your primary application database — observability writes will degrade application performance if they share resources. For high-volume agent workloads use `@mastra/clickhouse`.

The adapter declares the `insert-only` observability strategy. Set `maxBatchSize: 1` on the default exporter to emulate realtime semantics during local development.

The full ObservabilityStorage surface is implemented, including the OLAP queries that back the Studio dashboards: `getMetricAggregate`, `getMetricBreakdown`, `getMetricTimeSeries`, `getMetricPercentiles`, and the score / feedback equivalents. OLAP queries use standard Postgres aggregates (`SUM`, `AVG`, `percentile_cont`, `FILTER (WHERE …)`) and a portable epoch-floor bucket expression, so the same query plan works on vanilla Postgres and on a TimescaleDB hypertable.

Retention cleanup is out of scope for this release; the partitioning skeleton is designed so a future `mastra retention` CLI command can drop or compress old partitions without further migrations.
