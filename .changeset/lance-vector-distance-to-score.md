---
'@mastra/lance': patch
---

Fixed `LanceVectorStore.query()` returning a raw LanceDB distance in the `score` field, which inverted ranking compared to every other Mastra vector store.

LanceDB's `_distance` is a distance (lower = more similar), while Mastra's `score` is a similarity (higher = more similar). Returning the distance unchanged meant the closest match got the *lowest* score, silently breaking `Memory` semantic recall, `rerank()` vector weighting, and any `minScore`/threshold filtering written against other stores (pg, Chroma, S3 Vectors, Pinecone, …).

`query()` now converts `_distance` into a similarity score consistent with the other stores and sets the search distance type to match the index metric (so non-indexed tables stay consistent too):

- cosine → `1 - distance` (cosine similarity)
- dot product → `1 - distance` (recovers the dot product, matching `@mastra/pg`)
- euclidean → `1 / (1 + distance)` (maps into `(0, 1]`, matching `@mastra/pg` and `@mastra/s3vectors`)

The metric defaults to the table's vector index metric when one exists, otherwise `cosine` (matching `createIndex`'s default and `@mastra/memory`'s usage). You can override it per query:

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
