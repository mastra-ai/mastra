---
'@mastra/clickhouse': minor
---

Improved metric drilldown performance with skip indexes on the high-cardinality ID columns of `metric_events`. Dashboard queries that filter metrics by `traceId`, `threadId`, `resourceId`, `userId`, `organizationId`, `experimentId`, `runId`, `sessionId`, or `requestId` skip data chunks that don't contain the filtered value instead of scanning the full time range.

Equality (`=`) and `IN` filters benefit automatically. Aggregations and `GROUP BY` queries without a filter on these columns are unaffected.

**Migration**

Existing deployments pick up the indexes on next start. The migration is metadata-only and instant — no table lock, no rewrite, no downtime. Insert overhead is negligible and index storage is well under 1% of table size. Existing data is indexed lazily as parts merge under normal retention; no operator action is required.
