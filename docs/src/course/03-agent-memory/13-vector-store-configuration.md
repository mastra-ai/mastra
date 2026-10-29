# Vector Store Configuration

In addition to the memory storage adapters, Mastra also provides vector store adapters useful for storing and retrieving vector embeddings. One of these is the `LibSQLVector` adapter, which provides a simple interface for storing and retrieving vector embeddings in a LibSQL vector database.

```typescript
import { Memory } from '@mastra/memory'
import { LibSQLStore, LibSQLVector } from '@mastra/libsql'

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'learning-memory-storage',
    url: process.env.MASTRA_DB_URL!, // resolves against the working directory — set MASTRA_DB_URL to an absolute path
  }),
  vector: new LibSQLVector({
    id: 'learning-memory-vector',
    url: process.env.MASTRA_VECTOR_DB_URL!, // resolves against the working directory — set MASTRA_VECTOR_DB_URL to an absolute path
  }),
})
```

Mastra supports several vector store options, including:

- LibSQL
- Chroma
- Pinecone
- Qdrant
- Postgres (with pgvector)

The vector store is responsible for storing and retrieving the vector embeddings used for semantic search.

Like the storage URL, a relative `file:` URL resolves against the process working directory (`src/mastra/public` under `mastra dev`), not your project root. Set `MASTRA_VECTOR_DB_URL` to an absolute path such as `file:/Users/you/projects/my-app/vector.db` to keep the vector database out of the public assets folder and at a predictable location.
