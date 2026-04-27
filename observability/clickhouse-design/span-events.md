# ClickHouse vNext Span Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `span_events`, the full-trace table in ClickHouse `v-next`.

## Stored Model

- persist only completed spans
- use `insert-only` tracing routing so `batchCreateSpans` receives create records derived from `SPAN_ENDED`
- normalize event spans so `endedAt = startedAt` when `isEvent = true` and `endedAt` is null before persistence
- persist the resulting row directly; do not store `eventType`
- each stored row represents the final ended span state
- store `dedupeKey = traceId || ':' || spanId` as the tracing row identity in v0

This intentionally diverges from DuckDB's start/end event model.

## Trace Role

- a trace is the set of spans sharing the same `traceId`
- the root span is the span whose `parentSpanId` is `null`
- `span_events` owns `getTrace` and `getSpan`
- `trace_roots` owns `listTraces` and the root-span listing/filtering path
- `getRootSpan` may continue reading from `trace_roots` in v0 as a secondary compatibility path, but it is not the design driver for that table
- trace-level filters should be evaluated against `trace_roots` unless the filter is explicitly aggregate behavior such as `hasChildError`
- in v0, trace tag behavior should be treated as root-span behavior; non-root span tags are not part of the trace-listing contract

## Logical Shape

IDs:

- `dedupeKey`
- `traceId`
- `spanId`
- `parentSpanId`
- `experimentId`

Entity and context:

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
- public trace records still expose `source`, but the physical storage column is `executionSource`
- `serviceName`
- `requestContext`

Span-specific scalars:

- `name`
- `spanType`
- `isEvent`
- `startedAt`
- `endedAt`

Query-relevant flexible fields:

- `tags`
- `metadataSearch`

Information-only JSON payloads:

- `attributes`
- `scope`
- `links`
- `input`
- `output`
- `error`
- `metadataRaw`

Important notes:

- `requestContext`, `attributes`, `scope`, `links`, `input`, `output`, `error`, and `metadataRaw` are stored as JSON-encoded strings
- the write path should preserve any JSON-serializable value shape for those fields, including scalar values
- `requestContext` is retained for inspection only and does not participate in filtering, search, discovery, or grouping

## Stored Semantics

Status:

- do not store a physical `status` column in `span_events` in v0
- trace status should be derived from the stored span row at query/read time
- use `error != null => error`
- otherwise use `success`
- do not infer trace status from `output`
- `running` remains part of the broader public trace status surface, but `span_events` stores only completed rows in v0 so that filter returns no rows

Event spans:

- event spans are stored as zero-duration spans in ClickHouse
- they should still be written from `SPAN_ENDED` tracing events even if the exported span shape does not carry a real end time
- `isEvent` is the canonical read-time indicator that a row is an event span
- v0 does not require event spans to read back with `endedAt = null`

Read-path shaping:

- `startedAt` must be stored directly because there are no started-span rows to reconstruct it from
- returned span records should reconstruct `metadata` from `metadataRaw`
- returned trace-facing status should be derived from `error` presence rather than loaded from a stored `status` column
- returned span records should populate `createdAt = startedAt` and `updatedAt = null` in v0

## Metadata And Scope Contract

`metadataRaw`:

- stores the original metadata payload for fidelity and response reconstruction
- is JSON-encoded on write even when the logical metadata contains scalar values or mixed nested shapes
- is not a fallback scan target for trace metadata filters

`metadataSearch`:

- stores a top-level string-string index of trace metadata
- only top-level metadata entries whose values are non-empty strings are indexed
- `null`, empty strings, non-string scalar values, arrays, and objects are not indexed
- nested objects and arrays remain available only in `metadataRaw`
- before writing `metadataSearch`, remove the canonical promoted-key set defined in the shared normalization rules because those values already live in typed trace columns

Metadata filter semantics:

