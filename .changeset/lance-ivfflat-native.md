---
'@mastra/lance': minor
---

Fixed `indexConfig.type: 'ivfflat'` creating a product-quantized (IVF PQ) index instead of an IVF Flat index. `ivfflat` now creates a native LanceDB IVF Flat index, and the new `ivfpq` type creates the IVF PQ index that `ivfflat` previously produced.

Indexes created before this release keep their IVF PQ type. Rebuild an index for a type change to take effect.

To keep IVF PQ, change `ivfflat` to `ivfpq`:

```ts
// Before
indexConfig: { type: 'ivfflat', numPartitions: 128, numSubVectors: 16 }

// After
indexConfig: { type: 'ivfpq', numPartitions: 128, numSubVectors: 16 }
```

To switch to IVF Flat, keep `ivfflat`, remove `numSubVectors`, and rebuild the index:

```ts
indexConfig: { type: 'ivfflat', numPartitions: 128 }
```
