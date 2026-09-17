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

Mastra-style operators (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`, `$not`) are translated to Azure OData filter expressions.

Azure AI Search can only filter on fields declared in the index schema and has no JSON-path filtering. By default (`autoIndexMetadata: true`) the store adds a filterable field the first time a top-level string, number, or boolean metadata key is seen in `upsert()` or `updateVector()`, with the field type inferred from that first value. This is what lets Mastra Memory filter by `thread_id` and `resource_id` without declaring them. Keys that are not valid Azure field names (letters, digits and underscores, starting with a letter) or whose values are arrays, objects, or `null` stay in the JSON `metadata` blob only and cannot be filtered on.

To control the schema yourself, pass `autoIndexMetadata: false` and declare fields up front:

```typescript
await vectorStore.createIndex({
  indexName: 'products',
  dimension: 1536,
  metadataIndexes: ['category', { name: 'price', type: 'number' }],
});
```

Document IDs are passed through unchanged when they only contain letters, digits, `_`, `-` and `=`. Any other ID (for example `urn:uuid:...` or an email address) is stored base64url-encoded and decoded back on every read, so callers always see the ID they supplied.

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
