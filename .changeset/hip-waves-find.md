---
'@mastra/server': minor
---

Added thread rows to `POST /observability/threads/query` and the `threadQueryRows` capability.

**Breaking contract change:** Use a top-level time selector for thread rows. Legacy identity requests remain supported. Unsupported thread-row requests return a structured `501` error.

```ts
// Before
const before = { traces: { timeRange: { from, to } } };
// After
const after = { timeRange: { traces: { from, to } } };
```
