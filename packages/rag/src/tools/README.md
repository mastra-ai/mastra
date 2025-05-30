# Vector Query Tool with Database-Specific Configurations

The `createVectorQueryTool` function now supports database-specific configurations to handle unique properties and optimizations for different vector databases.

## Database Configuration Types

### Pinecone Configuration

```typescript
import { createVectorQueryTool } from '@mastra/rag/tools';

const pineconeVectorTool = createVectorQueryTool({
  id: 'pinecone-search',
  indexName: 'my-index',
  vectorStoreName: 'pinecone',
  model: embedModel,
  databaseConfig: {
    pinecone: {
      namespace: 'my-namespace', // Pinecone namespace
      sparseVector: {
        // For hybrid search
        indices: [0, 1, 2],
        values: [0.1, 0.2, 0.3],
      },
    },
  },
});
```

### pgVector Configuration

```typescript
const pgVectorTool = createVectorQueryTool({
  id: 'pgvector-search',
  indexName: 'my-index',
  vectorStoreName: 'postgres',
  model: embedModel,
  databaseConfig: {
    pgvector: {
      minScore: 0.7, // Minimum similarity score
      ef: 200, // HNSW search parameter
      probes: 10, // IVFFlat probe parameter
    },
  },
});
```

### Chroma Configuration

```typescript
const chromaTool = createVectorQueryTool({
  id: 'chroma-search',
  indexName: 'my-index',
  vectorStoreName: 'chroma',
  model: embedModel,
  databaseConfig: {
    chroma: {
      where: {
        // Metadata filtering
        category: 'documents',
      },
      whereDocument: {
        // Document content filtering
        $contains: 'important',
      },
    },
  },
});
```

## Runtime Configuration Override

You can also override database configurations at runtime using the runtime context:

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';

const runtimeContext = new RuntimeContext();

// Override Pinecone namespace at runtime
runtimeContext.set('databaseConfig', {
  pinecone: {
    namespace: 'runtime-namespace',
  },
});

await vectorTool.execute({
  context: { queryText: 'search query' },
  mastra,
  runtimeContext,
});
```

## Extensibility for New Databases

The system is designed to be extensible. For new vector databases, you can:

1. Add configuration types:

```typescript
export interface NewDatabaseConfig {
  customParam1?: string;
  customParam2?: number;
}

export type DatabaseConfig = {
  pinecone?: PineconeConfig;
  pgvector?: PgVectorConfig;
  chroma?: ChromaConfig;
  newdatabase?: NewDatabaseConfig; // Add your config here
  [key: string]: any;
};
```

2. The configuration will be automatically passed through to the vector store's query method.

## Type Safety

All database configurations are fully typed, providing IntelliSense and compile-time checking:

```typescript
const config: DatabaseConfig = {
  pinecone: {
    namespace: 'valid-namespace',
    sparseVector: {
      indices: [1, 2, 3],
      values: [0.1, 0.2, 0.3],
    },
  },
  pgvector: {
    minScore: 0.8,
    ef: 100,
    probes: 5,
  },
};
```

## Migration Guide

Existing code will continue to work without changes. To add database-specific configurations:

```diff
const vectorTool = createVectorQueryTool({
  indexName: 'my-index',
  vectorStoreName: 'pinecone',
  model: embedModel,
+ databaseConfig: {
+   pinecone: {
+     namespace: 'my-namespace'
+   }
+ }
});
```
