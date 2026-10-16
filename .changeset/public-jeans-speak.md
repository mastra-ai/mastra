---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/clickhouse': patch
'@mastra/server': patch
'@mastra/duckdb': patch
'@mastra/pg': patch
---

Added `querySpans()` filters and response fields for span context and parent/root entity information.

Removed `model` and `provider` filtering from `querySpans()`; both fields remain in returned rows. Removed `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated` from its response. Update callers that filter by model/provider or read those response fields. Name matching, duration filtering and input/output/error previews remain available. Storage adapters no longer fetch cost metrics for span queries.

Upgrade core and storage adapters together. DuckDB returns null for parent/root entity type, ID and name, and execution source until those fields are stored.

Reduced ClickHouse span-query memory by selecting current span copies in one scan. Copies of a span must share the same start time.

ClickHouse now generates missing previews in batches of 32 spans, avoiding retention of a full page of raw payloads during preview fallback.

New dedicated-field filters use the existing predicate format:

```ts
// Previously rejected by querySpans; now supported.
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```
