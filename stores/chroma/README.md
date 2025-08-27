# @mastra/chroma

Vector store implementation for Chroma using the official `chromadb` client with added dimension validation, collection management, and document storage capabilities.

## Installation

```bash
npm install @mastra/chroma
```

## Instantiation

### Local or Self-Deployments

To run a Chroma server, use the [Chroma CLI](https://docs.trychroma.com/docs/cli/db). It is available to you when you install this package.

```shell
chroma run
```

You will now have a Chroma server running on `localhost:8000`.

```typescript
import { ChromaVector } from '@mastra/chroma';

const vectorStore = new ChromaVector();
```

If you run a Chroma server locally with a different configuration, or [deploy](https://docs.trychroma.com/guides/deploy/client-server-mode) a Chroma server yourself, you can configure your `ChromaVector` instantiation with specific connection details:

```typescript
import { ChromaVector } from '@mastra/chroma';

const vectorStore = new ChromaVector({
  host: 'your-host-address',
  port: 8000,
  ssl: false,
  headers: {}, // any HTTP headers to send,
});
```

### Chroma Cloud

Provide your Chroma Cloud API key, tenant, and database.

You can use the [Chroma CLI](https://docs.trychroma.com/docs/cli/db) to set these as environment variables: `chroma db connect [DB-NAME] --env-file`.

```typescript
import { ChromaVector } from '@mastra/chroma';

const vectorStore = new ChromaVector({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE,
});
```

## Usage

```typescript

// Create a new collection
await vectorStore.createIndex({ indexName: 'myCollection', dimension: 1536, metric: 'cosine' });

// Add vectors with documents
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
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
  queryVector: [0.1, 0.2, ...],
  topK: 10, // topK
  filter: { text: { $eq: 'doc1' } }, // metadata filter
  includeVector: false, // includeVector
  documentFilter: { $contains: 'specific text' } // document content filter
});
```

## Features

- Vector similarity search with cosine, euclidean, and dot product metrics
- Document storage and retrieval
- Document content filtering
- Strict vector dimension validation
- Collection-based organization
- Metadata filtering support
- Optional vector inclusion in query results
- Automatic UUID generation for vectors
- Built-in collection caching for performance
- Built on top of chromadb client

## Methods

- `createIndex({ indexName, dimension, metric? })`: Create a new collection
- `upsert({ indexName, vectors, metadata?, ids?, documents? })`: Add or update vectors with optional document storage
- `query({ indexName, queryVector, topK?, filter?, includeVector?, documentFilter? })`: Search for similar vectors with optional document filtering
- `listIndexes()`: List all collections
- `describeIndex(indexName)`: Get collection statistics
- `deleteIndex(indexName)`: Delete a collection

## Query Response Format

Query results include:

- `id`: Vector ID
- `score`: Distance/similarity score
- `metadata`: Associated metadata
- `document`: Original document text (if stored)
- `vector`: Original vector (if includeVector is true)

## Related Links

- [Chroma Documentation](https://docs.trychroma.com/)
- [Chroma API Reference](https://docs.trychroma.com/api/client)
