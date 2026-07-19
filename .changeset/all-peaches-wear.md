---
'@mastra/turbopuffer': minor
---

Added a `consistency` option to the Turbopuffer vector store. Queries previously always used strong consistency, which adds latency. You can now opt into eventual consistency for lower-latency queries, either for all queries via the constructor or per query.

```typescript
import { TurbopufferVector } from '@mastra/turbopuffer';

const vectorStore = new TurbopufferVector({
  id: 'turbopuffer',
  apiKey: process.env.TURBOPUFFER_API_KEY!,
  consistency: 'eventual', // default for all queries (defaults to 'strong')
});

// Per-query override
await vectorStore.query({
  indexName: 'my-index',
  queryVector: embedding,
  consistency: 'strong',
});
```

Fixes https://github.com/mastra-ai/mastra/issues/19591
