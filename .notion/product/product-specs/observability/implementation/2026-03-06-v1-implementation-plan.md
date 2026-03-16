# Observability Storage Architecture — V1 Implementation Plan

**Date**: 2026-03-06
**Status**: Pending review
**Design docs**: See `../journal/2026-03-05-metrics-storage-design.md` (journal) and `../journal/2026-03-05-metrics-design-summary.md` (summary)

---

## Context

Mastra needs a metrics storage and query system that handles both Prometheus-style dashboard aggregations and high-cardinality usage analytics. After extensive design discussion, we're re-architecting the observability storage layer to use OLAP (DuckDB) instead of row stores.

**V1 scope**: Core schema updates + DuckDB adapter + DefaultExporter wiring. ClickHouse and CloudExporter are deferred until the CloudExporter API contract is defined.

**Key design decisions**:
- OLAP as single source of truth (raw events, query-time aggregation)
- DuckDB for local dev and MVP prod
- Append-only span events (no mutable span rows in DuckDB)
- OLAP-native query methods (replacing CRUD-style `listMetrics`)
- Denormalized records with context fields and entity hierarchy

**Delivery approach**: All work lands together. After completion, split into separate PRs by package (core, duckdb, observability). Be careful about breaking changes — existing adapters must continue to compile and pass tests.

---

## Part 1: Core Schema Updates (`packages/core`)

Non-breaking additive changes to Zod schemas.

### 1a. shared.ts — Add parent/root entity fields + experimentId

**File**: `packages/core/src/storage/domains/shared.ts`

Add 7 new field definitions:
```typescript
export const parentEntityTypeField = z.nativeEnum(EntityType).describe('...');
export const parentEntityIdField = z.string().describe('...');
export const parentEntityNameField = z.string().describe('...');
export const rootEntityTypeField = z.nativeEnum(EntityType).describe('...');
export const rootEntityIdField = z.string().describe('...');
export const rootEntityNameField = z.string().describe('...');
export const experimentIdField = z.string().describe('Experiment or eval run identifier');
```

Note: `experimentIdField` is currently defined locally in `scores.ts` and `feedback.ts`. Move to shared and update imports.

### 1b. metrics.ts — Add context fields, update aggregation types, add OLAP query schemas

**File**: `packages/core/src/storage/domains/observability/metrics.ts`

**Schema changes:**
1. Import context fields, entity hierarchy fields, traceId/spanId from tracing
2. Add to `metricRecordSchema` (all nullish):
   - Correlation: `traceId`, `spanId`
   - Entity (self): `entityType`, `entityId`, `entityName`
   - Entity (parent): `parentEntityType`, `parentEntityId`, `parentEntityName`
   - Entity (root): `rootEntityType`, `rootEntityId`, `rootEntityName`
   - Identity: `userId`, `organizationId`, `resourceId`
   - Correlation IDs: `runId`, `sessionId`, `threadId`, `requestId`
   - Deployment: `environment`, `source`, `serviceName`, `scope`
   - Experimentation: `experimentId`
3. Update `aggregationTypeSchema`: add `'last'` and `'rate'`
4. Update `metricsFilterSchema`: add filter fields for traceId, spanId, entityType, entityName, userId, runId, sessionId, experimentId, parentEntityType, parentEntityName, rootEntityType, rootEntityName
5. **Remove** `listMetricsArgsSchema`, `listMetricsResponseSchema`, `metricsOrderByFieldSchema`, `metricsOrderBySchema` and associated types — replaced by OLAP query methods

