# ClickHouse vNext Metric Events Design

## Purpose

Define the logical shape, physical shape, and query contract for `metric_events`.

## Logical Shape

Event metadata:

- `timestamp`
- `name`

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
- `provider`
- `model`

Metric-specific scalars:

- `value`
- `estimatedCost`
- `costUnit`

Flexible and JSON payloads:

- `tags`
- `labels`
- `costMetadata`
- `metadata`
- `scope`

Important note:

- `metric_events` should not store a `status` column in v0 because metric emission does not know the final terminal status of the enclosing trace or span at write time

## Physical Shape

- `ENGINE = MergeTree`
- `PARTITION BY toDate(timestamp)`
- `ORDER BY (name, timestamp)`

Notes:

- `name`, entity type fields, `environment`, `executionSource`, `serviceName`, and `provider` are strong `LowCardinality` candidates
- `labels` should use `Map(LowCardinality(String), String)`
- `tags` should use `Array(LowCardinality(String))`
- `PARTITION BY toDate(timestamp)` supports day-granularity metric TTL management

## Query Contract

Supported operations:

- `batchCreateMetrics`
- `listMetrics`
- `getMetricAggregate`
- `getMetricBreakdown`
- `getMetricTimeSeries`
- `getMetricPercentiles`
- metric discovery for names, label keys, and label values

Response shaping:

- aggregate, breakdown, and time-series responses return `value` plus optional `estimatedCost` and `costUnit`
- percentile responses remain value-only

Filter behavior:

- support the current public metrics filter surface directly from typed columns plus `labels` and `tags`
- `metadata`, `costMetadata`, and `scope` are stored on the row but are not part of the current metrics filter schema
- metric `labels` filters use contains-all semantics over exact key/value pairs after shared normalization
- v0 does not imply wildcard, regex, prefix, substring, or fuzzy-match semantics for metric `labels`

`groupBy` behavior:

- if a `groupBy` key matches a typed metric column, group by that typed column
- otherwise, treat the key as a metric-label key and group by the value stored under `labels`
- typed metric columns win when a `groupBy` key collides with both a typed column name and a label key
- rows missing the requested label key are excluded from that label-based grouped result
- `metadata`, `costMetadata`, and `scope` do not participate in `groupBy`

Discovery:

- metric discovery reads the shared helper tables rather than scanning `metric_events` directly
- `getMetricNames` reads from `discovery_values`
- `getMetricLabelKeys` reads from `discovery_values`
- `getMetricLabelValues` reads from `discovery_pairs`

## Intentional v0 Limitations

- no stored `status`
- no grouping by `metadata`, `costMetadata`, or `scope`
- avoid JSON extraction on the hot path for label-aware grouping when a typed column or normalized `labels` lookup is sufficient
