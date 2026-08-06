---
'@mastra/client-js': minor
---

Added `listTracesLight()` for fetching trace lists without the `input`, `output` and `attributes` blobs. It takes the same filtering, ordering and delta-polling arguments as `listTraces()`, and each row carries a short `inputPreview` instead of the full input.

```ts
// Full payloads — use when you need attributes/input/output
const full = await client.listTraces({ pagination: { page: 0, perPage: 25 } });

// Lightweight rows for list views; fetch the full record when a row is opened
const list = await client.listTracesLight({ pagination: { page: 0, perPage: 25 } });
list.spans[0].inputPreview; // 'summarize this thread'
```
