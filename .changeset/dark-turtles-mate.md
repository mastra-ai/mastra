---
'@mastra/duckdb': patch
---

Added `querySpans()` support for additional context filters and response fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

