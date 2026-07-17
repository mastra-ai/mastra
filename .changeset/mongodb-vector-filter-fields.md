---
'@mastra/mongodb': minor
---

Added a `filterFields` option to `MongoDBVector.createIndex()`. Declaring the metadata fields you filter on lets Mastra register them as native filter fields in the Atlas vectorSearch index, so filtered queries are pushed straight into `$vectorSearch` instead of first materialising matching document `_id`s. This removes the 16 MB BSON ceiling that previously capped metadata-filtered queries at roughly 342,000 matching documents.

```ts
await vectorStore.createIndex({
  indexName: 'my-index',
  dimension: 1536,
  metric: 'cosine',
  filterFields: ['category', 'tenant_id'],
});
```

Queries that filter only on declared fields (using operators Atlas Vector Search supports) take the fast path automatically. Filters that reference an undeclared field, or use an unsupported operator, keep working through the existing pre-filter.
