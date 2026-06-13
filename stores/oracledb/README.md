# @mastra/oracledb

Oracle Database provider for Mastra, providing storage and vector similarity search with Oracle JSON, Oracle `VECTOR`, connection pooling, and transaction support.

## Installation

```bash
npm install @mastra/oracledb
```

## Prerequisites

- Oracle Database access through the Node.js `oracledb` driver
- Oracle Database 23ai or later when using vector search
- A database user with permission to create the Mastra tables and indexes, unless schema initialization is managed separately

## Usage

### Storage

```typescript
import { OracleStore } from '@mastra/oracledb';

const store = new OracleStore({
  id: 'oracle-store',
  user: process.env.ORACLE_DATABASE_USER,
  password: process.env.ORACLE_DATABASE_PASSWORD,
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
});

// Create a thread
await store.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
  },
});

// Add messages to thread
await store.saveMessages({
  messages: [
    {
      id: 'msg-789',
      threadId: 'thread-123',
      role: 'user',
      content: { content: 'Hello' },
      resourceId: 'resource-456',
      createdAt: new Date(),
    },
  ],
});

// Query threads and messages
const savedThread = await store.getThreadById({ threadId: 'thread-123' });
const { messages } = await store.listMessages({ threadId: 'thread-123' });
```

### Vector Store

```typescript
import { OracleVector } from '@mastra/oracledb';

const vectorStore = new OracleVector({
  id: 'oracle-vector',
  user: process.env.ORACLE_DATABASE_USER,
  password: process.env.ORACLE_DATABASE_PASSWORD,
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
});

// Create a vector table
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
});

// Add vectors
const ids = await vectorStore.upsert({
  indexName: 'my_vectors',
  vectors: [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  metadata: [{ text: 'doc1' }, { text: 'doc2' }],
});

// Query vectors
const results = await vectorStore.query({
  indexName: 'my_vectors',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { text: { $eq: 'doc1' } },
  includeVector: false,
});
```

### Shared Pool

`OracleStore` and `OracleVector` can share the same Oracle connection pool.

```typescript
const store = new OracleStore({
  id: 'oracle-store',
  user: process.env.ORACLE_DATABASE_USER,
  password: process.env.ORACLE_DATABASE_PASSWORD,
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
});

const vectorStore = new OracleVector({
  id: 'oracle-vector',
  poolManager: store.getPoolManager(),
});
```

## Configuration

Both `OracleStore` and `OracleVector` support:

- Username/password connections
- Autonomous Database wallet and mTLS configuration
- External authentication
- Existing Oracle pools through `OraclePoolManager`
- Custom schema names

### Storage Options

- `id`: Unique identifier for this store instance
- `schemaName`: Oracle schema name to use for Mastra tables
- `messageBatchSize`: Number of messages per batch insert
- `skipDefaultIndexes`: Skip default storage indexes when DBAs manage indexes separately
- `indexes`: Custom Oracle index definitions to create during initialization
- `disableInit`: Disable automatic schema initialization
- `migrationTableName`: Custom migration ledger table name

### Vector Options

- `id`: Unique identifier for this vector store instance
- `schemaName`: Oracle schema name to use for vector tables
- `tablePrefix`: Prefix for generated physical vector table names
- `registryTableName`: Table used to map Mastra index names to Oracle vector tables
- `defaultIndexConfig`: Default Oracle vector index configuration
- `defaultMetadataIndexes`: Metadata fields to index by default
- `defaultVectorFormat`: Vector format (`vector`, `bit`, or `int8`)
- `upsertBatchSize`: Number of vectors per batch insert

## Features

### Storage Features

- Thread, message, resource, working memory, and observational memory storage
- Workflow snapshot persistence
- Observability spans and logs
- Scores and scorer definitions
- Agent and MCP client registries
- Oracle JSON support for metadata, payloads, snapshots, and versioned state
- Repeatable schema migrations
- Offline schema export
- Shared connection pooling

### Vector Store Features

- Oracle `VECTOR` storage
- Vector similarity search with cosine, euclidean, dot product, hamming, and jaccard metrics
- Exact search by default
- Optional IVF and HNSW vector indexes
- Metadata filtering with MongoDB-like query syntax
- Dense, binary, and int8 vector formats
- Automatic vector ID generation
- Logical index registry for stable Mastra index names

## Supported Filter Operators

The following metadata filter operators are supported:

- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- Logical: `$and`, `$or`, `$not`, `$nor`
- Array: `$in`, `$nin`, `$all`, `$elemMatch`, `$size`
- Text: `$contains`, `$regex`
- Existence: `$exists`

Example filter:

```typescript
{
  $and: [
    { resourceId: { $eq: 'resource-456' } },
    { category: { $in: ['docs', 'memory'] } }
  ]
}
```

## Vector Indexes

OracleVector uses exact search by default, which requires no vector index and is useful for local development, tests, and small datasets.

Use IVF or HNSW when the dataset size and latency requirements justify approximate indexing:

```typescript
await vectorStore.createIndex({
  indexName: 'my_vectors',
  dimension: 1536,
  metric: 'cosine',
  indexConfig: {
    type: 'ivf',
    accuracy: 95,
    ivf: {
      neighborPartitions: 16,
    },
  },
});
```

HNSW may require Oracle Vector Pool memory to be configured before index creation.

## Migrations and Schema Export

`OracleStore.init()` runs repeatable migrations for the included storage domains.

```typescript
await store.init();
const migrations = await store.listMigrations();
```

Use `exportSchemas()` to generate Oracle DDL for review or externally managed deployments:

```typescript
import { exportSchemas } from '@mastra/oracledb';

const ddl = exportSchemas({
  schemaName: 'APP_SCHEMA',
  domains: ['migrations', 'memory', 'workflows', 'observability', 'scores', 'scorerDefinitions', 'mcpClients', 'agents', 'vector'],
  vector: {
    indexes: [{ indexName: 'memory_messages', dimension: 1536 }],
  },
});
```

## Methods

### Vector Store Methods

- `createIndex({ indexName, dimension, metric?, indexConfig?, vectorFormat? })`: Create a vector table
- `upsert({ indexName, vectors, metadata?, ids? })`: Add or update vectors
- `query({ indexName, queryVector, topK?, filter?, includeVector?, minScore? })`: Search for similar vectors
- `updateVector({ indexName, id?, filter?, update })`: Update a vector by ID or metadata filter
- `deleteVector({ indexName, id })`: Delete a vector by ID
- `deleteVectors({ indexName, ids?, filter? })`: Delete vectors by IDs or metadata filter
- `listIndexes()`: List vector indexes
- `describeIndex({ indexName })`: Get vector index statistics
- `deleteIndex({ indexName })`: Delete a vector index and its table
- `buildIndex({ indexName, metric?, indexConfig? })`: Build an Oracle vector index
- `rebuildIndex({ indexName, metric?, indexConfig? })`: Rebuild an Oracle vector index
- `configureVectorMemory({ size, scope? })`: Configure Oracle Vector Pool memory
- `getIndexStatus({ indexName, ownerName? })`: Read Oracle vector index status
- `indexAccuracyQuery({ indexName, queryVector, topK?, targetAccuracy? })`: Estimate Oracle vector index accuracy
- `disconnect()`: Close the Oracle connection pool owned by the provider

### Storage Methods

`OracleStore` implements Mastra composite storage and exposes the standard storage methods for supported domains, including memory, workflows, observability, scores, scorer definitions, agents, and MCP clients.

It also provides:

- `init()`: Initialize storage schema
- `migrate()`: Run repeatable storage migrations
- `listMigrations()`: List migration ledger records
- `getPoolManager()`: Access the shared Oracle pool manager
- `disconnect()`: Close the Oracle connection pool owned by the provider

## Testing

Run unit tests and type checks from the Mastra monorepo root:

```bash
pnpm --filter @mastra/oracledb test
pnpm --filter @mastra/oracledb typecheck
```

Live Oracle integration tests are opt-in because they require Oracle Database credentials:

```bash
RUN_ORACLE_VECTOR_INTEGRATION=true pnpm --filter @mastra/oracledb test:vector-integration
RUN_ORACLE_STORAGE_INTEGRATION=true pnpm --filter @mastra/oracledb test:storage-integration
```

## Related Links

- [Oracle AI Vector Search](https://docs.oracle.com/en/database/oracle/oracle-database/23/vecse/)
- [Oracle Database Node.js Driver](https://node-oracledb.readthedocs.io/)
- [Mastra Storage Documentation](https://mastra.ai/en/docs/memory/storage)
- [Mastra Vector Database Documentation](https://mastra.ai/en/docs/rag/vector-databases)
