---
'@mastra/core': minor
---

Lightweight trace lists now work on every storage backend. Their rows carry an `inputPreview` so a list can render its preview column without transferring the whole prompt, plus a computed `status` and the span `metadata` so Studio's configurable trace columns work unchanged on the lightweight list.

```ts
const { spans } = await storage.listTracesLight({ pagination: { page: 0, perPage: 25 } });
spans[0].inputPreview; // short preview text — no input/output/attributes blobs
```

`ObservabilityStorage.listTracesLight()` previously threw on any backend that did not implement it — which was every backend except ClickHouse, DuckDB and the in-memory store. It now defaults to `listTraces()` with each row projected down, so all backends serve the same response shape. Backends that can push the projection into the query should still override it; that is what keeps the blob columns off the read path.

`lightSpanRecordSchema` gains optional `inputPreview`, `status` and `metadata` fields, and `buildInputPreview()` / `toLightSpanRecord()` are exported for stores that derive the preview at read time. `listTracesLightResponseSchema` also gained the `delta` and `deltaCursor` fields already present on `listTracesResponseSchema`, so lightweight lists can be live-tailed.

Note that `pagination` on `ListTracesLightResponse` is now optional, because delta-mode responses return a cursor instead of a page. Code that reads it directly needs a guard:

```ts
// Before
const total = response.pagination.total;

// After
const total = response.pagination?.total ?? 0;
```
