---
'@mastra/pg': patch
---

Added `querySpans()` support for context and parent/root entity fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```
