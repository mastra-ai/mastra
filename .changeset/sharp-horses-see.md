---
'@mastra/core': minor
---

Added `querySpans()` filters and response fields for span context and parent/root entity information. For example:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

Removed `model` and `provider` filtering; both fields remain in returned rows. Removed `cost`, `inputTruncated`, `outputTruncated` and `errorTruncated` from the response. Update callers that use these filters or response fields. Name matching, duration filtering and previews remain available. Related-span predicates in trace queries are unchanged.
