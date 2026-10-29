---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Span queries and span aggregates can filter by `model` and `provider`. Filters read only the dedicated `model` and `provider` columns, never span attributes, so spans written before those columns existed don't match them. Results still return `model` and `provider` for those older spans, read from their attributes.
