---
'@mastra/elasticsearch': minor
---

Add ElasticSearch vector store support

New `@mastra/elasticsearch` package providing vector similarity search using ElasticSearch 8.x+ with `dense_vector` fields.

```typescript
import { ElasticSearchVector } from '@mastra/elasticsearch';

const vectorDB = new ElasticSearchVector({
  url: 'http://localhost:9200',
  id: 'my-vectors',
});

await vectorDB.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
  metric: 'cosine',
});

await vectorDB.upsert({
  indexName: 'embeddings',
  vectors: [embedding],
  metadata: [{ source: 'doc.pdf' }],
});

const results = await vectorDB.query({
  indexName: 'embeddings',
  queryVector: queryEmbedding,
  topK: 10,
  filter: { source: 'doc.pdf' },
});
```

