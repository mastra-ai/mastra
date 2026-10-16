---
'@mastra/clickhouse': patch
---

Added `querySpans()` support for context and parent/root entity fields, including thread filtering:

```ts
where: { op: 'eq', left: { path: 'threadId' }, right: { literal: 'thread-123' } }
```

Removed cost metric reads. Upgrade core and the adapter together: model/provider filters are no longer accepted, and responses no longer include cost or truncation flags. Model/provider values and previews remain available.

Reduced selection memory with a single scan; copies of a span must share the same start time. Missing previews are generated in batches of 32 spans, avoiding retention of a full page of raw payloads.
