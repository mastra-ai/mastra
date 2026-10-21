---
'@mastra/duckdb': minor
---

Added `querySpans()` support for additional context filters and response fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

**Breaking with the updated core contract:** `querySpans()` no longer accepts `model` and `provider` filters or returns `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated`.

Parent/root entity type, ID and name, and `executionSource` return `null`. Equality filters on these fields match no spans.
