---
'@mastra/clickhouse': patch
---

Added `querySpans()` support for context and parent/root entity fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

Reduced memory usage when querying spans and displaying previews for older data.
