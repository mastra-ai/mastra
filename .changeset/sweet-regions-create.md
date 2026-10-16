---
'@mastra/pg': patch
---

Added `querySpans()` support for context and parent/root entity fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

With the updated core contract, model/provider filters are no longer accepted and responses no longer include cost or truncation flags. Model/provider values and previews remain available. Older core contracts retain model/provider filtering, with cost reported as missing.
