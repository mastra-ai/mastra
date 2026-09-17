---
'@mastra/azure-ai-search': minor
---

Add `@mastra/azure-ai-search`, a vector store backed by Azure AI Search. Use it anywhere Mastra accepts a vector store, including RAG pipelines and Memory semantic recall. Metadata filtering works out of the box: filterable fields are added to the index the first time a metadata key is written (`autoIndexMetadata`, on by default), so Memory's `thread_id`/`resource_id` filters need no schema setup. Any string is accepted as a vector ID. Hybrid (vector + full-text), semantic, and multi-vector queries are available through `hybridQuery()`, `advancedQuery()`, and `multiVectorQuery()`.

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
