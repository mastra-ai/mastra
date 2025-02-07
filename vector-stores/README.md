# Mastra Vector Stores

This directory contains vector store implementations for various databases and services, each providing vector similarity search capabilities through a consistent interface defined by `@mastra/core`.

## Available Vector Stores

| Package                                      | Description                             | Best For                                                      | Key Features                                                                    |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [@mastra/vector-astra](./astra)              | DataStax Astra DB implementation        | Enterprise-grade, fully managed Cassandra-based vector search | - Managed service<br>- High scalability<br>- Enterprise security                |
| [@mastra/vector-pinecone](./pinecone)        | Pinecone implementation                 | Serverless vector search with automatic scaling               | - Serverless<br>- Auto-scaling<br>- Built-in telemetry                          |
| [@mastra/qdrant](../stores/qdrant)            | Qdrant implementation                   | Self-hosted or cloud vector search with rich filtering        | - Advanced filtering<br>- Local or cloud deployment<br>- 256 vectors per batch  |
| [@mastra/vector-chroma](./chroma)            | ChromaDB implementation                 | Simple, lightweight vector search with collection management  | - Collection-based organization<br>- Dimension validation<br>- Built-in caching |
| [@mastra/vector-pg](./pg)                    | PostgreSQL with pgvector implementation | Production-grade SQL database with vector capabilities        | - Connection pooling<br>- Transaction support<br>- MongoDB-like filtering       |
| @mastra/core/vector/libsql (in @mastra/core) | libSQL/Turso implementation             | Edge-friendly SQLite-based vector search                      | - Edge deployment<br>- JSON filtering<br>- Sync support                         |
| [@mastra/vector-upstash](./upstash)          | Upstash Vector implementation           | Serverless Redis-compatible vector search                     | - Pay-per-use<br>- Low latency<br>- Global access                               |
| [@mastra/vector-vectorize](./vectorize)      | Vectorize implementation                | AI-optimized vector operations                                | - Auto optimization<br>- Real-time updates<br>- ML workload focused             |

## Common Features

All vector store implementations share these core features:

- Vector similarity search with multiple distance metrics (cosine, euclidean, dot product)
- Metadata storage and filtering
- Automatic UUID generation for vectors
- Collection/index management (create, list, describe, delete)
- Built-in telemetry support
- TypeScript support

## Usage Example

All implementations follow a similar pattern:

```typescript
import { VectorStore } from '@mastra/vector-*'; // Replace * with implementation

const store = new VectorStore({
  // configuration options specific to implementation
});

// Create a new collection/index
await store.createIndex('my-vectors', 1536, 'cosine');

// Add vectors
const vectors = [[0.1, 0.2, ...], [0.3, 0.4, ...]];
const metadata = [{ text: 'doc1' }, { text: 'doc2' }];
const ids = await store.upsert('my-vectors', vectors, metadata);

// Query vectors
const results = await store.query(
  'my-vectors',
  [0.1, 0.2, ...],
  10, // topK
  { text: 'doc1' }, // optional filter
  false // includeVector
);
```

## Choosing a Vector Store

Consider these factors when choosing a vector store:

1. **Deployment Model**

   - Fully managed: Astra, Pinecone, Upstash, Vectorize
   - Self-hosted or cloud: Qdrant, PostgreSQL
   - Edge-friendly: libSQL/Turso
   - Local-first: ChromaDB

2. **Scale Requirements**

   - Enterprise-scale: Astra, PostgreSQL
   - Auto-scaling: Pinecone, Vectorize
   - Edge-scale: libSQL/Turso
   - Development/small-scale: ChromaDB

3. **Feature Requirements**

   - Advanced filtering: Qdrant, PostgreSQL
   - Transaction support: PostgreSQL
   - Edge computing: libSQL/Turso
   - Real-time updates: Vectorize
   - Pay-per-use: Upstash

4. **Integration Requirements**
   - Existing Cassandra: Astra
   - Existing PostgreSQL: PostgreSQL/pgvector
   - Existing Redis: Upstash
   - Edge computing: libSQL/Turso

## Contributing

When adding a new vector store implementation:

1. Follow the package naming convention: `@mastra/vector-*`
2. Implement the `MastraVector` interface from `@mastra/core`
3. Support all core features (similarity search, metadata, etc.)
4. Add comprehensive documentation in the package's README.md
5. Add the implementation to this root README.md
