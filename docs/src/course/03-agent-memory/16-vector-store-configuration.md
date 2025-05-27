# Vector Store Configuration

By default, semantic recall uses an in-memory vector store for development purposes. For production applications, you'll want to use a persistent vector store. Mastra supports several options:

```typescript
import { Memory } from "@mastra/memory";
import { ChromaVectorStore } from "@mastra/chroma";

const memory = new Memory({
  options: {
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
      // Configure a persistent vector store
      vectorStore: new ChromaVectorStore({
        collectionName: "memory",
        url: "http://localhost:8000",
      }),
    },
  },
});
```

Mastra supports several vector store options, including:

- In-memory (default for development)
- Chroma
- Pinecone
- Qdrant
- Postgres (with pgvector)

The vector store is responsible for storing and retrieving the vector embeddings used for semantic search. The in-memory vector store is sufficient for development and testing, but it doesn't persist data between application restarts and isn't suitable for production use.

For production applications, you'll want to use a persistent vector store like Chroma, Pinecone, Qdrant, or Postgres with pgvector. These options provide durable storage for your vector embeddings and can scale to handle large amounts of conversation data.
