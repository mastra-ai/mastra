---
'@mastra/core': minor
---

Span queries and span aggregates now accept `model` and `provider` filters. Stores opt in with the new `span-query-model-fields` feature.

```typescript
const { spans } = await mastraClient.querySpans({
  timeRange,
  where: { op: 'eq', left: { path: 'provider' }, right: { literal: 'anthropic' } },
});
```
