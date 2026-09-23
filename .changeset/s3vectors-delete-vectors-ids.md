---
'@mastra/s3vectors': patch
---

Fixed `deleteVectors()` throwing "not yet implemented" when called with `ids`. You can now bulk delete vectors by id; large lists are split into batches automatically. Deleting by `filter` is still not supported and throws a clear error suggesting to delete by `ids` instead.

```ts
await vectorStore.deleteVectors({ indexName: 'docs', ids: ['doc-1', 'doc-2'] });
```
