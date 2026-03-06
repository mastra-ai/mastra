# Observability Storage Architecture Redesign — Summary for Review

**Date**: 2026-03-05
**Status**: Design complete, pending team review before implementation

---

## Scope of This Proposal

This is a **significant architectural change** to how Mastra stores and queries all observability data. It touches:

- New database dependency (DuckDB for local, ClickHouse for cloud)
- New storage adapters replacing existing Postgres/SQLite/Mongo observability backends
- New OLAP-native query interface (replacing CRUD-style list/get methods)
- New append-only span storage model (replacing mutable span records)
- New metric record schema (~20 fields, denormalized for OLAP)
- Updated log record schema (parent/root entity hierarchy)
- Deprecation of existing observability storage backends (tracing continues until 2.0)

This is NOT a small incremental change. It's a re-architecture of the observability storage layer. The design aims to get things right from the start rather than accumulating workarounds.

---

## The Problem

We need a metrics storage and query system that serves two fundamentally different use cases:

1. **Dashboard metrics** — Prometheus-style aggregations (counts, rates, histograms) grouped by low-cardinality labels like `agent`, `tool`, `model`, `status`, `env`. Fast, real-time, for health monitoring and alerting.

2. **Usage analytics** — Exact counts grouped by high-cardinality IDs like `userId`, `orgId`. Token usage per user per model, costs by organization. Analytical, potentially large result sets.

The system also needs to work across multiple deployment modes: local dev, small team MVP, serverless production, durable workflow production, and traditional long-lived server deployments.

---

## Key Architecture Decisions

### 1. OLAP as the Single Source of Truth

Rather than maintaining separate systems for metrics and analytics (two sources of truth), we use a single OLAP (columnar analytical) database for all observability data. Prometheus-style aggregations are derived from it, not stored separately.

Raw events with all dimensions are the lossless representation. You can always aggregate down, but never disaggregate up.

### 2. ALL Observability Moves to OLAP

Not just metrics — **traces, logs, metrics, scores, and feedback** all move to DuckDB/ClickHouse. The existing row-store observability backends (Postgres, SQLite, Mongo) are deprecated for observability.

This creates a clean separation:

| Concern | Storage | Engine |
|---------|---------|--------|
| Application state (threads, messages, workflows, config) | Row store | Postgres / SQLite |
| Observability (traces, logs, metrics, scores, feedback) | OLAP | DuckDB / ClickHouse |

**Migration**: Old tracing backends continue to work until 2.0 (maintenance mode — no new features, not removed). The new multi-signal observability system requires OLAP — no row-store option.

**User upgrade experience**: When upgrading to the new system, users would configure a DuckDB path (local) or ClickHouse endpoint (cloud). Historical observability data in old backends is not migrated — observability data is inherently ephemeral. The old tracing backend remains functional until 2.0 for users who aren't ready to switch.

### 3. DuckDB for Local, ClickHouse for Cloud

**DuckDB** is the "batteries included" embedded OLAP engine (like SQLite is for app storage):
- Zero external dependencies, runs in-process
- Columnar — aggregation queries are orders of magnitude faster than row stores
- Single file on disk, Parquet export for migration to larger systems
- Handles millions of rows in sub-second aggregation queries

**Why not SQLite/Postgres for OLAP?** They're row-oriented — optimized for point lookups and transactions, not for the scan-heavy aggregation queries metrics demand. Even at small scale, using the wrong storage engine creates unnecessary performance issues.

### 4. Two-Exporter Model

| Exporter | Writes to | Used by | V1 Status |
|----------|-----------|---------|-----------|
| **DefaultExporter** | Local DuckDB | Local dev, MVP prod | **V1** |
| **CloudExporter** | JSON API → ClickHouse/BigQuery | Serverless, durable workflow, old-school prod | **V1** |

**Note**: The existing `DefaultExporter` writes to `ObservabilityStorage` (Postgres/SQLite). The new DefaultExporter writes to DuckDB. These are different implementations behind the same interface. During the transition period, both coexist — users configure which one they use.

**CloudExporter**: Sends observability data over the network to a JSON API endpoint. Best-effort delivery matching existing OTLP solutions. The API starts as JSON; protobuf encoding and/or streaming endpoints are future optimizations. The receiving API writes to ClickHouse, BigQuery, or another external OLAP backend.

