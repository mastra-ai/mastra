---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Span queries and span aggregates can filter by `model` and `provider`. These filters read only the dedicated `model` and `provider` columns, not span attributes. `@mastra/observability` fills the columns only when a span has both a `model` and a `provider`, and versions before it filled them left them empty, so filters don't match those spans. Results still return `model` and `provider` for them, read from their attributes.
