# ClickHouse vNext Observability Shared Design

## Purpose

Capture the cross-cutting decisions for ClickHouse `v-next` so the per-table docs can stay focused on table-specific behavior.

## Scope

- support all five observability signals in the first `v-next` pass:
  - tracing via `span_events` plus `trace_roots`
  - `metric_events`
  - `log_events`
  - `score_events`
  - `feedback_events`
- keep the `v-next` code path isolated from the current ClickHouse observability implementation
- preserve the standard Mastra `ObservabilityStorage` integration surface with `DefaultExporter`

## Non-Goals

- reusing the current ClickHouse observability schema as the design driver
- finalizing every long-term optimization before the base tables exist
- forcing ClickHouse semantics to mirror DuckDB internals when ClickHouse-specific behavior is a better fit

## Core v0 Model

- use append-only ClickHouse tables for all five signals
- use `ReplacingMergeTree` for `span_events` and `trace_roots`
- use plain `MergeTree` for `metric_events`, `log_events`, `score_events`, and `feedback_events`
- use `insert-only` tracing routing in ClickHouse `v-next`
- persist only create records for completed spans
- allow scores and feedback to be associated with traces and spans when present, but still support rows with nullable `traceId`
- normalize event spans so `endedAt = startedAt` when `isEvent = true` and `endedAt` is null before persistence
- use `span_events` as the tracing write target and full-trace read table
- use `trace_roots` as the `listTraces` helper table in v0
- populate `trace_roots` from `span_events` with an incremental materialized view
- make tracing retry-idempotent in v0 with a tracing-only `dedupeKey = traceId || ':' || spanId`
- propagate the same tracing `dedupeKey` from `span_events` into `trace_roots`
- do not add dedupe keys to `metric_events`, `log_events`, `score_events`, or `feedback_events` in v0
- use `discovery_values` and `discovery_pairs` as refreshable helper tables for discovery
- do not add physical `createdAt` or `updatedAt` columns to the `v-next` tables
- use raw ClickHouse DDL for the `v-next` schema

Expected `observabilityStrategy` direction:

- preferred: `insert-only`
- supported: `insert-only`

Adapter note:

- the `v-next` ClickHouse observability domain must expose `observabilityStrategy` as the authoritative strategy property
- `DefaultExporter` reads `observabilityStrategy`, so `v-next` should not treat `tracingStrategy` as the primary integration surface
- `v-next` should not expose a `tracingStrategy` compatibility alias

## Domain Layout

```text
stores/clickhouse/src/storage/domains/observability/v-next/
  index.ts
  ddl.ts
  metrics.ts
  tracing.ts
  trace-roots.ts
  logs.ts
  scores.ts
  feedback.ts
  discovery.ts
  filters.ts
  helpers.ts
```

## Write Path

The intended write path does not change:

1. observability signals are emitted from the runtime
2. `DefaultExporter` batches the events
3. the exporter calls the relevant `batchCreate*` method on the observability storage domain
4. ClickHouse `v-next` persists and queries those records through the standard storage interface

Important notes:

- in the current exporter implementation, `observabilityStrategy` affects tracing-event routing only
- metrics, logs, scores, and feedback still flow as create-only batched writes
- `insert-only` should keep started-span records out of the `batchCreateSpans` path in normal operation
- `batchUpdateSpans` should remain unimplemented in ClickHouse `v-next`; normal tracing writes should rely on the insert-only create path only
- tracing writes should compute and persist `dedupeKey = traceId || ':' || spanId` in the ClickHouse adapter before insert
- tracing reads should return one row per `dedupeKey` without relying solely on background `ReplacingMergeTree` merges
- non-tracing signals remain append-only and are not retry-idempotent in v0
- scores and feedback should use the same broadened typed context pattern as logs and metrics for entity hierarchy, correlation ids, deployment metadata, and execution source
- non-trace signals should treat `metadata` as information-only payload rather than a fallback source for typed identity fields

## v0 Trace Behavior

ClickHouse `v-next` tracing behaves as follows in v0:

- it stores and returns only completed spans and traces
- it treats `(traceId, spanId)` as the logical tracing row identity in `span_events` and `trace_roots`
- `status = running` may still exist in the shared public API, but ClickHouse `v-next` v0 should return no rows for that filter
- trace status is derived from stored root/span rows rather than persisted as a dedicated tracing column in v0
- trace listing and root-span filtering operate on root rows
- ClickHouse `v-next` intentionally narrows trace metadata filtering to top-level string equality over `metadataSearch`
- ClickHouse `v-next` does not support trace `scope` filtering in v0
- this narrowed trace-filter behavior is an intentional v0 contract, not an accidental implementation gap

Implementation tests should lock in the lack of live-running trace visibility explicitly.

## Shared Field Rules

### Column naming

