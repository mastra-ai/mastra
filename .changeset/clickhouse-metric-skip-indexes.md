---
'@mastra/clickhouse': minor
---

Added bloom-filter skip indexes on the high-cardinality ID columns of `metric_events` so dashboard drilldowns ("metrics for this thread", "metrics for this run", etc.) skip granule chunks that definitely do not contain the filtered ID instead of scanning the full time range.

**Indexed columns**

`traceId`, `threadId`, `resourceId`, `userId`, `organizationId`, `experimentId`, `runId`, `sessionId`, `requestId`. All use `bloom_filter(0.01) GRANULARITY 2` (1% false-positive rate, 16K-row chunks). Tracked via the new `METRIC_SKIP_INDEX_NAMES` export.

**Where this helps**

Equality and `IN` filters on the indexed columns. The sort key `(name, timestamp, metricId)` still drives the time-range scan; bloom filters narrow what is read inside that range. Aggregations and `GROUP BY` without a WHERE on these columns are unaffected.

**Migration**

Existing deployments pick the indexes up via additive `ALTER TABLE … ADD INDEX IF NOT EXISTS …` statements. The DDL is metadata-only and instant — no table lock, no rewrite, no downtime.

Existing parts keep no index until they are merged or `MATERIALIZE INDEX` is run explicitly. New parts written after the migration are bloom-filtered immediately, so under normal metric retention the table converges to full index coverage without operator action.

If you want to backfill existing parts immediately, run during a maintenance window (this rewrites part data and is IO-heavy on large tables):

```sql
ALTER TABLE mastra_metric_events MATERIALIZE INDEX idx_threadId;
-- ... and similarly for the other index names in METRIC_SKIP_INDEX_NAMES
```

**Cost**

A few percent of insert overhead (extra hashes per indexed column). Index storage is well under 1% of typical table size. `DROP INDEX` is also instant if you ever need to roll back.
