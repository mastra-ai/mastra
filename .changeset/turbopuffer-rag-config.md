---
'@mastra/rag': patch
---

Added a typed `turbopuffer` entry to the `databaseConfig` option of `createVectorQueryTool`. This lets you set the Turbopuffer consistency level for vector queries.

```typescript
const vectorTool = createVectorQueryTool({
  vectorStoreName: 'turbopuffer',
  indexName: 'documents',
  model: embedModel,
  databaseConfig: {
    turbopuffer: {
      consistency: 'eventual', // lower latency, recently written data may not be visible yet
    },
  },
});
```
