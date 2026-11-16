---
'@mastra/core': minor
---

Replace the experimental `textSearch` request field with composable `hasAllTokens` predicates for supporting stores. Trace and span lists and aggregates share the predicate contract. Built-in OSS stores do not implement indexed token search.

```ts
await client.aggregateSpans({
  timeRange,
  where: { op: 'hasAllTokens', left: { path: 'input' }, right: { literal: 'timeout' } },
  measures: ['count'],
});
```
