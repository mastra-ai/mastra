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
  httpHost: 'localhost',
  httpPort: 8080,
  grpcHost: 'localhost',
  grpcPort: 50051,
});

await store.createIndex({ indexName: 'documents', dimension: 1536, metric: 'cosine' });

const ids = await store.upsert({
  indexName: 'documents',
  vectors: [/* embeddings */],
  metadata: [{ text: 'hello world' }],
  ids: ['doc-1'],
});

const results = await store.query({
  indexName: 'documents',
  queryVector: [/* embedding */],
  topK: 5,
  filter: { text: { $eq: 'hello world' } }, // optional filter
});
```

### Weaviate Cloud

```ts
const store = new WeaviateVector({
  id: 'weaviate',
  httpHost: 'my-cluster.weaviate.network',
  httpPort: 443,
  httpSecure: true,
  grpcHost: 'grpc-my-cluster.weaviate.network',
  grpcPort: 443,
  grpcSecure: true,
  apiKey: process.env.WEAVIATE_API_KEY,
});
```

## Notes

- **IDs.** Weaviate object IDs must be UUIDs. `WeaviateVector` accepts arbitrary string
  IDs, maps them to deterministic UUIDs internally, and returns your original IDs from
  queries and results.
- **Collection names.** Weaviate capitalises the first letter of collection names.
  `WeaviateVector` normalises index names for you so you can pass names like `documents`.
  Note that names differing only in the first letter's case (e.g. `documents` and
  `Documents`) cannot coexist.

## Documentation

- [@mastra/weaviate documentation](https://mastra.ai/reference/vectors/weaviate)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/weaviate/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
