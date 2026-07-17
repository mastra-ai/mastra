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

## Driver Modes

`@mastra/oracledb` uses node-oracledb Thin mode by default. Thin mode connects directly to Oracle Database and does not require a separate Oracle Client or Oracle Instant Client installation. No workspace configuration change is needed.

To use Thick mode features, install compatible Oracle Client libraries and initialize node-oracledb before creating an `OracleStore`, an `OracleVector`, or any Oracle connection pool. Applications that import `oracledb` directly should declare it as a direct dependency using a version compatible with `@mastra/oracledb`.

```typescript
import oracledb from 'oracledb';

// macOS or Windows
oracledb.initOracleClient({ libDir: '/path/to/oracle/instantclient' });
```

On Linux, configure the system library search path and call `initOracleClient()` without `libDir`. All Oracle connections in a Node.js process use the same mode. See the [node-oracledb initialization guide](https://node-oracledb.readthedocs.io/en/v6.10.0/user_guide/initialization.html) for platform-specific setup.

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

await store.init();
const memory = await store.getStore('memory');
if (!memory) throw new Error('Oracle memory store is not available');

// Create a thread
await memory.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    metadata: { key: 'value' },
    createdAt: new Date(),
  },
});

// Add messages to thread
await memory.saveMessages({
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
const savedThread = await memory.getThreadById({ threadId: 'thread-123' });
const { messages } = await memory.listMessages({ threadId: 'thread-123' });
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
- `vectorRegistryTableName`: Vector registry table used to clean semantic-recall rows when `OracleVector.registryTableName` is customized

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

## Vector memory (HNSW only)

Oracle's `VECTOR_MEMORY_SIZE` parameter sizes the shared "Vector Pool" used by **HNSW** indexes.
Exact search (the `OracleVector` default) and **IVF** indexes do not use the Vector Pool at all —
both work correctly with `VECTOR_MEMORY_SIZE = 0`, including against an empty, minimally-privileged
database.

### Minimum grants

A brand-new Oracle user needs nothing beyond what any other Mastra storage/vector consumer needs:

```sql
CREATE USER mastra IDENTIFIED BY "<password>";
GRANT CREATE SESSION, CREATE TABLE TO mastra;
ALTER USER mastra QUOTA UNLIMITED ON USERS;
```

This is enough for storage, exact vector search, and IVF indexes. No DBA-level grants or Vector
Pool configuration are required unless you plan to build HNSW indexes.

### Local Docker container (this package's `docker-compose.yaml`)

`scripts/configure-vector-memory.sql` runs during container init and persists
`VECTOR_MEMORY_SIZE = 256M` at the CDB root via `SCOPE=SPFILE`. That value only takes effect after
the instance restarts, so enabling HNSW locally is a one-time, two-step flow:

```bash
docker compose up -d --wait
docker compose restart db
docker compose up --wait
```

Skip the restart if you only need exact search or IVF — the container works fine with the Vector
Pool left at 0, and this package's integration suite detects that case and skips HNSW-specific
tests with a clear message instead of failing.

### Autonomous Database

Oracle Autonomous Database manages Vector Pool memory automatically. `scripts/configure-vector-memory.sql`
is specific to self-managed containers (like the local Docker setup above) and is unnecessary —
and inapplicable — on Autonomous Database.

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

### Monorepo setup notes

**1. Use the default Thin mode** — The monorepo keeps the optional `oracledb` install lifecycle disabled. Unit and integration tests use Thin mode, so `pnpm install` and the OracleDB test commands do not require a manual `pnpm-workspace.yaml` change or an Oracle Client installation.

**2. Build workspace dependencies first** — The integration tests depend on built artifacts from `@mastra/core`. Run this from the monorepo root before the first test run:

```bash
pnpm build:core
```

You will get cryptic `Cannot find module` errors if this is missing.

**3. Docker setup** — Docker Compose requires the Docker daemon to be running. On a fresh Linux install you may need:
```bash
sudo systemctl start docker
```

For local development, create `stores/oracledb/.env` from the Mastra monorepo root. The file is gitignored and is loaded by Vitest and Docker Compose:

```dotenv
ORACLE_DATABASE_USER=mastra
ORACLE_DATABASE_PASSWORD=<your-local-test-password>
ORACLE_DATABASE_CONNECT_STRING=localhost:1521/FREEPDB1
```

Run unit tests and type checks from the monorepo root:

```bash
pnpm --filter @mastra/oracledb test
pnpm --filter @mastra/oracledb typecheck
```

Live Oracle integration tests are opt-in because they require Docker or Oracle Database credentials:

```bash
pnpm --filter @mastra/oracledb test:integration
```

The integration script starts an Oracle Database Free container with Docker Compose, creates the configured test user on the `USERS` tablespace, runs the shared storage and vector integration suites, and tears the container down afterward.

To use an existing Oracle database instead of the Docker Compose container, provide your own connection values and run the integration suites directly:

```bash
export ORACLE_DATABASE_USER=...
export ORACLE_DATABASE_CONNECT_STRING=...
# Load ORACLE_DATABASE_PASSWORD from your environment or secret manager.

pnpm --filter @mastra/oracledb test:storage-integration
pnpm --filter @mastra/oracledb test:vector-integration
```

## Related Links

- [Oracle AI Vector Search](https://docs.oracle.com/en/database/oracle/oracle-database/23/vecse/)
- [Oracle Database Node.js Driver](https://node-oracledb.readthedocs.io/)
- [Mastra Storage Documentation](https://mastra.ai/en/docs/memory/storage)
- [Mastra Vector Database Documentation](https://mastra.ai/en/docs/rag/vector-databases)
