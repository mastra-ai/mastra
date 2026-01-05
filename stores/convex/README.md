# @mastra/convex

Convex adapters for Mastra:

- `ConvexStore` implements the Mastra storage contract (threads, messages, workflows, scores, resources).
- `ConvexVector` stores embeddings inside Convex and performs vector similarity search.
- `@mastra/convex/server` exposes the required Convex table definitions, storage mutation, and live query functions.

## Quick start

### 1. Install

```bash
pnpm add @mastra/convex
```

### 2. Set up Convex schema

In `convex/schema.ts`:

```ts
import { defineSchema } from 'convex/server';
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraDocumentsTable,
} from '@mastra/convex/schema';

export default defineSchema({
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraVectorsTable,
  mastra_documents: mastraDocumentsTable,
});
```

### 3. Create the storage handler

In `convex/mastra/storage.ts`:

```ts
import { mastraStorage } from '@mastra/convex/server';

export const handle = mastraStorage;
```

### 4. (Optional) Add live query and vector search functions

In `convex/mastra/queries.ts`:

```ts
export {
  // Live query functions for real-time subscriptions
  watchThread,
  watchMessages,
  watchThreadsByResource,
  watchWorkflowRun,
  watchWorkflowRuns,
  watchResource,
  // Vector similarity search (uses native vectorIndex if available)
  vectorSearch,
} from '@mastra/convex/server';
```

### 5. Deploy to Convex

```bash
npx convex dev
# or for production
npx convex deploy
```

### 6. Use in Mastra

```ts
import { ConvexStore } from '@mastra/convex';

const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!, // Recommended for runtime
  storageFunction: 'mastra/storage:handle', // default
});
```

For vectors:

```ts
import { ConvexVector } from '@mastra/convex';

const vector = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});
```

## Authentication

The adapter supports two authentication modes:

### Runtime Authentication (Recommended)

Use a service-level JWT token for production runtime. This provides scoped access without exposing admin capabilities:

```ts
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_SERVICE_TOKEN!, // JWT token
});
```

### Admin Authentication (Deployment Only)

Use the admin token only during CI/CD deployment for schema migrations:

```ts
// CI/CD script only - do not use in production runtime!
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});
await storage.init(); // Run migrations
```

## Architecture

This adapter uses **typed Convex tables** with **optimized indexes** for each Mastra domain:

| Domain         | Convex Table                | Indexes                                    |
| -------------- | --------------------------- | ------------------------------------------ |
| Threads        | `mastra_threads`            | `by_record_id`, `by_resource`, `by_created` |
| Messages       | `mastra_messages`           | `by_record_id`, `by_thread`, `by_resource` |
| Resources      | `mastra_resources`          | `by_record_id`, `by_updated`               |
| Workflows      | `mastra_workflow_snapshots` | `by_record_id`, `by_workflow_run`, `by_resource` |
| Scorers        | `mastra_scorers`            | `by_record_id`, `by_scorer`, `by_entity`, `by_run` |
| Vector Indexes | `mastra_vector_indexes`     | `by_record_id`, `by_name`                  |
| Vectors        | `mastra_vectors`            | `by_index_id`, `by_index`                  |
| Fallback       | `mastra_documents`          | `by_table`, `by_table_primary`             |

### Index Usage

All queries automatically use the appropriate index based on the filter pattern:

- **Thread by ID**: Uses `by_record_id` index
- **Threads by resource**: Uses `by_resource` index
- **Messages by thread**: Uses `by_thread` index
- **Workflow runs by name**: Uses `by_workflow_run` index
- **Vectors by index**: Uses `by_index` index

### Batch Size Limits

To stay within Convex's bandwidth limits:

- **Query operations**: 1000 documents max
- **Vector operations**: 500 vectors max (embeddings are large)
- **Delete operations**: 25 documents per batch (1s timeout)

## Live Queries (Real-time Updates)

Subscribe to data changes using Convex's reactive query system:

```tsx
// React example
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function ChatMessages({ threadId }: { threadId: string }) {
  // Automatically updates when messages change
  const messages = useQuery(api.mastra.queries.watchMessages, { 
    threadId,
    limit: 50,
    order: 'asc',
  });

  return (
    <div>
      {messages?.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  );
}
```

Available live query functions:

| Function | Description |
|----------|-------------|
| `watchThread` | Watch a single thread by ID |
| `watchMessages` | Watch messages for a thread |
| `watchThreadsByResource` | Watch all threads for a resource/user |
| `watchWorkflowRun` | Watch a specific workflow run |
| `watchWorkflowRuns` | Watch workflow runs (by name or resource) |
| `watchResource` | Watch a resource's working memory |

## Vector Search

### Basic Usage

Vector search is performed server-side:

```ts
const results = await vector.query({
  indexName: 'my-embeddings',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { metadata: { category: 'docs' } },
});
```

### Native Vector Search (Recommended for Production)

For optimal performance at scale, add a native Convex vector index to your schema:

```ts
// convex/schema.ts
import { defineSchema } from 'convex/server';
import { mastraVectorsTable, COMMON_EMBEDDING_DIMENSIONS } from '@mastra/convex/schema';

export default defineSchema({
  // ... other tables
  
  // Add native vector search for OpenAI embeddings
  mastra_vectors: mastraVectorsTable.vectorIndex('by_embedding', {
    vectorField: 'embedding',
    dimensions: COMMON_EMBEDDING_DIMENSIONS.OPENAI_ADA_002, // 1536
    filterFields: ['indexName'],
  }),
});
```

Common embedding dimensions:
- **OpenAI text-embedding-ada-002**: 1536
- **OpenAI text-embedding-3-small**: 1536
- **OpenAI text-embedding-3-large**: 3072
- **Cohere embed-english-v3.0**: 1024

The adapter automatically:
1. Tries native vector search first (if vectorIndex is defined)
2. Falls back to brute-force search with server-side cosine similarity

### Vector Search Query (for React)

For real-time vector search in React apps, use the `vectorSearch` query:

```tsx
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function SimilarDocs({ embedding }: { embedding: number[] }) {
  const results = useQuery(api.mastra.queries.vectorSearch, {
    indexName: 'docs',
    queryVector: embedding,
    topK: 5,
  });

  return (
    <ul>
      {results?.map(r => (
        <li key={r.id}>Score: {r.score.toFixed(3)}</li>
      ))}
    </ul>
  );
}
```

### Bandwidth Considerations

Vector embeddings are large (1536 dimensions ≈ 12KB per vector). The adapter:

1. Limits vector fetches to 500 documents by default
2. Performs similarity calculation server-side in Convex
3. Returns only the top-K results with scores

With native vector search, Convex handles this efficiently using HNSW indexes.

## Testing

Set the following environment variables before running tests:

- `CONVEX_TEST_URL` – the Convex deployment URL (e.g., `https://your-name.convex.cloud`)
- `CONVEX_TEST_ADMIN_KEY` – an admin token for that deployment
- `CONVEX_TEST_STORAGE_FUNCTION` _(optional)_ – override if you mounted `mastraStorage` elsewhere

```bash
pnpm --filter @mastra/convex test
```

## Status

Beta – the adapter is functional but may have breaking changes.

## Roadmap

- [x] Native Convex vector index support (automatic fallback)
- [x] Index-aware query routing
- [x] Live query functions for real-time updates
- [x] Safe batch sizes for bandwidth limits
- [x] Runtime auth token support (non-admin)
- [ ] Convex Component packaging for isolated namespaces
- [ ] Cursor-based pagination API exposed to users
- [ ] Aggregation queries (counts without full scans)
