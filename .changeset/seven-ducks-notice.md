---
'@mastra/pg': minor
---

Added PostgreSQL support for top-level metadata predicates in advanced trace queries.

```ts
await mastraClient.queryTraces({
  timeRange: {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-08T00:00:00.000Z',
  },
  where: { op: 'in', value: { path: 'metadata.actorRole' }, set: ['assistant', 'tool'] },
});
```
