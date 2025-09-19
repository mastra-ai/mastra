# Advanced Configuration of Semantic Recall

We can configure semantic recall in more detail by setting options for the `semanticRecall` option:

```typescript
const memory = new Memory({
  storage: new LibSQLStore({
    url: "file:../../memory.db", // relative path from the `.mastra/output` directory
  }),
  vector: new LibSQLVector({
    connectionUrl: "file:../../vector.db", // relative path from the `.mastra/output` directory
  }),
  embedder: openai.embedding("text-embedding-3-small"),
  options: {
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
  },
});
```

The `topK` parameter controls how many semantically similar messages are retrieved. A higher value will retrieve more messages, which can be helpful for complex topics but may also include less relevant information. The default value is `2`.

The `messageRange` parameter controls how much context is included with each match. This is important because the matching message alone might not provide enough context to understand the conversation. Including messages before and after the match helps the agent understand the context of the matched message.

## Vector Index Configuration

When using semantic recall, the performance of vector searches can be optimized by configuring the vector index. This is particularly important for large datasets.

### PostgreSQL with pgvector

PostgreSQL users can configure advanced index settings for optimal performance:

```typescript
const memory = new Memory({
  storage: new PostgresStore({
    /* ... */
  }),
  vector: new PgVector({
    /* ... */
  }),
  embedder: openai.embedding("text-embedding-3-small"),
  options: {
    semanticRecall: {
      topK: 10,
      messageRange: 2,
      // PostgreSQL-specific index configuration
      indexConfig: {
        type: "hnsw", // 'ivfflat' (default), 'hnsw', or 'flat'
        metric: "inner", // 'cosine', 'euclidean', or 'inner'
        hnsw: {
          // HNSW-specific parameters
          m: 16,
          efConstruction: 64,
        },
      },
    },
  },
});
```

The `indexConfig` option allows you to:

- Choose between IVFFlat (balanced), HNSW (fastest), or Flat (100% accurate) index types
- Select the optimal distance metric for your embeddings
- Fine-tune index parameters for your specific use case

For detailed PostgreSQL vector index configuration including performance comparisons and optimization tips, see the [PG Vector Store reference](/reference/rag/pg#index-configuration-guide).

> **Note:** The `indexConfig` option is currently only supported by PostgreSQL with pgvector. Other vector stores (Pinecone, Qdrant, Chroma, etc.) will use their default index configurations.