**OLAP query schemas** (new):
```typescript
// getMetricAggregate
getMetricAggregateArgsSchema -> { name: string | string[], aggregation, filters, comparePeriod? }
getMetricAggregateResponseSchema -> { value, previousValue?, changePercent? }

// getMetricBreakdown
getMetricBreakdownArgsSchema -> { name, groupBy: string[], aggregation, filters }
getMetricBreakdownResponseSchema -> { groups: [{ dimensions: Record<string,string>, value }] }

// getMetricTimeSeries
getMetricTimeSeriesArgsSchema -> { name, interval, aggregation, filters, groupBy? }
getMetricTimeSeriesResponseSchema -> { series: [{ name, points: [{ timestamp, value }] }] }

// getMetricHistogram
getMetricHistogramArgsSchema -> { name, bucketBoundaries, filters }
getMetricHistogramResponseSchema -> { boundaries, counts, sum, count }

// getMetricPercentiles
getMetricPercentilesArgsSchema -> { name, percentiles: number[], interval, filters }
getMetricPercentilesResponseSchema -> { series: [{ percentile, points: [{ timestamp, value }] }] }

// getUsageReport (same shape as breakdown)
getUsageReportArgsSchema -> { name, groupBy, aggregation, filters }
getUsageReportResponseSchema -> { groups: [{ dimensions, value }] }
```

### 1c. logs.ts — Add parent/root entity hierarchy

**File**: `packages/core/src/storage/domains/observability/logs.ts`

Add to `contextFields`:
- `parentEntityType`, `parentEntityId`, `parentEntityName` (nullish)
- `rootEntityType`, `rootEntityId`, `rootEntityName` (nullish)
- `experimentId` (nullish)

Update `logsFilterSchema` with parent/root entity filter fields.

### 1d. tracing.ts — Add experimentId to span record

**File**: `packages/core/src/storage/domains/observability/tracing.ts`

Add `experimentId` (nullish) to `spanRecordSchema` shared fields. This enables filtering spans by experiment/eval run without JOINing to scores.

### 1e. base.ts — Replace listMetrics with OLAP query methods

**File**: `packages/core/src/storage/domains/observability/base.ts`

- **Remove** `listMetrics()` method
- **Add** 6 new method stubs (throwing "not implemented"):
  - `getMetricAggregate(args)`
  - `getMetricBreakdown(args)`
  - `getMetricTimeSeries(args)`
  - `getMetricHistogram(args)`
  - `getMetricPercentiles(args)`
  - `getUsageReport(args)`

No existing adapters implement `listMetrics` — safe to remove outright.

### 1f. Discovery / Metadata Schemas (new section in metrics.ts + base.ts)

Add schemas for UI-building discovery endpoints. These are all `SELECT DISTINCT` queries — cheap to implement, cheap to run.

**Schemas** (add to `metrics.ts` or a new `discovery.ts`):
```typescript
// Metric discovery
getMetricNamesArgsSchema -> { prefix?: string, limit?: number }
getMetricNamesResponseSchema -> { names: string[] }

getMetricLabelKeysArgsSchema -> { metricName: string }
getMetricLabelKeysResponseSchema -> { keys: string[] }

getLabelValuesArgsSchema -> { metricName: string, labelKey: string, prefix?: string, limit?: number }
getLabelValuesResponseSchema -> { values: string[] }

// Entity discovery
getEntityTypesArgsSchema -> {}
getEntityTypesResponseSchema -> { entityTypes: string[] }

getEntityNamesArgsSchema -> { entityType?: string }
getEntityNamesResponseSchema -> { names: string[] }

// Environment discovery
getServiceNamesArgsSchema -> {}
getServiceNamesResponseSchema -> { serviceNames: string[] }

getEnvironmentsArgsSchema -> {}
getEnvironmentsResponseSchema -> { environments: string[] }

// Span discovery
getTraceTagsArgsSchema -> { entityType?: string }
getTraceTagsResponseSchema -> { tags: string[] }

```

**Base class stubs** (add to `base.ts`):
- `getMetricNames(args)` — `SELECT DISTINCT name FROM metric_events WHERE name LIKE ?`
- `getMetricLabelKeys(args)` — extract distinct keys from `labels` JSON for a given metric
- `getLabelValues(args)` — extract distinct values for a label key within a metric
- `getEntityTypes(args)` — `SELECT DISTINCT entityType FROM span_events`
- `getEntityNames(args)` — `SELECT DISTINCT entityName FROM span_events WHERE entityType = ?`
- `getServiceNames(args)` — `SELECT DISTINCT serviceName FROM span_events`
- `getEnvironments(args)` — `SELECT DISTINCT environment FROM span_events`
- `getTraceTags(args)` — `SELECT DISTINCT unnest(tags) FROM span_events WHERE tags IS NOT NULL` (+ optional `entityType` filter)
All throw "not implemented" by default like other methods.

