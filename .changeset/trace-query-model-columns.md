---
'@mastra/pg': patch
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
---

Trace query `spans.some` and `spans.none` filters on `model` and `provider` now read the dedicated span columns instead of span attributes. Field value discovery for `model` and `provider` reads the same columns.

Spans written before those columns existed have no stored `model` or `provider`, so these filters treat them as missing: `eq` and `in` no longer match them, while `notExists` does. A query that relied on those older spans matching returns different traces after upgrading.

```typescript
// Matches only spans whose stored model is gpt-5.6, not older spans that carry it in attributes.
const { traces } = await mastraClient.queryTraces({
  timeRange,
  where: { spans: { some: { op: 'eq', left: { path: 'model' }, right: { literal: 'gpt-5.6' } } } },
})
```
