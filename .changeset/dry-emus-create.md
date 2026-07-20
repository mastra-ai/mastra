---
'@mastra/mongodb': minor
'@mastra/deployer': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

MongoDBVector can now index an existing (operational) collection instead of a managed one. Pass `collectionName` (and optionally `searchIndexName`) to `createIndex`, and query with `metadataMode: 'document'` to get the full source document back as metadata.

**Example**

```ts
await vectorStore.createIndex({ indexName: 'precedents', dimension: 1024, collectionName: 'transactions' });
const hits = await vectorStore.query({ indexName: 'precedents', queryVector, metadataMode: 'document' });
```
