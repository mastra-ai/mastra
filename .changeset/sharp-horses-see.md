---
'@mastra/core': minor
---

Added `querySpans()` filters and response fields for span context and parent/root entity information. For example:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

**Breaking:** `querySpans()` no longer accepts `model` and `provider` filters or returns `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated`. Model/provider values, name matching, duration filtering and previews remain available.

The new filters require an updated storage adapter.
