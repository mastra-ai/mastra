---
'@mastra/duckdb': patch
---

Added `querySpans()` support for additional context filters and response fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

Parent/root entity type, ID and name, and `executionSource` currently return null; filters on these fields use null semantics. Parent/root version IDs remain available.

With the updated core contract, model/provider filters are no longer accepted and responses no longer include cost or truncation flags. Model/provider values and previews remain available. Older core contracts retain model/provider filtering, with cost reported as missing.
