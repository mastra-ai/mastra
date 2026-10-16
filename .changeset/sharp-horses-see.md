---
'@mastra/core': minor
---

Added `querySpans()` filters and response fields for span context and parent/root entity information. For example:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

For `querySpans()`, removed `model` and `provider` filtering; both fields remain in returned rows. Its response no longer includes `cost`, `inputTruncated`, `outputTruncated` or `errorTruncated`. Name matching, duration filtering and previews remain available.
