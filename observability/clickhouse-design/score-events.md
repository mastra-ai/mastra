# ClickHouse vNext Score Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `score_events`.

## Logical Shape

Scores are trace-attached annotations in v0. They should be modeled around the trace/span relationship rather than as a standalone event stream with broad cross-signal context.

Event metadata:

- `timestamp`

Trace correlation and supported typed context:

- `traceId`
- `spanId`
- `experimentId`
- `organizationId`
- `scoreTraceId`

Notes:

- `organizationId` should be populated from score metadata at adapter insertion time when `metadata.organizationId` exists as a string
- this is an adapter-level promoted field, not a reason to broaden score record-builder context shaping in v0

Score-specific scalars:

- `scorerId`
- `scorerVersion`
- `source`
- `score`

Information-only payloads:

- `reason`
- `metadata`

## Physical Shape

- `ENGINE = MergeTree`
- `PARTITION BY toDate(timestamp)`
- `ORDER BY (traceId, timestamp)`

Notes:

- `source`, `scorerId`, and `scorerVersion` are strong `LowCardinality` candidates
- `ORDER BY (traceId, timestamp)` is intentional in v0 because scores are expected to be consumed primarily in trace-scoped reads rather than global recency-first listing
- recency-first global score listing is still supported as a secondary compatibility/admin surface, but it is not the primary physical-design driver for `score_events`
- `PARTITION BY toDate(timestamp)` supports day-granularity score TTL management

## Query Contract

- `listScores` should support the current public score filter surface directly from score rows:
  - `timestamp`
  - `traceId`
  - `spanId`
  - `organizationId`
  - `experimentId`
  - `scorerId`
- the physical layout intentionally favors trace-scoped score access over global recency-first listing in v0
- `reason` is retained for display but does not participate in filtering, search, discovery, or grouping
- `metadata` remains information-only in v0
- `organizationId` should be filterable in v0, and adapter writes may derive it from `metadata.organizationId` when present
- `score_events` should not add standalone entity/context columns such as `entityType`, `entityId`, `entityName`, `userId`, `environment`, or `serviceName` in v0 just for cross-signal symmetry
- any score write-path alignment work should be limited to the current public score record and filter contract
- score `metadata` is present on the record but is not part of the current public score filter schema

## Intentional v0 Limitations

- no parent or root entity hierarchy on scores in v0
- no standalone score-oriented discovery or generic cross-signal entity filtering in v0
- no metadata search on scores in v0
- no queryable `reason` field in v0