**Serverless concern**: Ephemeral processes can't reliably flush to embedded DuckDB. CloudExporter solves this by sending data over the network on each flush.

### Deployment Overview

| Mode | Exporter | OLAP Backend | Scale |
|------|----------|-------------|-------|
| Local dev | DefaultExporter | DuckDB (in-process) | Single developer |
| MVP prod | DefaultExporter | DuckDB (file-backed) | ~100 users |
| Serverless prod | CloudExporter | ClickHouse / BigQuery | Significant |
| Durable workflow prod | CloudExporter | ClickHouse / BigQuery | Significant |
| Old-school prod | CloudExporter | ClickHouse / BigQuery | Significant |

---

## Metric Record Design

### Raw Observations, Not Pre-Aggregated

Every metric emission (counter increment, gauge set, histogram observation) is stored as a raw row. Aggregation happens at query time. This is the simplest model and DuckDB/ClickHouse handle it efficiently.

No rollup tables or background aggregator in v1 for DuckDB (local/MVP). For production ClickHouse, materialized views are included from day one for standard dashboard queries (see ClickHouse Production Strategy below).

### Schema Shape

Each metric record carries:

| Category | Fields | Purpose |
|----------|--------|---------|
| **Core** | `id`, `timestamp`, `name`, `metricType`, `value` | The metric observation itself |
| **Labels** | `labels: Record<string, string>` | Low-cardinality only (agent, tool, model, status, env). Cardinality-protected — blocked keys, UUID detection |
| **Entity (self)** | `entityType`, `entityId`, `entityName` | What entity emitted this metric |
| **Entity (parent)** | `parentEntityType`, `parentEntityId`, `parentEntityName` | Nearest non-internal ancestor (e.g., the agent running this tool) |
| **Entity (root)** | `rootEntityType`, `rootEntityId`, `rootEntityName` | Outermost ancestor (e.g., the workflow containing everything) |
| **Identity** | `userId`, `organizationId`, `resourceId` | High-cardinality IDs for usage analytics |
| **Correlation** | `traceId`, `spanId`, `runId`, `sessionId`, `threadId`, `requestId` | Link metrics back to traces/spans |
| **Deployment** | `environment`, `source`, `serviceName`, `scope` | Where this metric came from |
| **Experimentation** | `experimentId` | A/B tests, eval runs |
| **Metadata** | `metadata: Record<string, unknown>` | Arbitrary user data |

**This is a change from the current `metrics.ts` schema**, which only has core fields, labels, and metadata. The additional context fields, entity hierarchy, correlation IDs, and experimentId are new.

**Why so wide?** In columnar OLAP, nullable columns compress to near-zero cost. Denormalization avoids JOINs, which is the OLAP-correct approach. Having `userId` on the metric means "token usage per user" is a simple GROUP BY, not a multi-table JOIN.

**Parent/root entity fields** are pre-computed at write time from the span parent chain. Without them, "tool latency grouped by parent agent" requires JOINing to spans and walking the chain. With them, it's a direct `GROUP BY parentEntityName`.

### Histogram Buckets

Bucket boundaries are stored as config constants (by metric name suffix), not per-record. Raw observations store only `{ value: number }`. Bucket counts are computed at query time. This means bucket boundaries can be changed retroactively (all historical data re-buckets on query).

Default bucket sets: duration (ms), tokens, bytes — matching the spec.

### Scores & Feedback → Metric Events

When a score or feedback is recorded, it's written to both:
- **Scores/feedback table** — Full record (reason text, metadata, etc.)
- **Metrics table** — Numeric value as metric events (`mastra_score_value`, `mastra_feedback_total`, etc.)

Dashboard charts for scores query the metrics table. Detail views query the scores table. Accepted duplication — they serve different query patterns and the storage cost is negligible in columnar OLAP.

**Failure mode**: If one write succeeds and the other fails, the data is inconsistent between tables. This is acceptable for observability data (best-effort) — the same tolerance we apply to metric delivery in general.

### ClickHouse Production Strategy

#### Materialized Views (included in v1)

For production ClickHouse deployments, we include materialized views from day one for the standard dashboard queries. ClickHouse materialized views are triggered on INSERT — they pre-aggregate data as it arrives, with zero query-time cost. This is the standard ClickHouse pattern, not something custom we're building.