### 1g. types.ts — Add span-events strategy (was 1f)

**File**: `packages/core/src/storage/domains/observability/types.ts`

```typescript
export type TracingStorageStrategy = 'realtime' | 'batch-with-updates' | 'insert-only' | 'span-events';
```

### 1h. histogram-buckets.ts — Bucket config constants (new file)

**File**: `packages/core/src/storage/domains/observability/histogram-buckets.ts`

Export:
- Default bucket boundaries by metric name suffix (`*_ms`, `*_tokens*`, `*_bytes`)
- `getBucketBoundaries(metricName: string): number[]` function
- Update `index.ts` to export

### 1i. scores.ts and feedback.ts — Update experimentId import

**Files**: `packages/core/src/storage/domains/observability/scores.ts`, `feedback.ts`

Replace local `experimentIdField` with import from `../shared`.

---

## Part 2: DuckDB Observability Storage Adapter (`stores/duckdb`)

Add observability storage to the existing `@mastra/duckdb` package. This package already has `@duckdb/node-api` 1.4.2 as a dependency and exports `DuckDBVector`.

### 2a. Package structure

Follow the same pattern as `stores/clickhouse/` and `stores/pg/`:
- Domain storage classes live under `storage/domains/{domainName}/index.ts`
- Shared DB utilities live under `storage/db/`
- A top-level storage class composes domain classes

```
stores/duckdb/src/
  index.ts                                    # Add exports for storage
  vector/                                     # Existing vector store (unchanged)
  storage/
    index.ts                                  # DuckDBStore (MastraCompositeStore) or just the observability class
    db/
      index.ts                                # DuckDB connection management, shared query helpers
      utils.ts                                # Type mappings, row transforms
    domains/
      observability/
        index.ts                              # ObservabilityStorageDuckDB class
        ddl.ts                                # Table creation DDL for all 5 tables
        spans.ts                              # Span event write + reconstruction queries
        logs.ts                               # Log write + list queries
        metrics.ts                            # Metric write + 6 OLAP query methods
        scores.ts                             # Score write + list queries
        feedback.ts                           # Feedback write + list queries
        filters.ts                            # Shared filter -> SQL WHERE builder
```

Update `package.json` exports to add `"./storage"` subpath export (alongside existing `"."` for vector).

**DB connection management**: The existing `DuckDBVector` creates its own `DuckDBInstance`. The new storage layer needs the same. Consider a shared `db/index.ts` that manages the DuckDB instance and connection lifecycle, similar to ClickHouse's `storage/db/index.ts` pattern. The vector and storage classes could share a DuckDB instance if configured with the same path, but this is optional — separate instances pointing to the same file work fine (DuckDB handles this with its single-writer lock).

### 2b. DDL — 5 tables auto-created on init

