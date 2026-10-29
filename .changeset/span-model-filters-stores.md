---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Span queries and span aggregates can filter by `model` and `provider`. These filters read only the dedicated `model` and `provider` columns, not span attributes. `@mastra/observability` fills the columns only when a span has both a `model` and a `provider`, and versions before it filled them left them empty, so those spans count as missing: `eq`, `in` and `exists` don't match them, while `ne`, `notIn` and `notExists` do. Results still return `model` and `provider` for them, read from their attributes.

```typescript
const { spans } = await mastraClient.querySpans({
  timeRange,
  where: { op: 'eq', left: { path: 'provider' }, right: { literal: 'openai' } },
})
```
