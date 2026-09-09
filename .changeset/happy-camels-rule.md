---
'@mastra/core': minor
---

Added portable top-level string metadata predicates to advanced trace queries. Invalid metadata keys and values are rejected consistently, and valid predicates work inside recursive Boolean expressions.

```ts
await mastraClient.queryTraces({
  timeRange: {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-08T00:00:00.000Z',
  },
  where: { op: 'eq', left: { path: 'metadata.messageId' }, right: { literal: 'message-123' } },
});
```
