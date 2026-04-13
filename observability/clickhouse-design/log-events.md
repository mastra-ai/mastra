# ClickHouse vNext Log Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `log_events`.

## Logical Shape

Event metadata:

- `timestamp`
- `level`

Correlation and experiment ids:

- `traceId`
- `spanId`
- `experimentId`

Entity hierarchy:

- `entityType`
- `entityId`
- `entityName`
- `parentEntityType`
- `parentEntityId`
- `parentEntityName`
- `rootEntityType`
- `rootEntityId`
- `rootEntityName`

Context:

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

Log-specific scalars:

- `message`

Flexible and JSON payloads:

- `tags`
- `data`
- `metadata`
- `scope`

## Physical Shape

- `ENGINE = MergeTree`
- `PARTITION BY toDate(timestamp)`
- `ORDER BY (timestamp, traceId)`

Notes:

- `level`, entity type fields, `environment`, `executionSource`, and `serviceName` are strong `LowCardinality` candidates
- `tags` should use `Array(LowCardinality(String))`
- `PARTITION BY toDate(timestamp)` supports day-granularity log TTL management
- `ORDER BY (timestamp, traceId)` is intentional in v0 because logs are designed primarily for recency-first reads
- trace-correlated log reads are supported, but they are not the primary physical-design driver for `log_events`

## Query Contract

- `listLogs` should support the current public log filter surface
- `tags` remain filterable under the shared tag semantics
- `data`, `metadata`, and `scope` are retained on the row but do not participate in discovery or grouping in v0
- log `metadata` is present on the record but is not part of the current public log filter schema

## Intentional v0 Limitations

- no searchable metadata map for logs
- no filtering or grouping on `data`
- no filtering or grouping on `scope`
