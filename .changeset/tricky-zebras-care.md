---
'@mastra/client-js': minor
---

Added feedback predicates to `queryTraces`.

```typescript
await client.queryTraces({
  timeRange,
  where: { feedback: { some: { op: 'eq', left: { path: 'feedbackType' }, right: { literal: 'rating' } } } },
});
```
