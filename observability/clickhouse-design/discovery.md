# ClickHouse vNext Observability Discovery Design

## Purpose

Define the helper-table shape, refresh behavior, and endpoint mapping for ClickHouse `v-next` discovery.

## v0 Model

- discovery reads from two dedicated helper tables:
  - `discovery_values`
  - `discovery_pairs`
- both helper tables are normal ClickHouse tables maintained by refreshable materialized views
- do not feed them incrementally from insert-time materialized views in v0
- discovery is intentionally eventually consistent
- do not add discovery over JSON payloads in v0
- do not force scores or feedback into cross-signal discovery just for symmetry

Refreshable helper tables are preferred here because they recompute the current set after deletes and TTL expiry.

Discovery is a best-effort helper feature in v0:

- it does not need to exist at adapter startup
- it does not gate core observability reads or writes
- helper tables and refreshable views may be created later
- bootstrap and scheduled refresh should run automatically when discovery is enabled
- until discovery has been initialized and refreshed successfully, discovery methods should return empty results
- do not silently fall back to base-table scans when discovery helpers are unavailable

## Assumed ClickHouse Feature Set

- prefer target Cloud ClickHouse deployments that support refreshable materialized views for the v0 discovery design
- assume `ARRAY JOIN`, `mapKeys()`, direct `Map` key lookup, and the `LowCardinality(...)`, `Map(...)`, and `Array(...)` types used elsewhere in the design are available
- if refreshable materialized views are not available in the target environment, discovery should be marked unavailable in v0 rather than forcing a different implementation path
- `v-next` should treat refreshable materialized-view support as a discovery capability, not a required runtime capability for the whole observability adapter

## Helper Tables

`discovery_values` stores de-duplicated unique values for:

- `entityType`
- `serviceName`
- `environment`
- `tag`
- `metricName`
- metric `labelKey`

`discovery_pairs` stores de-duplicated key-value style lookups for:

- `entityType -> entityName`
- `metricName + labelKey -> labelValue`

Physical direction in v0:

- `discovery_values` should use `ENGINE = MergeTree`
- `discovery_values` should not use partitioning in v0
- `discovery_values` should use `ORDER BY (kind, key1, value)`
- `discovery_pairs` should use `ENGINE = MergeTree`
- `discovery_pairs` should not use partitioning in v0
- `discovery_pairs` should use `ORDER BY (kind, key1, key2, value)`
- discovery helper tables are fully derived structures; refresh is the consistency mechanism rather than table-local TTL
- `key1` should always be stored as a non-null `String` in `discovery_values`
- `key2` should always be stored as a non-null `String` in `discovery_pairs`
- use the empty-string sentinel when a discovery family has no parent-key or secondary-key dimension in v0
- do not rely on nullable sort-key columns or `allow_nullable_key` for discovery helper tables

### `discovery_values` dimension semantics

- `kind = entityType`
  - `key1 = ''`
  - `value = entityType`
- `kind = serviceName`
  - `key1 = ''`
  - `value = serviceName`
- `kind = environment`
  - `key1 = ''`
  - `value = environment`
- `kind = tag`
  - `key1 = entityType`
  - `value = tag`
- `kind = metricName`
  - `key1 = ''`
  - `value = metric name`
- `kind = metricLabelKey`
  - `key1 = metric name`
  - `value = label key`

### `discovery_pairs` dimension semantics

- `kind = entityTypeName`
  - `key1 = entityType`
  - `key2 = ''`
  - `value = entityName`
- `kind = metricLabelValue`
  - `key1 = metric name`
  - `key2 = label key`
  - `value = label value`

## Source Mapping

Use only these source tables in v0:

- `span_events`
- `metric_events`
- `log_events`

Do not read discovery from:

- `trace_roots`
- `score_events`
- `feedback_events`

Kind mapping:

- `entityType`: union non-null `entityType` values from `span_events`, `metric_events`, and `log_events`
- `serviceName`: union non-null `serviceName` values from `span_events`, `metric_events`, and `log_events`
- `environment`: union non-null `environment` values from `span_events`, `metric_events`, and `log_events`
- `tag`: explode `tags` from `span_events`, `metric_events`, and `log_events`, carrying row `entityType` into `key1`
- `metricName`: distinct metric `name` values from `metric_events`
- `metricLabelKey`: explode metric label keys from `metric_events.labels`, carrying metric `name` into `key1`
- `entityTypeName`: distinct `(entityType, entityName)` pairs from `span_events`, `metric_events`, and `log_events`
- `metricLabelValue`: explode `(name, labelKey, labelValue)` triples from `metric_events.labels`

## Refresh Cadence

Starting defaults:

- refresh `discovery_values` every 1 minute
- refresh `discovery_pairs` every 5 minutes

Rationale:

- `discovery_values` backs the most common lightweight UI pickers, so it should refresh more frequently
- `discovery_pairs` is expected to be larger and less latency-sensitive
- treat these as product defaults, not hard architectural requirements

## Refresh Query Shape

