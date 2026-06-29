# @mastra/meilisearch

Vector store implementation for [Meilisearch](https://www.meilisearch.com/), using its GA vector store (v1.13+) with a `userProvided` embedder. Mastra computes the embeddings; Meilisearch stores and searches them.

## Installation

```bash
npm install @mastra/meilisearch
```

## Usage

```typescript
import { MeilisearchVector } from '@mastra/meilisearch';

const vectorStore = new MeilisearchVector({
  id: 'my-vector-store',
  host: 'http://localhost:7700',
  apiKey: 'masterKey',
});

// Create an index (dimension must match your embedder output)
await vectorStore.createIndex({ indexName: 'my_index', dimension: 1536 });

// Add vectors Mastra produced
const ids = await vectorStore.upsert({
  indexName: 'my_index',
  vectors: [[0.1, 0.2 /* ... */]],
  metadata: [{ text: 'document content', source: 'doc1.pdf' }],
});

// Query
const results = await vectorStore.query({
  indexName: 'my_index',
  queryVector: [0.1, 0.2 /* ... */],
  topK: 10,
  filter: { source: 'doc1.pdf' },
});
```

## Configuration

`MeilisearchVector` accepts the full Meilisearch client `Config` plus a required `id`:

- `id` (required): Identifier for this vector store instance.
- `host` (required): URL of the Meilisearch instance.
- `apiKey`: API key / master key.
- Any other Meilisearch client option (`timeout`, `requestInit`, `defaultWaitOptions`, ...).

## Notes and limitations

- **Cosine only.** Meilisearch similarity is cosine. Requests for `euclidean`/`dotproduct` are accepted with a warning and treated as cosine.
- **Filterable attributes.** A field must be declared filterable before it can be filtered. The recall keys (`metadata.thread_id`, `metadata.resource_id`, `metadata.message_id`) are declared on `createIndex`; any other metadata keys are declared automatically on first upsert.
- **Unsupported filter operators:** `$regex`/`$options`, `$contains`, `$elemMatch`, `$size`. Supported: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$all`, `$exists`, `$and`, `$or`, `$not`, `$nor`, and null matching.
- **Async tasks.** All mutating operations wait for the underlying Meilisearch task to finish so reads are immediately consistent.

## Development

Start a local Meilisearch instance and run the tests:

```bash
docker compose up -d
pnpm test
```
