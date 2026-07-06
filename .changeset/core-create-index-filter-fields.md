---
'@mastra/core': minor
---

Added an optional `filterFields` array to `CreateIndexParams`. Vector stores that support native index-level filter declarations (such as MongoDB Atlas Vector Search) use it to register metadata fields as filter fields; stores without an equivalent concept ignore it.

```ts
await vectorStore.createIndex({
  indexName: 'my_index',
  dimension: 1536,
  filterFields: ['category', 'userId'],
});
```
