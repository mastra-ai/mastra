# Convex Adapter Usage Guide

This guide shows how to use the improved `@mastra/convex` adapter with all its features.

## Table of Contents

1. [Setup](#setup)
2. [Basic Usage with Mastra](#basic-usage-with-mastra)
3. [Authentication Options](#authentication-options)
4. [Live Queries (Real-time Updates)](#live-queries-real-time-updates)
5. [Cursor-Based Pagination](#cursor-based-pagination)
6. [Count Queries](#count-queries)
7. [Vector Search](#vector-search)
8. [Direct Domain Usage](#direct-domain-usage)

---

## Setup

### 1. Install the package

```bash
pnpm add @mastra/convex
```

### 2. Set up your Convex schema

```typescript
// convex/schema.ts
import { defineSchema } from 'convex/server';
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraDocumentsTable,
  // Use the helper for native vector search
  createVectorTable,
  COMMON_EMBEDDING_DIMENSIONS,
} from '@mastra/convex/schema';

export default defineSchema({
  // Core Mastra tables
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_documents: mastraDocumentsTable,

  // Vector table with native search (OpenAI embeddings)
  mastra_vectors: createVectorTable(COMMON_EMBEDDING_DIMENSIONS.OPENAI_ADA_002),
});
```

### 3. Create the storage mutation handler

```typescript
// convex/mastra/storage.ts
import { mastraStorage } from '@mastra/convex/server';

export const handle = mastraStorage;
```

### 4. Export query functions (optional but recommended)

```typescript
// convex/mastra/queries.ts
export {
  // Live queries for real-time updates
  watchThread,
  watchMessages,
  watchThreadsByResource,
  watchWorkflowRun,
  watchWorkflowRuns,
  watchResource,

  // Count queries
  countMessages,
  countThreads,
  countWorkflowRuns,

  // Cursor-based pagination
  paginatedMessages,
  paginatedThreads,
  paginatedWorkflowRuns,

  // Vector similarity search
  vectorSearch,
} from '@mastra/convex/server';
```

### 5. Deploy to Convex

```bash
npx convex deploy
```

---

## Basic Usage with Mastra

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { ConvexStore, ConvexVector } from '@mastra/convex';

// Create storage adapter
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!, // Recommended for runtime
});

// Create vector adapter (optional)
const vector = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Initialize Mastra
export const mastra = new Mastra({
  storage,
  vectors: { default: vector },
  // ... other config
});
```

---

## Authentication Options

### Option 1: Runtime Auth Token (Recommended)

Use a service-level JWT token for production. Safer than admin token.

```typescript
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_SERVICE_TOKEN!, // JWT token
});
```

### Option 2: Admin Auth Token (Deployment Only)

Only use during CI/CD deployment for migrations. Never in production runtime.

```typescript
// CI/CD script only!
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});
await storage.init(); // Run migrations
```

### Option 3: Pre-configured Client

For advanced use cases where you need to configure the client separately.

```typescript
import { ConvexAdminClient, ConvexStore } from '@mastra/convex';

const client = new ConvexAdminClient({
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
  storageFunction: 'custom/storage:handle', // Custom path if needed
});

const storage = new ConvexStore({
  id: 'convex',
  client,
});
```

---

## Live Queries (Real-time Updates)

The adapter provides reactive query functions for real-time subscriptions.

### React Example

```tsx
// components/ChatMessages.tsx
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

export function ChatMessages({ threadId }: { threadId: string }) {
  // Automatically updates when messages change
  const messages = useQuery(api.mastra.queries.watchMessages, {
    threadId,
    limit: 100,
    order: 'asc',
  });

  if (!messages) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-2">
      {messages.map(msg => (
        <div key={msg.id} className="p-3 rounded bg-gray-100">
          <div className="text-sm text-gray-500">{msg.role}</div>
          <div>{msg.content}</div>
        </div>
      ))}
    </div>
  );
}
```

### Watch a Thread

```tsx
function ThreadHeader({ threadId }: { threadId: string }) {
  const thread = useQuery(api.mastra.queries.watchThread, { threadId });

  if (!thread) return null;

  return (
    <header>
      <h1>{thread.title}</h1>
      <p>Updated: {new Date(thread.updatedAt).toLocaleString()}</p>
    </header>
  );
}
```

### Watch Threads for a User

```tsx
function UserThreads({ userId }: { userId: string }) {
  const threads = useQuery(api.mastra.queries.watchThreadsByResource, {
    resourceId: userId,
    limit: 20,
    order: 'desc',
  });

  return (
    <ul>
      {threads?.map(thread => (
        <li key={thread.id}>
          <a href={`/chat/${thread.id}`}>{thread.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

### Watch Workflow Status

```tsx
function WorkflowStatus({ workflowName, runId }: { workflowName: string; runId: string }) {
  const run = useQuery(api.mastra.queries.watchWorkflowRun, {
    workflowName,
    runId,
  });

  if (!run) return <div>Loading...</div>;

  const status = run.snapshot?.status ?? 'unknown';

  return (
    <div className={`badge badge-${status}`}>
      {status}
    </div>
  );
}
```

---

## Cursor-Based Pagination

Efficient pagination through large result sets.

### Paginated Messages

```tsx
import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

function PaginatedMessages({ threadId }: { threadId: string }) {
  const [cursor, setCursor] = useState<string | undefined>();

  const result = useQuery(api.mastra.queries.paginatedMessages, {
    threadId,
    cursor,
    limit: 20,
    order: 'desc',
  });

  if (!result) return <div>Loading...</div>;

  return (
    <div>
      {result.items.map(msg => (
        <Message key={msg.id} message={msg} />
      ))}

      {result.hasMore && (
        <button onClick={() => setCursor(result.nextCursor)}>
          Load More
        </button>
      )}
    </div>
  );
}
```

### Infinite Scroll with Pagination

```tsx
import { useInfiniteQuery } from 'some-infinite-query-lib';

function InfiniteMessages({ threadId }: { threadId: string }) {
  const { data, fetchMore, hasMore } = useInfiniteQuery({
    queryFn: async ({ cursor }) => {
      return await convex.query(api.mastra.queries.paginatedMessages, {
        threadId,
        cursor,
        limit: 50,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  return (
    <InfiniteScroll
      dataLength={data?.pages.flatMap(p => p.items).length ?? 0}
      next={fetchMore}
      hasMore={hasMore}
    >
      {data?.pages.flatMap(p => p.items).map(msg => (
        <Message key={msg.id} message={msg} />
      ))}
    </InfiniteScroll>
  );
}
```

---

## Count Queries

Get counts without loading all data.

### Message Count

```tsx
function ThreadStats({ threadId }: { threadId: string }) {
  const { count, isEstimate } = useQuery(api.mastra.queries.countMessages, {
    threadId,
  }) ?? { count: 0, isEstimate: false };

  return (
    <span>
      {count}{isEstimate ? '+' : ''} messages
    </span>
  );
}
```

### Thread Count for User

```tsx
function UserStats({ userId }: { userId: string }) {
  const threadCount = useQuery(api.mastra.queries.countThreads, {
    resourceId: userId,
  });

  const workflowCount = useQuery(api.mastra.queries.countWorkflowRuns, {
    resourceId: userId,
  });

  return (
    <div className="stats">
      <div>Conversations: {threadCount?.count ?? 0}</div>
      <div>Workflows: {workflowCount?.count ?? 0}</div>
    </div>
  );
}
```

---

## Vector Search

### Basic Vector Search

```tsx
function SimilarDocuments({ queryEmbedding }: { queryEmbedding: number[] }) {
  const results = useQuery(api.mastra.queries.vectorSearch, {
    indexName: 'documents',
    queryVector: queryEmbedding,
    topK: 5,
  });

  return (
    <div>
      <h3>Similar Documents</h3>
      {results?.map(result => (
        <div key={result.id}>
          <span>Score: {(result.score * 100).toFixed(1)}%</span>
          <pre>{JSON.stringify(result.metadata, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
```

### Using ConvexVector Directly

```typescript
import { ConvexVector } from '@mastra/convex';

const vector = new ConvexVector({
  id: 'my-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Create an index
await vector.createIndex({
  indexName: 'documents',
  dimension: 1536, // OpenAI ada-002
});

// Upsert vectors
await vector.upsert({
  indexName: 'documents',
  vectors: [embedding1, embedding2, embedding3],
  ids: ['doc-1', 'doc-2', 'doc-3'],
  metadata: [
    { title: 'Doc 1', category: 'tech' },
    { title: 'Doc 2', category: 'science' },
    { title: 'Doc 3', category: 'tech' },
  ],
});

// Query vectors
const results = await vector.query({
  indexName: 'documents',
  queryVector: queryEmbedding,
  topK: 10,
  filter: { metadata: { category: 'tech' } },
});
```

---

## Direct Domain Usage

For standalone usage without the full Mastra framework.

### Memory Domain

```typescript
import { MemoryConvex } from '@mastra/convex';

const memory = new MemoryConvex({
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Create a thread
const thread = await memory.saveThread({
  thread: {
    id: crypto.randomUUID(),
    resourceId: 'user-123',
    title: 'New Conversation',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

// Save messages
await memory.saveMessages({
  messages: [
    {
      id: crypto.randomUUID(),
      threadId: thread.id,
      role: 'user',
      content: { text: 'Hello!' },
      type: 'text',
      createdAt: new Date(),
      resourceId: 'user-123',
    },
  ],
});

// List messages
const { messages } = await memory.listMessages({
  threadId: thread.id,
  perPage: 50,
});
```

### Workflows Domain

```typescript
import { WorkflowsConvex } from '@mastra/convex';

const workflows = new WorkflowsConvex({
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Persist workflow snapshot
await workflows.persistWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
  resourceId: 'user-123',
  snapshot: {
    status: 'running',
    context: {},
    // ... other state
  },
});

// List workflow runs
const { runs } = await workflows.listWorkflowRuns({
  workflowName: 'my-workflow',
  perPage: 20,
});
```

---

## Environment Variables

```bash
# Required
CONVEX_URL=https://your-deployment.convex.cloud

# Choose one authentication method:
CONVEX_AUTH_TOKEN=your-jwt-token      # Recommended for runtime
CONVEX_ADMIN_KEY=your-admin-key       # Only for CI/CD deployment
```

---

## Best Practices

1. **Use `authToken` in production** - Avoid exposing `adminAuthToken` in runtime code
2. **Enable native vector search** - Use `createVectorTable()` for production vector workloads
3. **Use live queries** - Leverage Convex's reactivity instead of polling
4. **Paginate large results** - Use cursor-based pagination for efficiency
5. **Check `isEstimate`** - Count queries cap at 1000; check `isEstimate` for large datasets
