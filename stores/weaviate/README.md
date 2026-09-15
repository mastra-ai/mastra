# @mastra/weaviate

Weaviate vector store provider for Mastra.

`WeaviateVector` implements Mastra's `MastraVector` interface on top of
[Weaviate](https://weaviate.io/), the open-source vector database.

## Installation

```bash
npm install @mastra/weaviate
```

## Usage

```ts
import { WeaviateVector } from '@mastra/weaviate';

// Local / self-hosted (docker)
const store = new WeaviateVector({
  id: 'weaviate',
  scheme: 'http',
  host: 'localhost:8080',
});

await store.createIndex({ indexName: 'documents', dimension: 1536 });

await store.upsert({
  indexName: 'documents',
  vectors: [/* embeddings */],
  metadata: [{ text: 'hello world' }],
  ids: ['doc-1'],
});

const results = await store.query({
  indexName: 'documents',
  queryVector: [/* embedding */],
  topK: 5,
});
```

### Weaviate Cloud

```ts
const store = new WeaviateVector({
  id: 'weaviate',
  cloudUrl: process.env.WEAVIATE_URL,
  apiKey: process.env.WEAVIATE_API_KEY,
});
```

## Notes

- **IDs.** Weaviate object IDs must be UUIDs. `WeaviateVector` accepts arbitrary string
  IDs, maps them to deterministic UUIDs internally, and returns your original IDs from
  queries and results.
- **Collection names.** Weaviate capitalises the first letter of collection names.
  `WeaviateVector` normalises index names for you so you can pass names like `documents`.
