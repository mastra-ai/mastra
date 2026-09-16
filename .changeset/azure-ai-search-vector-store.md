---
'@mastra/azure-ai-search': minor
---

Add `@mastra/azure-ai-search`, a vector store backed by Azure AI Search. It implements the full `MastraVector` contract (`createIndex`, `listIndexes`, `describeIndex`, `deleteIndex`, `upsert`, `query`, `updateVector`, `deleteVector`, `deleteVectors`), translates Mastra metadata filters to Azure OData (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`, `$not`), and throws on unsupported operators instead of silently dropping them. Adds Azure-specific `advancedQuery()`, `hybridQuery()`, and `multiVectorQuery()` for semantic and hybrid (vector + full-text) search, and is compatible with Memory semantic recall.

```ts
import { AzureAISearchVector } from '@mastra/azure-ai-search';

const store = new AzureAISearchVector({
  id: 'azure-search-vectors',
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_AI_SEARCH_CREDENTIAL!,
});

await store.createIndex({ indexName: 'my-collection', dimension: 1536 });
await store.upsert({ indexName: 'my-collection', vectors: embeddings });
```