**V1 materialized views:**
- **1-minute aggregations** — pre-computed `sum`, `avg`, `count`, `min`, `max` per metric name per minute, grouped by common low-cardinality dimensions (entityType, entityName, labels). Serves `getMetricTimeSeries` and `getMetricAggregate` for recent time ranges.
- **1-hour aggregations** — same structure, coarser granularity. Serves wider time ranges (last 7d, 30d, 90d) without scanning billions of raw rows.

The query methods automatically route to the appropriate source: raw table for sub-minute granularity or custom groupBy, minute rollup for recent dashboards, hour rollup for wide time ranges. This routing is internal to the ClickHouse adapter — the query API is unchanged.

**DuckDB (local/MVP) does not use materialized views.** Query-time aggregation on raw data is fast enough at local scale. The DuckDB adapter always queries raw tables.

#### Partition-Based Retention (instead of TTLs)

For ClickHouse, we do **not** use TTL-based retention. Instead, tables are partitioned by `(organizationId, toYYYYMMDD(timestamp))` — organization ID and insertion date. Retention is managed by dropping entire partitions:

```sql
ALTER TABLE metrics DROP PARTITION ('org_123', '20260101')
```

**Why partitions over TTLs:**
- **Predictable** — partition drops are instant, atomic operations. TTLs run as background merges with unpredictable timing.
- **Per-org control** — different organizations can have different retention periods. TTLs apply globally.
- **Clean** — no tombstones, no merge overhead. The partition is simply removed.
- **Auditable** — you can list partitions and see exactly what data exists for which org and date range.

This applies to all 5 observability tables in ClickHouse (span_events, logs, metrics, scores, feedback).

---

## Query Interface

### Dashboard Queries (5 convenience methods)

