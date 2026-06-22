---
'@mastra/lance': patch
---

Fixed `LanceVectorStore.query()` returning a raw LanceDB distance in the `score` field, which inverted ranking compared to every other Mastra vector store.

LanceDB's `_distance` is a distance (lower = more similar), while Mastra's `score` is a similarity (higher = more similar). Returning the distance unchanged meant the closest match got the *lowest* score, silently breaking `Memory` semantic recall, `rerank()` vector weighting, and any `minScore`/threshold filtering written against other stores (pg, Chroma, S3 Vectors, Pinecone, …).

`query()` now converts `_distance` into a similarity score consistent with the other stores and sets the search distance type to match the detected index metric, or an explicit query metric when no physical Lance index exists:

- cosine → `1 - distance` (cosine similarity)
- dot product → `1 - distance` (recovers the dot product, matching `@mastra/pg`)
- euclidean → `1 / (1 + sqrt(distance))` (Lance `l2` returns squared L2, so this maps to Mastra's L2 similarity semantics)

The metric defaults to the table's vector index metric when one exists, otherwise `cosine` (matching `createIndex`'s default). For small/unindexed tables where LanceDB has no physical index metadata to inspect, pass `metric` to `query()` when using a non-cosine metric. If a query metric conflicts with an existing Lance index metric, the index metric is used because Lance requires indexed searches to use the index's distance type:

```ts
// Before: `exact` got score 0, `far` got score 2 — ranking inverted.
// After:  `exact` gets the highest score and ranks first.
const results = await store.query({
  indexName: 'docs',
  queryVector: [1, 0, 0],
  topK: 2,
  metric: 'cosine', // optional; resolved from the index by default
});
```
