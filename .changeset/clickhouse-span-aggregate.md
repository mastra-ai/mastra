---
'@mastra/clickhouse': minor
---

Added `aggregateSpans()` to the ClickHouse observability store. It groups and measures the spans `querySpans()` returns (counts, durations, error rates, tokens, cost), attributes token and cost usage to the span that recorded it, and reports the `span-aggregate` feature. Filters on agent runs, workflow runs, tool calls, and other branch span types read only those spans, so they stay fast over long windows.
