---
'@mastra/pg': patch
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
---

Trace query `spans.some` and `spans.none` filters on `model` and `provider` now also match the dedicated span columns. Each span reads its `model` or `provider` column first and falls back to the span attributes when the column is empty, so existing filters keep matching spans written before the columns were filled. Field value discovery for `model` and `provider` reads the same values.

```typescript
const { traces } = await mastraClient.queryTraces({
  timeRange,
  where: { spans: { some: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-5.6' } } } },
})
```
