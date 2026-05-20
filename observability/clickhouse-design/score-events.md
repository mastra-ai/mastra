# ClickHouse vNext Score Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `score_events`.

## Logical Shape

Scores may be attached to traces and spans, but `v-next` should also support score rows without a trace.

Event metadata:

- `timestamp`

Trace correlation:

- `traceId`
- `spanId`
- `experimentId`
- `scoreTraceId`

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

Score-specific scalars:

- `scorerId`
- `scorerVersion`
- `scoreSource`
- `score`

Information-only payloads:

- `reason`
- `metadata`
- `scope`

## Physical Shape

- `ENGINE = MergeTree`
- `PARTITION BY toDate(timestamp)`
- `ORDER BY (traceId, timestamp)`

Notes:

- `traceId` should be `Nullable(String)` so scores can exist outside traces
- `scoreSource`, `scorerId`, and `scorerVersion` are strong `LowCardinality` candidates
- `ORDER BY (traceId, timestamp)` is intentional in v0 because scores are expected to be consumed primarily in trace-scoped reads rather than global recency-first listing
- recency-first global score listing is still supported as a secondary compatibility/admin surface, but it is not the primary physical-design driver for `score_events`
- `PARTITION BY toDate(timestamp)` supports day-granularity score TTL management
- nullable sort keys require the corresponding ClickHouse nullable-key setting in the table DDL

## Query Contract

- `listScores` should support the current public score filter surface directly from score rows:
  - `timestamp`
  - `traceId`
  - `spanId`
  - `organizationId`
  - `experimentId`
  - `scorerId`
  - `scoreSource`
  - `executionSource`
- the physical layout intentionally favors trace-scoped score access over global recency-first listing in v0
- `reason` is retained for display but does not participate in filtering, search, discovery, or grouping
- `metadata` and `scope` remain information-only in v0
- typed score context fields should be written from explicit top-level record fields rather than promoted from metadata
- score `metadata` is present on the record but is not part of the current public score filter schema

## Intentional v0 Limitations

- no metadata search on scores in v0
- no queryable `reason` field in v0