These map directly to the visualizations in the [dashboard prototype](https://prototypes-one-theta.vercel.app/studio/metrics/actual):

```typescript
// KPI cards — single value with comparison to previous period
getMetricAggregate(
  name: string | string[],
  aggregation: AggregationType,       // 'sum' | 'avg' | 'count' | 'last' | ...
  filters: MetricsFilter,
  comparePeriod?: 'previous'
) → { value: number, previousValue?: number, changePercent?: number }

// Breakdown tables — grouped by dimensions
getMetricBreakdown(
  name: string | string[],
  groupBy: string[],                  // field names: 'entityName', 'labels.model', etc.
  aggregation: AggregationType,
  filters: MetricsFilter
) → { groups: [{ dimensions: Record<string, string>, value: number }] }

// Line charts — time-bucketed series
getMetricTimeSeries(
  name: string | string[],
  interval: '1m' | '5m' | '15m' | '1h' | '1d',
  aggregation: AggregationType,
  filters: MetricsFilter,
  groupBy?: string[]
) → { series: [{ name: string, points: [{ timestamp: Date, value: number }] }] }

// Distribution charts — histogram buckets
getMetricHistogram(
  name: string,
  bucketBoundaries: number[],
  filters: MetricsFilter
) → { boundaries: number[], counts: number[], sum: number, count: number }

// Latency charts — percentile time series
getMetricPercentiles(
  name: string,
  percentiles: number[],             // e.g., [50, 95, 99]
  interval: '1m' | '5m' | '15m' | '1h' | '1d',
  filters: MetricsFilter
) → { series: [{ percentile: number, points: [{ timestamp: Date, value: number }] }] }
```

### Report Queries (separate naming)

```typescript
// High-cardinality analytics — same implementation as getMetricBreakdown in v1
getUsageReport(
  name: string | string[],
  groupBy: string[],                  // can include userId, organizationId, etc.
  aggregation: AggregationType,
  filters: MetricsFilter
) → { groups: [{ dimensions: Record<string, string>, value: number }] }
```

Same underlying implementation as `getMetricBreakdown` in v1, but with a separate name because:
- Self-documenting: "this may return many rows and take longer"
- Independent optimization path: can become async (job ID + polling) in v2
- Different SLAs: dashboards are real-time, reports can tolerate latency

### Aggregation Types

```
sum, avg, min, max, count, last, rate
```

- `last` — for gauges (most recent value per group, uses DuckDB/ClickHouse native `argMax`)
- `rate` — for counter time series (per-second rate of change)
- Query methods are metric-type-agnostic — caller specifies the aggregation, not the system

### Generic Query Builder (deferred)

A safe SQL query builder for custom charting / ad-hoc exploration. Deferred until custom charting feature lands.

---

## Span Events Instead of Mutable Spans

A significant change to tracing storage: instead of storing mutable span records that get updated on end/error, store **immutable span lifecycle events** (start, update, end).

**Why**: DuckDB/ClickHouse are optimized for appends. Updates are expensive (rewrite data pages). The current model does 2 updates per span — fighting the OLAP engine.

**Span event model**:
- `span_start` → append row with name, type, startedAt, entity info
- `span_update` → append row with new attributes/metadata
- `span_end` → append row with endedAt, output, error

**Reconstructing span state**: Uses the same `arg_max` pattern as gauge metrics — `GROUP BY spanId` with `arg_max(field, timestamp)`. Non-issue for performance.

**Bonus**: Running spans are immediately visible (span_start row exists before span completes). Status derived from "has a span_end event or not."

**Storage overhead**: 2-3 rows per span instead of 1. Columnar compression handles this well since many columns are identical across events for the same span.

**Already anticipated**: The codebase has `TracingStorageStrategy = 'insert-only'` designed for exactly this.

**Note**: This applies to the new DuckDB/ClickHouse adapters. The existing Postgres/SQLite adapters (maintained until 2.0) continue using mutable span records. Both patterns coexist during the transition — they're different adapter implementations behind the same storage interface.

---

## V1 Scope & Phasing

### What "V1" means

V1 is the first release of the new observability storage architecture. It's focused on **DefaultExporter + DuckDB** for local dev and MVP prod. This is a large effort that should be broken into implementation phases (PRs), but all items below are in scope for the v1 release.

**Included:**
- DuckDB storage adapter implementation (all 5 observability tables)
- Span events (append-only) in DuckDB adapter
- 5 dashboard query methods + 1 report query method on the DuckDB adapter
- Updated metric record schema with full context fields, entity hierarchy, and trace correlation
- Updated log record schema with parent/root entity hierarchy fields
- Histogram bucket config constants
- Scores/feedback emitting metric events to the metrics table
- DefaultExporter writing to DuckDB
- CloudExporter sending to a JSON API endpoint (protobuf/streaming deferred)
- ClickHouse adapter (receiving side of CloudExporter)
- ClickHouse materialized views for standard dashboard queries (1-min and 1-hour rollups)
- Partition-based retention in ClickHouse (by organizationId + insertion date)

**Not in v1 (but designed for):**
- Protobuf encoding / streaming transport for CloudExporter
- BigQuery adapter

**Deferred to v2+:**
- DuckDB rollup tables (not needed at local scale)
- Async report job system with cached results
- Per-metric histogram bucket overrides
- Prometheus push gateway / `/metrics` endpoint
- Generic query builder for custom charting
- Auto-select aggregation by metric type

---

## Embedded OLAP Engine: DuckDB vs chDB

We evaluated chDB (embedded ClickHouse) as an alternative to DuckDB for local/MVP deployments. The appeal is obvious: same engine locally and in production means identical SQL dialect, identical query behavior, and no "works locally but not in prod" surprises.

### Comparison

| | DuckDB (`@duckdb/node-api`) | chDB (`chdb`) |
|---|---|---|
| **npm weekly downloads** | ~287K | ~187 |
| **Node.js maturity** | Official package, actively maintained, alpha label | Community bindings, v1.3.0 (June 2025) |
| **Install size** | ~20-40MB native binary | ~300MB (full ClickHouse engine) |
| **Platform binaries** | Prebuilt via node-pre-gyp (Linux, macOS, Windows, x64/arm64) | Requires C++ compilation; platform coverage unclear |
| **Persistence** | File-backed by default, single file on disk | Temporary storage by default — tables disappear when process ends; session-based persistence available |
| **Memory model** | Can spill to disk for large queries | Process memory only — OOM crash if dataset exceeds RAM |
| **Streaming ingestion** | Designed for concurrent appends | Designed for batch analytics on static files, not continuous ingestion |
| **Concurrency** | Single-writer / multi-reader | Not documented for Node.js |
| **SQL compatibility with ClickHouse** | Different SQL dialect | Identical — queries transfer directly |

### Assessment

**chDB's key advantage** — same SQL as production ClickHouse — is genuinely valuable. It would eliminate the need to maintain two SQL dialects in our query methods.

**chDB's dealbreakers for our use case:**
1. **Not designed for continuous ingestion.** Our use case is appending observability events in real-time. chDB is designed for batch analytics on static files. This is a fundamental mismatch.
2. **Temporary storage by default.** Observability data needs to persist across process restarts. chDB requires explicit session management and cleanup.
3. **~187 npm downloads/week.** The Node.js bindings are barely used in the ecosystem. Risk of encountering undiscovered bugs and getting slow fixes.
4. **~300MB install.** 7-15x larger than DuckDB. Significant for local dev dependency.
5. **No disk spill.** OOM crashes on large queries are unacceptable even locally.

**Recommendation: DuckDB for local, ClickHouse server for production.** The SQL dialect difference is manageable — our OLAP query methods abstract it (the adapter translates `time_bucket()` vs `toStartOfMinute()`, `arg_max()` works in both). The fundamental architecture differences (ingestion model, persistence, memory handling) make chDB unsuitable for our always-on observability data collection use case.

### DuckDB Node.js Details

**Package**: `@duckdb/node-api` (official, ~287K weekly npm downloads)
- Native module with prebuilt binaries via node-pre-gyp
- In-memory and file-backed databases
- Single-writer / multiple-reader (fine for single Node.js process)
- Legacy `duckdb` package deprecated (no releases after DuckDB 1.5.x)
- Tables auto-created on first connection, no migration system needed

**Risks to be aware of:**
- **Alpha status**: `@duckdb/node-api` is marked "alpha" by the DuckDB team, though it's well-tested and actively maintained
- **Security incident**: In Sept 2025, DuckDB npm packages were compromised with malware. Detected and resolved within 4 hours. Affected versions deprecated.
- **Build friction**: As a native module, may have platform-specific build issues (same category as better-sqlite3, which we already depend on)
- **Bundler issues**: Some webpack/Next.js integration friction reported — relevant for serverless deployments (though those would use CloudExporter, not DuckDB directly)

---

## Questions for Discussion

### 1. Does the clean split between row store (app data) and OLAP (observability) make sense for our deployment story?

The proposal is: Postgres/SQLite handles threads, messages, workflows, config. DuckDB/ClickHouse handles all observability (traces, logs, metrics, scores, feedback). Two databases, but with a clear separation of concerns — transactional app data vs analytical observability data.

The alternative would be keeping everything in one database (Postgres for both), but that means either compromising on OLAP query performance or building complex indexing/partitioning schemes in a row store. We'd also lose the ability to do things like "token usage per user per model" efficiently, which requires columnar scan performance.

Does this two-database model create problems for deployment, ops, or the getting-started experience? Or is the clear separation actually simpler to reason about?

### 2. Is DuckDB as a required dependency acceptable for local dev?

DuckDB is a native module (like better-sqlite3) — it ships prebuilt binaries for major platforms via node-pre-gyp. It's ~287K weekly npm downloads, officially maintained by the DuckDB team. The `@duckdb/node-api` package is the recommended one (though currently marked "alpha").

The tradeoff: users get a proper OLAP engine even locally (sub-second aggregation queries on millions of rows), but they need a native module that may have platform-specific build issues. The same tradeoff we already accept with better-sqlite3 for app storage.

Are there deployment targets where native modules are problematic? Should we also offer a WASM fallback (`@duckdb/duckdb-wasm`) for environments that can't use native modules, even if it's slower?

### 3. Are the 5 dashboard query methods + 1 report method the right API surface for v1?

The 5 methods map directly to the dashboard prototype visualizations:
- `getMetricAggregate` → KPI cards (total runs, error rate, avg latency, with % change)
- `getMetricBreakdown` → Tables (runs by agent, tokens by model, errors by tool)
- `getMetricTimeSeries` → Line charts (latency over time, cost over time, throughput)
- `getMetricHistogram` → Distribution charts (score distribution)
- `getMetricPercentiles` → Latency charts (p50/p95 over time)

Plus `getUsageReport` for high-cardinality analytics (token usage per user, costs by org).

Are there dashboard visualizations or analytics use cases that these 6 methods can't serve? Method signatures are shown above in the Query Interface section. A generic query builder is planned for later (custom charting), but we want to make sure the v1 methods cover the initial dashboard without gaps.

### 4. Are there deployment modes or use cases we're missing?

We've identified 5 deployment modes: local dev, MVP prod (~100 users), serverless prod, durable workflow prod (Inngest etc.), and old-school prod (long-lived container). Each maps to either DefaultExporter (local DuckDB) or CloudExporter (network-based, ClickHouse/BigQuery).

**Hybrid mode** (local DuckDB + cloud simultaneously) is the recommended way to start building with Mastra — fast local queries while also pushing to cloud for backup/long-term storage. This is already a solved problem: the ObservabilityBus fans out events to multiple exporters.

```typescript
observability: {
  exporters: [
    new DefaultExporter({ duckdb: './local.duckdb' }),  // local queries
    new CloudExporter({ endpoint: 'https://...' }),      // cloud backup
  ]
}
```

Other considerations:
- **Edge/IoT deployments** — not a current Mastra use case, but worth flagging
- **Multi-region** — ClickHouse handles this natively, but do we need to account for it in our schema design?
- Any other deployment patterns we should consider?

### 5. Does the separate naming for report queries feel right or over-engineered?

`getUsageReport` has the same v1 implementation as `getMetricBreakdown` — it's just a GROUP BY with high-cardinality dimensions. The separate name exists purely as a forward-looking API decision so we can later make reports async (job ID + polling), add pagination for large result sets, or route to pre-computed tables — all without breaking the dashboard API contract.

The risk is YAGNI — maybe we never need the separation and it just adds confusion. The benefit is we don't have to make a breaking API change later if reports do need different treatment at scale. Given that the cost is just a function name, we lean toward keeping the separation.

**Should `getMetricBreakdown` block high-cardinality fields?** We lean no. The boundary between "dashboard" and "report" is fuzzy and context-dependent — `GROUP BY userId` is fine with 5 users, expensive with 10,000. Hard blocking would require maintaining a cardinality denylist and would frustrate users in small deployments. Instead, the naming itself is the guardrail: developers see "report" and understand it's a heavier operation. `getMetricBreakdown` works with any groupBy, but docs/UI steer toward low-cardinality fields. If async execution is added later, it only applies to `getUsageReport`.

### 6. Is query-time aggregation on raw events fast enough for production dashboards without pre-aggregation?

V1 stores every metric observation as a raw row and aggregates at query time — no rollup tables, no background aggregator. This is simple to build and works well for DuckDB (local/MVP), but production deployments on ClickHouse will see real volume.

**Scale estimate**: At 1,000 req/s with ~10-20 metric observations per request, that's 10K-20K metric rows/second, or ~860M-1.7B rows/day. Dashboard queries scan these raw rows with `GROUP BY` and time bucketing on every load.

**Why this is likely fine for v1:**
- ClickHouse is purpose-built for this. Billions of rows, columnar scans, sub-second aggregation is its core use case. Companies like Cloudflare run analytics at this scale without pre-aggregation.
- Most dashboard queries filter by time range (last 1h, last 24h), dramatically reducing scan size.
- With a good table sorting key (`ORDER BY (name, timestamp)`) and date-based partitioning, ClickHouse only reads relevant data.

**Where it could get painful:**
- **Wide time ranges** — "cost trends for the last 90 days" scanning billions of rows
- **High-frequency auto-refresh** — 5s refresh intervals on a busy system, each refresh doing full scans
- **Multiple concurrent dashboard users** — N users x 6+ queries per dashboard load

**Built-in escape hatches (no custom code needed):**
- **ClickHouse materialized views** — automatically maintain pre-aggregated rollup tables as data arrives. This is the standard ClickHouse pattern, not something we'd need to build ourselves. Adding a materialized view is a single DDL statement, no data migration required.
- **ClickHouse projections** — alternative pre-aggregation that lives within the same table.
- **TTL policies** — automatic retention management built into table config.

**Decision (updated after team review)**: Include ClickHouse materialized views from day one for standard dashboard queries. 1-minute and 1-hour rollup tables are created as materialized views that aggregate on INSERT. The query methods automatically route to the right source (raw vs rollup) based on the requested time range and granularity. This adds modest implementation complexity to the ClickHouse adapter but ensures production dashboards are fast from the start.

DuckDB (local/MVP) does not use materialized views — query-time aggregation on raw data is sufficient at that scale.

The question for discussion: are the two rollup intervals (1-minute, 1-hour) sufficient for v1, or should we also include a 1-day rollup for very wide time ranges (90d+)?

### 7. Does the shift from mutable span records to immutable span events make sense?

Currently spans are stored as mutable rows: INSERT on start, UPDATE on end/error. In OLAP databases, updates are expensive (rewrite data pages). The proposal is to store each lifecycle event as its own immutable row: `span_start`, `span_update`, `span_end`.

Reconstructing current span state is a `GROUP BY spanId` with `arg_max` — the same pattern used for gauge metrics, well-optimized in DuckDB/ClickHouse.

Benefits: append-only writes (OLAP-native), running spans are visible immediately, full event history preserved. Cost: 2-3 rows per span instead of 1 (columnar compression handles this well), slightly more complex read queries.

**Note**: This only applies to the new DuckDB/ClickHouse adapters. Existing Postgres/SQLite adapters (maintained until 2.0) continue with mutable spans. Both patterns coexist during the transition.

#### Codebase Impact Assessment

We researched the entire codebase for dependencies on mutable span rows. **The answer is: nothing fundamentally depends on mutability.** All dependencies are at the query layer inside the storage adapter, not in the UI or API layer.

**What needs query changes (all straightforward):**
- `getSpan(traceId, spanId)` — currently expects 1 row. Becomes a `GROUP BY spanId` with `arg_max` to reconstruct from events.
- `getTrace(traceId)` / `listTraces()` — same reconstruction pattern.
- `updateSpan()` / `batchUpdateSpans()` — become INSERTs instead of UPDATEs. Simpler, not harder.
- `computeTraceStatus()` — works unchanged. It receives a reconstructed `SpanRecord` with the same shape as before.

**What doesn't change at all:**
- UI components (`TraceDialog`, `format-hierarchical-spans.ts`) — they receive `SpanRecord[]` and render a tree. Reconstruction happens inside the storage adapter before data reaches the UI.
- Client SDKs — consume API responses, not storage format.
- `hasChildError` filter — works the same with event rows.
- Score/feedback references to `traceId`/`spanId` — still valid.

**Key insight**: The reconstruction from events to `SpanRecord` happens entirely inside the DuckDB storage adapter's query methods. Everything above the storage layer — API routes, UI components, client SDKs — sees the exact same `SpanRecord` type as before. This is a storage-internal change, not an API change.

The existing `insert-only` strategy is a halfway version of this pattern — it waits for `SPAN_ENDED` and creates one complete row, discarding intermediate events. The full span events model is strictly better: you capture `span_start` (running spans visibility), `span_update`, and `span_end`, while still reconstructing the same final `SpanRecord` shape for consumers.

### 8. Future direction: Single unified `observability_events` table?

V1 uses 5 separate tables (span_events, metrics, logs, scores, feedback), but most fields are shared across all signal types (~25+ context fields). An alternative design would combine everything into a single `observability_events` table with an `eventKind` discriminator column (`'span_start' | 'span_update' | 'span_end' | 'metric' | 'log' | 'score' | 'feedback'`).

**Advantages of a single table:**
- One DDL, one filter builder, one INSERT path — significantly simpler adapter code
- Cross-signal queries become trivial (no UNIONs)
- Discovery endpoints scan one table
- NULL columns are essentially free in columnar storage (just a validity bitmap)
- Aligns with the Honeycomb "wide events" model which has proven successful at scale

**Advantages of separate tables (current V1 approach):**
- Each table is self-contained with clear required fields
- Simpler type safety — no discriminated union needed at the schema level
- More conventional — easier to reason about for new contributors
- Each table can have independent indexes/sort keys optimized for its query patterns

**ClickHouse consideration:** With a single table, the partition scheme becomes `(organizationId, eventKind, toYYYYMMDD(timestamp))`, enabling per-signal retention policies (e.g., keep metrics 90 days but spans only 30 days). This works because each `(org, kind, day)` tuple is a separate physical partition — `DROP PARTITION` is instant.

**Decision**: V1 proceeds with 5 separate tables for simplicity and convention. The single-table approach is a strong candidate for V2 if adapter code complexity or cross-signal query needs justify it. The API surface (typed methods per signal) wouldn't change either way — only the physical storage layout.