```sql
-- span_events: append-only span lifecycle events
CREATE TABLE IF NOT EXISTS span_events (
  eventType VARCHAR NOT NULL,        -- 'start' | 'update' | 'end'
  timestamp TIMESTAMP NOT NULL,  -- when this event was recorded
  traceId VARCHAR NOT NULL,
  spanId VARCHAR NOT NULL,
  parentSpanId VARCHAR,
  name VARCHAR,
  spanType VARCHAR,
  isEvent BOOLEAN,
  startedAt TIMESTAMP,
  endedAt TIMESTAMP,
  experimentId VARCHAR,
  -- all shared context fields (nullable)
  entityType VARCHAR, entityId VARCHAR, entityName VARCHAR,
  userId VARCHAR, organizationId VARCHAR, resourceId VARCHAR,
  runId VARCHAR, sessionId VARCHAR, threadId VARCHAR, requestId VARCHAR,
  environment VARCHAR, source VARCHAR, serviceName VARCHAR,
  -- JSON columns
  attributes JSON, metadata JSON, tags JSON, scope JSON,
  links JSON, input JSON, output JSON, error JSON
);

-- metric_events: raw metric observations
CREATE TABLE IF NOT EXISTS metric_events (
  id VARCHAR NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  name VARCHAR NOT NULL,
  metricType VARCHAR NOT NULL,
  value DOUBLE NOT NULL,
  labels JSON DEFAULT '{}',
  -- all context fields (nullable)
  traceId VARCHAR, spanId VARCHAR,
  entityType VARCHAR, entityId VARCHAR, entityName VARCHAR,
  parentEntityType VARCHAR, parentEntityId VARCHAR, parentEntityName VARCHAR,
  rootEntityType VARCHAR, rootEntityId VARCHAR, rootEntityName VARCHAR,
  userId VARCHAR, organizationId VARCHAR, resourceId VARCHAR,
  runId VARCHAR, sessionId VARCHAR, threadId VARCHAR, requestId VARCHAR,
  environment VARCHAR, source VARCHAR, serviceName VARCHAR,
  experimentId VARCHAR,
  metadata JSON, scope JSON
);

-- log_events, score_events, feedback_events: similar structure following their Zod schemas
-- All 5 tables include experimentId as a nullable VARCHAR column
-- All tables use a single `timestamp` column — no createdAt/updatedAt
-- (The core Zod schemas still include dbTimestamps for existing adapters;
--  DuckDB adapter maps timestamp only and returns null for createdAt/updatedAt)
```

### 2c. Write methods — All append-only

**Span methods:**
- `createSpan(args)` -> INSERT into `span_events` with `eventType='start'`
- `updateSpan(args)` -> INSERT into `span_events` with `eventType='update'` (NOT a SQL UPDATE)
- `batchCreateSpans(args)` -> Batch INSERT into `span_events`
- `batchUpdateSpans(args)` -> Batch INSERT into `span_events` with `eventType='update'` for each record

**Other signals:**
- `batchCreateLogs(args)` -> Batch INSERT into `log_events`
- `batchRecordMetrics(args)` -> Batch INSERT into `metric_events`
- `createScore(args)` -> INSERT into `score_events`
- `createFeedback(args)` -> INSERT into `feedback_events`

### 2d. Span reconstruction queries

Reconstruct `SpanRecord` from span events using `arg_max`:

```sql
SELECT
  traceId, spanId,
  arg_max(name, timestamp) as name,
  arg_max(spanType, timestamp) as spanType,
  arg_max(parentSpanId, timestamp) as parentSpanId,
  arg_max(isEvent, timestamp) as isEvent,
  min(timestamp) FILTER (WHERE eventType = 'start') as startedAt,
  arg_max(endedAt, timestamp) as endedAt,
  arg_max(output, timestamp) as output,
  arg_max(error, timestamp) as error,
  arg_max(attributes, timestamp) as attributes,
  arg_max(metadata, timestamp) as metadata,
  arg_max(experimentId, timestamp) as experimentId,
  -- ... all other fields
FROM span_events
WHERE traceId = ?
GROUP BY traceId, spanId
```

Implement:
- `getSpan(args)` -> reconstruct single span
- `getRootSpan(args)` -> reconstruct where parentSpanId IS NULL
- `getTrace(args)` -> reconstruct all spans for traceId
- `listTraces(args)` -> reconstruct root spans with filters, pagination, ordering
- `batchDeleteTraces(args)` -> DELETE FROM span_events WHERE traceId IN (...)

Return `SpanRecord` / `TraceSpan` types — callers see identical shapes to existing adapters.

### 2e. OLAP query methods (metrics)

Implement the 6 methods using DuckDB SQL:

- **`getMetricAggregate`** — `SELECT {agg}(value) FROM metric_events WHERE ...` + optional comparison period (shift time range back by period duration)
- **`getMetricBreakdown`** — `SELECT {groupBy cols}, {agg}(value) FROM metric_events WHERE ... GROUP BY {groupBy cols}`
- **`getMetricTimeSeries`** — `SELECT time_bucket(INTERVAL '{interval}', timestamp) as bucket, {agg}(value) FROM metric_events WHERE ... GROUP BY bucket, {optional groupBy} ORDER BY bucket`
- **`getMetricHistogram`** — Use CASE expressions or `width_bucket()` to count values per bucket
- **`getMetricPercentiles`** — `SELECT time_bucket(...), percentile_cont({p}) WITHIN GROUP (ORDER BY value) FROM metric_events WHERE ... GROUP BY bucket`
- **`getUsageReport`** — Same implementation as `getMetricBreakdown`

