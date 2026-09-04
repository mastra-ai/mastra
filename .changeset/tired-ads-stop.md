---
'@mastra/core': minor
---

Added cross-trace conversation qualification to advanced trace queries with `group.where` and `traces.some` or `traces.none` predicates.

```typescript
group: {
  by: ['threadId'],
  where: {
    traces: {
      some: { op: 'eq', left: { path: 'status' }, right: { literal: 'error' } },
    },
  },
}
```
