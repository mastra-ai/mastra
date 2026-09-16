# @mastra/azure-ai-search

Azure AI Search vector store provider for Mastra. This package provides vector storage and similarity search capabilities using Azure AI Search's vector search features, including semantic, hybrid, and multi-vector queries.

## Installation

```bash
npm install @mastra/azure-ai-search
```

## Usage

```typescript
import { AzureAISearchVector } from '@mastra/azure-ai-search';

const vectorStore = new AzureAISearchVector({
  id: 'azure-search-vectors',
  endpoint: 'https://your-service.search.windows.net',
  credential: 'your-api-key',
});

// Create an index
await vectorStore.createIndex({ indexName: 'my-collection', dimension: 1536, metric: 'cosine' });

// Add vectors with metadata
const vectors = [
  [0.1, 0.2, 0.3 /* ...1536 dimensions */],
  [0.4, 0.5, 0.6 /* ...1536 dimensions */],
];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await vectorStore.upsert({ indexName: 'my-collection', vectors, metadata });

// Query vectors with metadata filtering
const results = await vectorStore.query({
  indexName: 'my-collection',
  queryVector: [0.1, 0.2, 0.3 /* ...1536 dimensions */],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false,
});
```

### Authenticating with Azure credentials

Pass an Azure credential object instead of an API key to authenticate with Microsoft Entra ID:

```typescript
import { AzureAISearchVector } from '@mastra/azure-ai-search';
import { DefaultAzureCredential } from '@azure/identity';

const vectorStore = new AzureAISearchVector({
  id: 'azure-search-vectors',
  endpoint: 'https://your-service.search.windows.net',
  credential: new DefaultAzureCredential(),
});
```

### Integration with Mastra Memory

```typescript
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { AzureAISearchVector } from '@mastra/azure-ai-search';

const vectorStore = new AzureAISearchVector({
  id: 'azure-memory-store',
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_AI_SEARCH_CREDENTIAL!,
});

const memory = new Memory({
  vector: vectorStore,
  options: {
    lastMessages: 15,
    semanticRecall: { topK: 5, messageRange: 3 },
  },
  embedder: openai.embedding('text-embedding-3-small'),
});
```

### Metadata filtering

Mastra-style operators (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`, `$not`) are translated to Azure OData filter expressions. To filter on a value, add it as a filterable field when creating the index:

```typescript
await vectorStore.createIndex({
  indexName: 'products',
  dimension: 1536,
  additionalFields: [
    { name: 'category', type: 'Edm.String', filterable: true },
    { name: 'price', type: 'Edm.Double', filterable: true },
  ],
});
```

### Semantic, hybrid, and multi-vector queries

Azure-specific query helpers are available in addition to the standard `query`:

```typescript
// Hybrid (vector + full-text) search
await vectorStore.hybridQuery({
  indexName: 'products',
  queryVector: embedding,
  searchText: 'wireless headphones',
  topK: 10,
});
```

See the [documentation](https://mastra.ai/reference/vectors/azure-ai-search) for the full API, including `advancedQuery` and `multiVectorQuery`.

## Documentation

- [Reference: Azure AI Search vector store](https://mastra.ai/reference/vectors/azure-ai-search)

A public end-to-end demo is available at [valdepeace/mastra-azure-aisearch-demo](https://github.com/valdepeace/mastra-azure-aisearch-demo).

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/azure-ai-search/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
