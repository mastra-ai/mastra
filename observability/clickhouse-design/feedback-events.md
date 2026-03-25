# ClickHouse vNext Feedback Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `feedback_events`.

## Logical Shape

Feedback is trace-attached in v0. It should be modeled as an annotation on a trace or span, not as a standalone event stream with broad shared observability context.

Event metadata:

- `timestamp`

Trace correlation and supported typed context:

- `traceId`
- `spanId`
- `experimentId`
- `userId`
- `organizationId`
- `sourceId`

Notes:

- `userId` should be populated from feedback metadata at adapter insertion time when `metadata.userId` exists as a string
- `organizationId` should be populated from feedback metadata at adapter insertion time when `metadata.organizationId` exists as a string
- these are adapter-level promoted fields, not a reason to broaden feedback record-builder context shaping in v0

Feedback-specific scalars:

- `source`
- `feedbackType`
- logical `value`

Information-only payloads:

- `metadata`
- `comment`

Notes:

- `sourceId` is the identifier of the source record the feedback is linked to, not the feedback category itself
- the feedback category is stored separately in `source`
- physical storage should split feedback value into typed columns rather than JSON-encoding a mixed scalar into one string column

## Physical Shape

- `ENGINE = MergeTree`
- `PARTITION BY toDate(timestamp)`
- `ORDER BY (traceId, timestamp)`

Notes:

- `source` and `feedbackType` are strong `LowCardinality` candidates
- `valueString` and `valueNumber` should not be treated as `LowCardinality`
- `ORDER BY (traceId, timestamp)` is intentional in v0 because feedback is expected to be consumed primarily in trace-scoped reads rather than global recency-first listing
- recency-first global feedback listing is still supported as a secondary compatibility/admin surface, but it is not the primary physical-design driver for `feedback_events`
- `PARTITION BY toDate(timestamp)` supports day-granularity feedback TTL management
- physical value storage should use two nullable columns:
  - `valueString`
  - `valueNumber`
- exactly one of `valueString` or `valueNumber` should be non-null for a valid v0 feedback row

## Query Contract

- `source` should be filterable in v0
- `feedbackType` should be filterable in v0
- `feedback_events` should support the rest of the current public feedback filter surface directly from feedback rows:
  - `timestamp`
  - `traceId`
  - `spanId`
  - `userId`
  - `organizationId`
  - `experimentId`
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
- `userId` should be filterable in v0, and adapter writes may derive it from `metadata.userId` when present
- `organizationId` should be filterable in v0, and adapter writes may derive it from `metadata.organizationId` when present
- `sourceId` should be stored for source linkage, but it is not part of the current public feedback filter surface in v0
- `feedback_events` should not add standalone entity/context columns such as `entityType`, `entityId`, `entityName`, `environment`, or `serviceName` in v0 just for cross-signal symmetry
- any feedback write-path alignment work should be limited to the current public feedback record and filter contract
- feedback `metadata` is present on the record but is not part of the current public feedback filter schema

## Intentional v0 Limitations

- no parent or root entity hierarchy on feedback in v0
- no standalone feedback-oriented discovery or generic cross-signal entity filtering in v0
- no metadata search on feedback in v0
- no searchable `value`
- no searchable `comment`
