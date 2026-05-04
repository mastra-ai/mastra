---
'@mastra/clickhouse': minor
---

**Added** `listBranches` and `getSpans` implementations. Branches are stored in a new `mastra_trace_branches` table fed by an incremental materialized view (`mastra_mv_trace_branches`) from `mastra_span_events`.

The materialized view triggers on new inserts only — existing deployments with historical span data will see `listBranches` return empty until new spans flow in, and operators wanting historical results need to backfill with a one-off `INSERT INTO mastra_trace_branches SELECT ... FROM mastra_span_events WHERE spanType IN (...)`.