- prefer public field names directly as ClickHouse column names when there is no real ambiguity inside the table
- use `executionSource` as the physical execution-context column for tracing storage, logs, metrics, scores, and feedback
- keep `scoreSource` and `feedbackSource` as the signal-specific source columns for score and feedback records
- if a storage-specific rename ever becomes necessary later, keep it explicit and centralized

### Tracing retry idempotency

- `span_events` and `trace_roots` should each store a physical `dedupeKey: String`
- in v0, `dedupeKey` is the natural tracing identity string `traceId || ':' || spanId`
- `trace_roots.dedupeKey` should match the root row's `span_events.dedupeKey`
- tracing DDL/query code should treat `dedupeKey` as the tracing row identity used to prevent duplicate rows from exporter retries
- v0 retry-idempotency assumes duplicate tracing writes for the same `dedupeKey` are byte-identical ended-span rows
- that means the same `dedupeKey` must not be re-emitted with different timestamps, error state, metadata, or other payload fields in v0
- if a producer retries the same `dedupeKey` with different row contents, that violates the v0 tracing write contract
- tracing tables should use `ReplacingMergeTree`, with `dedupeKey` participating in the sorting key for replacement identity
- because duplicate tracing rows are required to be identical in v0, `ReplacingMergeTree` does not need a version column for correctness
- tracing read paths should still apply query-time dedupe semantics where needed so duplicate rows are not exposed before background merges complete
- normal tracing reads should not rely on `FINAL` for correctness in v0
- point lookups should read by tracing identity and use ordinary `LIMIT 1`
- multi-row tracing reads should use a two-stage query shape:
  - inner query: narrow the candidate row set first, apply a deterministic pre-dedupe `ORDER BY`, then use `LIMIT 1 BY dedupeKey`
  - outer query: apply final presentation ordering, pagination, or counting over the already-deduplicated row set
- do not describe `LIMIT 1 BY dedupeKey` as if it preserves a second ordering automatically; final ordering requires the outer query layer
- non-tracing signal tables do not get dedupe keys in v0
- duplicate metrics, logs, scores, and feedback caused by retried writes are an accepted v0 limitation until a later event-id design exists

### Typed query-hot columns

- keep query-hot dimensions in typed columns
- do not hide stable product dimensions inside JSON if they need filtering, grouping, or discovery support

### Information-only JSON payloads

These fields stay off the hot query path in v0:

- `metadata`
- `scope`
- `costMetadata`
- log `data`
- span `attributes`
- span `links`
- span `input`
- span `output`
- span `error`
- span `requestContext`

Rules:

- store them as JSON-encoded strings
- preserve any JSON-serializable value shape, including scalars and `null`
- JSON-encode on writes and JSON-decode on reads
- do not use them for discovery or grouping
- `requestContext` is retained for inspection only and does not participate in filtering or search

Tracing is the exception for metadata:

- `span_events.metadataRaw` keeps the full logical metadata payload for fidelity and response reconstruction
- `span_events.metadataSearch` is a narrowed string-string search surface for trace metadata filters
- `trace_roots` uses the same `metadataRaw` / `metadataSearch` split as the root-row projection of `span_events`

### Query-relevant flexible fields

These flexible fields remain query-relevant in v0:

- `tags`
- `labels`
- `span_events.metadataSearch`
- `trace_roots.metadataSearch`

Current physical direction:

- `tags`: `Array(LowCardinality(String))`
- `labels`: `Map(LowCardinality(String), String)`
- `metadataSearch`: `Map(LowCardinality(String), String)`

Not every table needs `tags` or `labels`; this applies only where those fields exist.

## Shared Filter And Normalization Rules

Filter semantics:

- `tags` filters use contains-all semantics
- `labels` filters use contains-all semantics over exact key/value pairs
- unless a specific endpoint says otherwise, v0 does not imply wildcard, regex, prefix, substring, or fuzzy-match semantics for `tags` or `labels`

Normalization rules:

- `labels`: trim string values; drop `null`, non-string, and empty values
- `tags`: trim string values; drop `null`, non-string, and empty values; de-duplicate repeated tags within a row
- `metadataSearch`: keep only top-level metadata entries whose values are non-empty strings; drop `null`, non-string values, arrays, and objects
- before writing `metadataSearch`, remove this canonical promoted-key set because those values already live in typed trace columns:
  - `experimentId`
  - `entityType`
  - `entityId`
  - `entityName`
  - `userId`
  - `organizationId`
  - `resourceId`
  - `runId`
  - `sessionId`
  - `threadId`
  - `requestId`
  - `environment`
  - `executionSource`
  - `serviceName`

Important note:

