---
'@mastra/pg': minor
---

Added `querySpans()` support for context and parent/root entity fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

**Breaking with the updated core contract:** `querySpans()` no longer accepts `model` and `provider` filters or returns `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated`.
