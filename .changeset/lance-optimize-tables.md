---
'@mastra/lance': minor
---

Added `optimize()` and `getIndexCoverage()` to `LanceVectorStore` so you can keep vector indexes up to date. Rows written after an index is built stay outside the index and slow down queries until the table is optimized. Mastra never optimizes automatically, so you choose when to run it.

```ts
const [coverage] = await store.getIndexCoverage({ indexName: 'docs' });

if (coverage.numUnindexedRows >= 1_000) {
  await store.optimize({ indexName: 'docs' });
}
```

Concurrent `optimize()` calls for the same table share one run. `deleteUnverified` defaults to `false`. See [#26100](https://github.com/mastra-ai/mastra/issues/26100).