- trace metadata filters support equality-only matching against top-level `metadataSearch` keys
- only top-level string metadata values are searchable in v0
- metadata filters that target non-string values, nested values, or non-indexed keys should simply return no rows rather than throw
- v0 does not imply nested-object matching, array membership, wildcard, regex, or partial-match semantics for trace metadata
- this is an intentional v0 ClickHouse contract and should not be described as preserving richer JSON-style metadata filtering from other backends

`scope`:

- stays as a serialized JSON blob for inspection only
- `scope` does not participate in filtering, search, discovery, or grouping in v0
- lack of trace `scope` filtering is an intentional v0 ClickHouse contract

If future ClickHouse version support makes native JSON columns practical, revisit this contract instead of expanding `metadataSearch` indefinitely.

## Physical Shape

- `ENGINE = ReplacingMergeTree`
- `PARTITION BY toDate(endedAt)`
- `ORDER BY (traceId, endedAt, spanId, dedupeKey)`

Notes:

- `PARTITION BY toDate(endedAt)` keeps the physical layout aligned with the ended-span storage model
- it also keeps day-granularity TTL and partition expiry practical for tracing retention
- `ORDER BY (traceId, endedAt, spanId, dedupeKey)` prioritizes full-trace reads and point lookups within a trace while making `dedupeKey` part of the replacement identity
- `dedupeKey` should be persisted with every row so tracing writes can be retried idempotently in v0
- tracing retry-idempotency in v0 assumes duplicate rows for the same `dedupeKey` are byte-identical ended-span rows
- read-path correctness should not rely solely on background merges; tracing queries should still return one row per `dedupeKey`
- `spanType`, `entityType`, `environment`, `executionSource`, and `serviceName` are strong `LowCardinality` candidates

## Query Contract

Routing:

- `getSpan` reads from `span_events`
- `getTrace` reads from `span_events`
- `listTraces` reads from `trace_roots`
- `getRootSpan` may read from `trace_roots` in v0, but it is a secondary compatibility path rather than the physical-design driver
- `getSpan` should filter by `(traceId, spanId)` and use ordinary `LIMIT 1`
- `getTrace` should use a two-stage query shape:
  - inner query: filter to the trace row set, apply a deterministic pre-dedupe `ORDER BY`, then use `LIMIT 1 BY dedupeKey`
  - outer query: apply the final span presentation ordering over the deduplicated trace rows
- because duplicate tracing rows are required to be byte-identical in v0, the pre-dedupe ordering only needs to be deterministic; it is not selecting between semantically different row versions
- `getTrace` should not rely on a single-level query to both deduplicate and apply final span ordering

Trace filter behavior:

- all trace filters other than `hasChildError` are evaluated against the root span
- trace status filtering is derived from the root row rather than a stored `status` column:
  - `status = error` means `error IS NOT NULL`
  - `status = success` means `error IS NULL`
  - `status = running` returns no rows in v0 because only completed rows are stored
- trace `metadata` filters target `metadataSearch`
- trace metadata filtering is intentionally limited to top-level string equality in v0
- trace `scope` filtering is intentionally unsupported in v0

`hasChildError`:

- compute it at query time as "any non-root span in the same trace has `error IS NOT NULL`"
- exclude the root span itself from the `hasChildError` check
- do not store a dedicated helper column on `span_events` in v0
- this is a slower query-derived path in v0 and may require checking child-span existence from `trace_roots`-driven trace listing queries
- the child-span existence check does not need `FINAL` or a separate dedupe layer in v0, because duplicate tracing rows for the same `dedupeKey` are required to be byte-identical and therefore do not change the boolean result
- if it later needs optimization, prefer a refreshable trace-level helper structure rather than row-local denormalization

## Intentional v0 Limitations

- no live or running trace visibility
- no reconstruction from start/end span events
- no search over non-string metadata values
- no nested metadata filtering
- no scope filtering
- no metadata grouping or discovery from `metadataRaw`
- non-tracing tables remain non-idempotent in v0; retry-idempotency is limited to `span_events` / `trace_roots`