The refresh SQL should normalize each source into a common projection and then apply `UNION ALL` plus an outer `DISTINCT`.

`discovery_values` refresh shape:

- each source subquery should project `kind`, `key1`, and `value`
- use `UNION ALL` across the subqueries for each discovery family
- use an outer `SELECT DISTINCT`
- `key1` should be normalized to `''` when the discovery family has no parent-key dimension
- drop `NULL` and empty-string values for the discovered `value` before the outer `DISTINCT`
- use `ARRAY JOIN tags AS tag` for tag discovery
- use `ARRAY JOIN mapKeys(labels) AS labelKey` for metric label-key discovery

`discovery_pairs` refresh shape:

- each source subquery should project `kind`, `key1`, `key2`, and `value`
- use `UNION ALL` across the subqueries for each pair-discovery family
- use an outer `SELECT DISTINCT`
- `key2` should be normalized to `''` when the discovery family has no secondary-key dimension
- drop `NULL` and empty-string values for the discovered `value` before the outer `DISTINCT`
- for metric label-value discovery, use `ARRAY JOIN mapKeys(labels) AS labelKey` and `labels[labelKey] AS labelValue`

Normalization rules for refresh queries:

- treat source-table tags and labels as already normalized by the base-table write path
- do not add extra fuzzy normalization in discovery refresh
- normalize unused discovery key slots to `''`
- when a discovery family requires a real parent key or secondary key, drop rows where that key is null or empty instead of inventing a synthetic value
- drop null and empty strings from discovered values
- endpoint queries should apply ordering and limits; the helper tables do not store a canonical sort order

## Endpoint Mapping

Current discovery endpoints:

- `getEntityTypes`
- `getEntityNames`
- `getServiceNames`
- `getEnvironments`
- `getTags`
- `getMetricNames`
- `getMetricLabelKeys`
- `getMetricLabelValues`

Entity and service discovery:

- `getEntityTypes` reads from `discovery_values` where `kind = entityType`
- `getEntityNames` reads from `discovery_pairs` where `kind = entityTypeName`
- when `entityType` is provided to `getEntityNames`, filter by the stored entity-type key before ordering and limit
- `getServiceNames` reads from `discovery_values` where `kind = serviceName`
- `getEnvironments` reads from `discovery_values` where `kind = environment`

Tag discovery:

- `getTags` reads from `discovery_values` where `kind = tag`
- when `entityType` is provided to `getTags`, filter on the stored entity-type dimension before ordering and limit

Metric discovery:

- `getMetricNames` reads from `discovery_values` where `kind = metricName`
- apply `prefix` before ordering and `limit` after ordering
- `getMetricLabelKeys` reads from `discovery_values` where `kind = metricLabelKey` and metric name matches
- `getMetricLabelValues` reads from `discovery_pairs` where `kind = metricLabelValue`, metric name matches, and label key matches
- apply `prefix` to metric label values before ordering and `limit` after ordering

Dimension usage notes:

- `getTags(entityType)` should filter `discovery_values.key1 = entityType` for `kind = tag`
- `getMetricLabelKeys(metricName)` should filter `discovery_values.key1 = metricName` for `kind = metricLabelKey`
- `getMetricLabelValues(metricName, labelKey)` should filter `discovery_pairs.key1 = metricName` and `discovery_pairs.key2 = labelKey` for `kind = metricLabelValue`

## Non-Goals

- no discovery over `metadata`
- no discovery over `scope`
- no discovery over `costMetadata`
- no discovery over log `data`
- no discovery over span `metadataRaw`
- no discovery over scores or feedback

## Operational Note

The current discovery API does not expose time-range filters. Refresh queries may still scan broad source ranges, but query-time endpoint cost should no longer depend on scanning the observability base tables directly. That is the intended v0 tradeoff.

Bootstrap and staleness behavior:

- discovery bootstrap is optional and may happen after adapter startup
- after creating the helper tables and refreshable materialized views, bootstrap should trigger an immediate refresh for both discovery tables automatically when possible
- successful discovery bootstrap requires that first refresh to succeed for both discovery tables before discovery is treated as populated
- without that initial refresh, the discovery tables may remain empty until the first scheduled refresh completes, and discovery methods should continue returning empty results during that window
- bootstrap failure should not fail the base observability adapter; discovery methods should continue returning empty results until a later refresh succeeds
- after bootstrap, discovery remains eventually consistent and readers should continue seeing the last successful refresh snapshot
- if a scheduled refresh is slow or fails, discovery data may stay stale beyond the nominal refresh interval
- after at least one successful bootstrap refresh, later scheduled-refresh failures should leave the last successful snapshot in place rather than clearing discovery

Delete and TTL behavior:

- lightweight deletes and TTL expiry in the source tables are reflected in discovery on the next successful refresh
- discovery helpers do not need incremental delete propagation in v0
- discovery freshness after delete or TTL expiry is bounded by refresh cadence rather than immediate read-after-delete guarantees
- discovery helper tables do not need their own TTL in v0 because they are fully derived from the source tables
