---
'@mastra/rag': minor
---

Added MongoDBConfig to DatabaseConfig, exposing numCandidates for MongoDB Atlas Vector Search queries via the RAG tool layer.

numCandidates controls how many HNSW graph candidates MongoDB Atlas Vector Search considers before returning the top-K results. Higher values improve recall at the cost of query latency. This parameter has no equivalent in other vector store backends.

```ts
const tool = createVectorQueryTool({
  vectorStoreName: 'myMongoStore',
  indexName: 'documents',
  model: openai.embedding('text-embedding-3-small'),
  databaseConfig: {
    mongodb: {
      numCandidates: 500,
    },
  },
});
```