**`last` aggregation** uses `arg_max(value, timestamp)`.
**`rate` aggregation** uses `(max(value) - min(value)) / EXTRACT(EPOCH FROM max(timestamp) - min(timestamp))`.

All methods use parameterized queries via the DuckDB prepared statement API.

### 2f. Discovery query methods

Implement the 8 discovery methods using simple `SELECT DISTINCT` queries:

- **`getMetricNames`** — `SELECT DISTINCT name FROM metric_events WHERE name LIKE ? ORDER BY name LIMIT ?`
- **`getMetricLabelKeys`** — `SELECT DISTINCT unnest(json_keys(labels)) FROM metric_events WHERE name = ?` (DuckDB supports `json_keys`)
- **`getLabelValues`** — `SELECT DISTINCT labels->>? FROM metric_events WHERE name = ? AND labels->>? IS NOT NULL`
- **`getEntityTypes`** — `SELECT DISTINCT entityType FROM span_events WHERE entityType IS NOT NULL`
- **`getEntityNames`** — `SELECT DISTINCT entityName FROM span_events WHERE entityName IS NOT NULL` (+ optional `entityType` filter)
- **`getServiceNames`** — `SELECT DISTINCT serviceName FROM span_events WHERE serviceName IS NOT NULL`
- **`getEnvironments`** — `SELECT DISTINCT environment FROM span_events WHERE environment IS NOT NULL`
- **`getTraceTags`** — `SELECT DISTINCT unnest(CAST(tags AS VARCHAR[])) FROM span_events WHERE tags IS NOT NULL` (+ optional `entityType` filter)
### 2g. Tracing strategy

```typescript
public override get tracingStrategy() {
  return {
    preferred: 'span-events' as const,
    supported: ['span-events' as const],
  };
}
```

### 2h. List methods (logs, scores, feedback)

Implement `listLogs`, `listScores`, `listFeedback` with standard SQL queries matching the existing filter/pagination/orderBy schemas.

---

## Part 3: DefaultExporter — Span Events Mode (`observability/mastra`)

### 3a. Add span-events strategy to DefaultExporter

**File**: `observability/mastra/src/exporters/default.ts`

The current `insert-only` strategy only processes `SPAN_ENDED` events. The new `span-events` strategy captures ALL lifecycle events:

- `SPAN_STARTED` -> buffer as createSpan (DuckDB adapter inserts `eventType='start'`)
- `SPAN_UPDATED` -> buffer as updateSpan (DuckDB adapter inserts `eventType='update'`)
- `SPAN_ENDED` -> buffer as updateSpan (DuckDB adapter inserts `eventType='end'`)

Buffering and flush behavior follows the same pattern as `batch-with-updates` (size + time triggers), but all operations are INSERTs — no read-then-write.

### 3b. Score/feedback metric event emission

**File**: location TBD (wherever scores/feedback recording happens in the observability pipeline)

When a score or feedback is recorded, also emit metric events:
- `mastra_score_value` (value = score)
- `mastra_scores_total` (value = 1)
- `mastra_feedback_value` (value = feedback value if numeric)
- `mastra_feedback_total` (value = 1)

These go through the normal metric recording path to the DuckDB `metric_events` table.

### 3c. Entity hierarchy enrichment

**File**: `observability/mastra/src/instances/base.ts`

Update `extractEntityLabels()` (or equivalent) to populate:
- `parentEntityType`, `parentEntityId`, `parentEntityName`
- `rootEntityType`, `rootEntityId`, `rootEntityName`

As first-class fields on metric and log records (not as labels).

---

## Breaking Change Assessment

