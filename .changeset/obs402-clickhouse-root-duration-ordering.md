---
'@mastra/clickhouse': minor
---

Added root-duration ordering to the ClickHouse vNext observability store. Advanced trace queries planned with `orderBy: [{ field: 'durationMs', direction: 'asc' }]` now order completed traces by their root span's duration, with `traceId` tie-breaks and duplicate-free keyset and numbered pagination across equal durations. The store advertises the new `trace-query-root-duration-ordering` capability.
