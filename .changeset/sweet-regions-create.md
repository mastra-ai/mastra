---
'@mastra/pg': patch
---

Added `querySpans()` support for context and parent/root entity fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

Moved model/provider extraction to the selected page and removed cost metric reads. Upgrade core and the adapter together: model/provider filters are no longer accepted, and responses no longer include cost or truncation flags. Model/provider values and previews remain available.