| Change | Breaking? | Mitigation |
|--------|-----------|------------|
| Remove `listMetrics` from base class | No | No existing adapters implement it. |
| Remove `ListMetricsArgs`, `ListMetricsResponse` types | No | Not referenced outside core. |
| Add `'span-events'` to `TracingStorageStrategy` | No | Additive — existing strategies unchanged. |
| Add nullable fields to metric/log/span schemas | No | Additive — existing records pass validation. |
| Add `experimentId` to `spanRecordSchema` | No | Nullable/nullish — existing records pass validation. |
| New methods on `ObservabilityStorage` base | No | Default implementations throw — existing adapters unaffected. |

---

## Files Summary

### Core Schemas (`packages/core`)

| File | Change |
|------|--------|
| `packages/core/src/storage/domains/shared.ts` | Add 7 entity hierarchy fields + experimentId |
| `packages/core/src/storage/domains/observability/metrics.ts` | Add ~20 context fields, update aggregation types, remove listMetrics, add 6 OLAP query schemas |
| `packages/core/src/storage/domains/observability/logs.ts` | Add parent/root entity hierarchy + experimentId |
| `packages/core/src/storage/domains/observability/tracing.ts` | Add experimentId to spanRecordSchema |
| `packages/core/src/storage/domains/observability/base.ts` | Remove listMetrics, add 6 OLAP query method stubs + 8 discovery method stubs |
| `packages/core/src/storage/domains/observability/histogram-buckets.ts` | New — bucket config constants |
| `packages/core/src/storage/domains/observability/index.ts` | Export new file |
| `packages/core/src/storage/domains/observability/types.ts` | Add `'span-events'` to TracingStorageStrategy |
| `packages/core/src/storage/domains/observability/scores.ts` | Import experimentIdField from shared |
| `packages/core/src/storage/domains/observability/feedback.ts` | Import experimentIdField from shared |

### DuckDB Adapter (`stores/duckdb`)

| File | Change |
|------|--------|
| `stores/duckdb/src/storage/db/` | New — DuckDB connection management + utils |
| `stores/duckdb/src/storage/domains/observability/` | New — ObservabilityStorageDuckDB with DDL, writes, span reconstruction, OLAP queries |
| `stores/duckdb/src/index.ts` | Export new class |
| `stores/duckdb/package.json` | Add `"./storage"` export |

### DefaultExporter (`observability/mastra`)

| File | Change |
|------|--------|
| `observability/mastra/src/exporters/default.ts` | Add `'span-events'` strategy handling |
| `observability/mastra/src/instances/base.ts` | Entity hierarchy field enrichment |
| Score/feedback emission location TBD | Emit metric events on score/feedback recording |

---

## Patterns to Reuse

- `createOmitKeys()` helper — in all observability schema files
- `dbTimestamps` shape — reused across record schemas
- `contextFields` pattern from `logs.ts:51-73` — extend to metrics
- `StorageDomain` base class — `packages/core/src/storage/domains/base.ts`
- `DuckDBInstance` from `@duckdb/node-api` — already used in `stores/duckdb/src/vector/index.ts`
- `storage/domains/{name}/index.ts` convention — from `stores/clickhouse/` and `stores/pg/`
- `storage/db/` shared utilities — from `stores/clickhouse/src/storage/db/`
- `resolveTracingStorageStrategy()` in DefaultExporter — extend for span-events
- `buildCreateRecord()` / `buildUpdateRecord()` in DefaultExporter — reuse for span event construction

---

## Verification

1. **TypeScript compilation**: `pnpm build:observability` passes (includes core + duckdb + observability/mastra)
2. **Existing tests**: `pnpm test:observability` — all existing observability tests pass
3. **Schema validation**: Unit tests for new OLAP query schemas (args parsing, response shapes)
4. **DuckDB adapter integration tests**:
   - Create in-memory DuckDB instance
   - Insert span events (start/update/end), verify reconstruction matches expected `SpanRecord`
   - Insert metrics, verify all 6 OLAP query methods return correct results
   - Insert logs/scores/feedback, verify list queries work
   - Verify `listTraces` with filters, pagination, ordering
5. **DefaultExporter tests**: Verify span-events strategy captures all lifecycle events
6. **Backward compatibility**: `pnpm build` passes — existing Postgres/SQLite/ClickHouse adapters compile without changes
