# ClickHouse vNext Feedback Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `feedback_events`.

## Logical Shape

Feedback may be attached to traces and spans, but `v-next` should also support feedback rows without a trace.

Event metadata:

- `timestamp`

Trace correlation:

- `traceId`
- `spanId`
- `experimentId`

Entity hierarchy and context:

- `entityType`
- `entityId`
- `entityName`
- `parentEntityType`
- `parentEntityId`
- `parentEntityName`
- `rootEntityType`
- `rootEntityId`
- `rootEntityName`
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
- `sourceId`

Feedback-specific scalars:

- `feedbackSource`
- `feedbackType`
- logical `value`

Information-only payloads:

- `metadata`
- `comment`

Notes:

- `sourceId` is the identifier of the source record the feedback is linked to, not the feedback category itself
- the feedback category is stored separately in `feedbackSource`
- physical storage should split feedback value into typed columns rather than JSON-encoding a mixed scalar into one string column

## Physical Shape

- `ENGINE = MergeTree`
- `PARTITION BY toDate(timestamp)`
- `ORDER BY (traceId, timestamp)`

Notes:

- `traceId` should be `Nullable(String)` so feedback can exist outside traces
- `feedbackSource` and `feedbackType` are strong `LowCardinality` candidates
- `valueString` and `valueNumber` should not be treated as `LowCardinality`
- `ORDER BY (traceId, timestamp)` is intentional in v0 because feedback is expected to be consumed primarily in trace-scoped reads rather than global recency-first listing
- recency-first global feedback listing is still supported as a secondary compatibility/admin surface, but it is not the primary physical-design driver for `feedback_events`
- `PARTITION BY toDate(timestamp)` supports day-granularity feedback TTL management
- nullable sort keys require the corresponding ClickHouse nullable-key setting in the table DDL
- physical value storage should use two nullable columns:
  - `valueString`
  - `valueNumber`
- exactly one of `valueString` or `valueNumber` should be non-null for a valid v0 feedback row

## Query Contract

- `feedbackSource` should be filterable in v0
- `feedbackType` should be filterable in v0
- `feedback_events` should support the rest of the current public feedback filter surface directly from feedback rows:
  - `timestamp`
  - `traceId`
  - `spanId`
  - `userId`
  - `organizationId`
  - `experimentId`
  - `executionSource`
- the physical layout intentionally favors trace-scoped feedback access over global recency-first listing in v0
- read-path reconstruction should expose the logical feedback `value` by choosing:
  - `valueNumber` when it is non-null
  - otherwise `valueString`
- writes should map string feedback values to `valueString`
- writes should map numeric feedback values to `valueNumber`
- values other than `string` or `number` are out of scope for v0 feedback storage
- `value` should not participate in filtering, search, discovery, or grouping
- split typed storage is intentional so later numeric ordering or numeric post-filter sorting can be added without redesigning the physical value representation
- `comment` should not participate in filtering, search, discovery, or grouping
- `metadata` remains information-only in v0
- typed feedback context fields should be written from explicit top-level record fields rather than promoted from metadata
- `sourceId` should be stored for source linkage, but it is not part of the current public feedback filter surface in v0
- feedback `metadata` is present on the record but is not part of the current public feedback filter schema

## Intentional v0 Limitations

- no metadata search on feedback in v0
- no searchable `value`
- no searchable `comment`