- `span_events.metadataSearch` and `trace_roots.metadataSearch` are intentionally limited to basic top-level string equality filtering
- this is an intentional v0 ClickHouse contract, not just an implementation shortcut
- they are not meant to preserve arbitrary JSON-path or nested metadata-query behavior from other backends

## LowCardinality Guidance

Strong v0 candidates:

- `entityType`
- `parentEntityType`
- `rootEntityType`
- `environment`
- `source`
- `serviceName`
- metric `name`
- `provider`

Intentional v0 decisions:

- do not treat `entityId` or `entityName` fields as `LowCardinality`
- do not treat `model` as `LowCardinality`
- do not treat `feedback_events.valueString` or `feedback_events.valueNumber` as `LowCardinality`

## Discovery

- discovery queries should read from dedicated helper tables rather than scanning the signal tables directly
- maintain `discovery_values` and `discovery_pairs` with refreshable materialized views in v0
- discovery is intentionally eventually consistent in v0
- discovery is a best-effort helper subsystem in v0, not a startup requirement for core observability
- discovery support in v0 prefers target ClickHouse environments that support refreshable materialized views
- if that capability is unavailable, `v-next` should mark discovery unavailable rather than fail the base observability adapter
- if discovery setup or refresh fails, core writes and core reads for spans, metrics, logs, scores, and feedback should continue to work
- discovery bootstrap and scheduled refresh should run automatically when discovery is enabled
- before the first successful discovery refresh, discovery methods should return empty results rather than explicit unavailable/not-initialized errors
- do not silently fall back to base-table scans for discovery when helper tables are unavailable
- scores and feedback should not be forced into cross-signal entity discovery just for symmetry

## Deletes And Retention

Delete behavior:

- `batchDeleteTraces` and similar delete-style operations should use ClickHouse lightweight deletes
- assume eventual consistency for deletes
- `dangerouslyClearAll` should use `TRUNCATE TABLE`
- delete-style trace operations must apply to both `span_events` and `trace_roots`
- trace deletes should target tracing rows by tracing identity, including `dedupeKey`, in both tables
- the incremental materialized view feeding `trace_roots` does not make deletes or truncation propagate automatically
- `batchDeleteTraces` should issue explicit lightweight deletes to both `span_events` and `trace_roots`
- `dangerouslyClearAll` should explicitly truncate both `span_events` and `trace_roots`
- `ReplacingMergeTree` on tracing tables does not change the eventual-consistency behavior of deletes
- read-after-delete is not a strict correctness guarantee in ClickHouse `v-next` v0
- delete-path tests should verify successful execution and eventual disappearance semantics rather than immediate absence

Retention behavior:

- TTL should be configurable per signal in day increments
- tracing retention should apply consistently to both `span_events` and `trace_roots`
- tracing TTL configuration should be kept identical across `span_events` and `trace_roots`
- day-based partitioning is the default physical strategy because it keeps day-granularity expiry and partition management straightforward
- v0 is optimized for signal-level retention, not for retaining selected trace subsets longer than their source signal tables

Future requirements such as "keep traces with scores for 30 days but drop ordinary traces after 10 days" are explicitly out of scope for v0. If that retention split becomes necessary later, it will likely require adjacent trace/span retention tables or another explicit archival/export path before source partitions are dropped.

## DDL And Helper Structures

- use raw ClickHouse DDL in `v-next/ddl.ts`
- do not try to force `Map(...)`, `Array(...)`, or `LowCardinality(...)` through the current generic storage-schema abstraction
- use one tracing helper structure in v0:
  - `trace_roots`
  - one incremental materialized view from `span_events` into `trace_roots`
- use `ReplacingMergeTree` only for tracing tables that need retry-idempotency in v0
- use two discovery helper structures in v0:
  - `discovery_values`
  - `discovery_pairs`
- keep `hasChildError` query-derived in v0
- define `hasChildError` as "any non-root span in the trace has `error IS NOT NULL`"
- if `hasChildError` later becomes a concrete performance problem, prefer a refreshable trace-level helper structure over row-local denormalization on `span_events` or `trace_roots`

## Testing Expectations

At minimum, `v-next` tests should cover:

- per-table write/read happy paths
- tracing insert-only routing with ended-span-only persistence
- tracing retry-idempotency via `dedupeKey` in `span_events` and `trace_roots`
- tracing reads returning one row per `dedupeKey` before background merges complete
- `trace_roots` materialized-view population
- discovery helper refresh behavior
- per-table `ORDER BY` expectations where testable
- derived trace status semantics
- trace `hasChildError`
- `metadataRaw` vs `metadataSearch`
- exact filter-surface behavior per signal
- shared normalization rules
- mixed `costUnit` behavior in metrics responses
- delete eventual-consistency expectations

## Reference Behavior

- ClickHouse semantics are the primary reference for `v-next`
- DuckDB is a parity reference, not the source of ClickHouse query semantics
