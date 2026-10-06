---
'@mastra/lance': minor
---

Fixed `indexConfig.type: 'ivfflat'` creating a product-quantized (IVF PQ) index instead of an IVF Flat index. `ivfflat` now creates a native LanceDB IVF Flat index, and the new `ivfpq` type creates the IVF PQ index that `ivfflat` previously produced.

Existing `ivfflat` indexes stay IVF PQ until rebuilt. To keep the previous behavior, set `type: 'ivfpq'`:

```ts
await vectorStore.createIndex({
  tableName: 'docs',
  indexName: 'vector',
  dimension: 1536,
  indexConfig: { type: 'ivfpq', numPartitions: 128, numSubVectors: 16 },
});
```
