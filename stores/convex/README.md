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

### 4. (Optional) Add live query functions

In `convex/mastra/queries.ts`:

```ts
export {
  watchThread,
  watchMessages,
  watchThreadsByResource,
  watchWorkflowRun,
  watchWorkflowRuns,
  watchResource,
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

Vector search is performed server-side with cosine similarity:

```ts
const results = await vector.query({
  indexName: 'my-embeddings',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  filter: { metadata: { category: 'docs' } },
});
```

### Bandwidth Considerations

Vector embeddings are large (1536 dimensions = ~12KB per vector). The adapter:

1. Limits vector fetches to 500 documents by default
2. Performs similarity calculation server-side in Convex
3. Returns only the top-K results with scores

For production vector search at scale, consider:
- Adding a Convex `vectorIndex` to your schema for native vector search
- Using a dedicated vector database for large collections

## Testing

Set the following environment variables before running tests:

- `CONVEX_TEST_URL` – the Convex deployment URL (e.g., `https://your-name.convex.cloud`)
- `CONVEX_TEST_ADMIN_KEY` – an admin token for that deployment
- `CONVEX_TEST_STORAGE_FUNCTION` _(optional)_ – override if you mounted `mastraStorage` elsewhere

```bash
pnpm --filter @mastra/convex test
```

## Status

Beta – the adapter is functional but may have breaking changes as we add native vector search and component packaging.

## Roadmap

- [ ] Native Convex vector index support
- [ ] Convex Component packaging for isolated namespaces
- [ ] Cursor-based pagination for large result sets
- [ ] Aggregation queries (counts without full scans)
