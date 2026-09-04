# @mastra/chroma

Vector store implementation for Chroma using the official `chromadb` client with added dimension validation, collection management, and document storage capabilities.

## Installation

```bash
npm install @mastra/chroma
```

## Usage

```typescript
import { ChromaVector } from '@mastra/chroma';

const vectorStore = new ChromaVector({ id: 'chroma-vectors' });

// Create a new collection
await vectorStore.createIndex({ indexName: 'myCollection', dimension: 3, metric: 'cosine' });

// Add vectors with documents
const vectors = [
  [0.1, 0.2, 0.3],
  [0.3, 0.4, 0.5],
];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const documents = ['full text 1', 'full text 2'];
const ids = await vectorStore.upsert({
  indexName: 'myCollection',
  vectors,
  metadata,
  documents, // store original text
});

// Query vectors with document filtering
const results = await vectorStore.query({
  indexName: 'myCollection',
  queryVector: [0.1, 0.2, 0.3],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // metadata filter
  includeVector: false, // includeVector
  documentFilter: { $contains: 'specific text' }, // document content filter
});
```

## Documentation

- [@mastra/chroma documentation](https://mastra.ai/reference/vectors/chroma)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/chroma/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
