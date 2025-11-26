# @mastra/convex

Convex adapters for Mastra:

- `ConvexStore` implements the Mastra storage contract (threads, messages, workflows, scores, resources).
- `ConvexVector` stores embeddings inside Convex and performs cosine similarity search.
- `@mastra/convex/server` exposes the required Convex table definitions and storage mutation.

## Quick start

### 1. Install

```bash
pnpm add @mastra/convex
```

### 2. Set up Convex schema

In `convex/schema.ts`:

```ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Threads - conversation threads
  mastra_threads: defineTable({
    resourceId: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_resource', ['resourceId'])
    .index('by_created', ['createdAt'])
    .index('by_updated', ['updatedAt']),

  // Messages - conversation messages
  mastra_messages: defineTable({
    threadId: v.string(),
    role: v.string(),
    content: v.any(),
    resourceId: v.optional(v.string()),
    type: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_thread', ['threadId'])
    .index('by_thread_created', ['threadId', 'createdAt'])
    .index('by_resource', ['resourceId']),

  // Resources - user working memory
  mastra_resources: defineTable({
    workingMemory: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_updated', ['updatedAt']),

  // Workflow snapshots
  mastra_workflow_snapshots: defineTable({
    workflowName: v.string(),
    runId: v.string(),
    resourceId: v.optional(v.string()),
    snapshot: v.any(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_workflow_run', ['workflowName', 'runId'])
    .index('by_workflow', ['workflowName'])
    .index('by_resource', ['resourceId'])
    .index('by_created', ['createdAt']),

  // Scores - evaluation scores
  mastra_scores: defineTable({
    scorerId: v.string(),
    entityId: v.string(),
    entityType: v.string(),
    runId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    score: v.optional(v.number()),
    reason: v.optional(v.string()),
    source: v.optional(v.string()),
    preprocessStepResult: v.optional(v.any()),
    preprocessPrompt: v.optional(v.string()),
    generateScorePrompt: v.optional(v.string()),
    generateReasonPrompt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_scorer', ['scorerId'])
    .index('by_entity', ['entityId', 'entityType'])
    .index('by_run', ['runId'])
    .index('by_created', ['createdAt']),

  // Vector index metadata
  mastra_vector_indexes: defineTable({
    indexName: v.string(),
    dimension: v.number(),
    metric: v.string(),
    createdAt: v.string(),
  }).index('by_name', ['indexName']),

  // Vectors - embedding storage
  mastra_vectors: defineTable({
    indexName: v.string(),
    embedding: v.array(v.float64()),
    metadata: v.optional(v.any()),
  }).index('by_index', ['indexName']),

  // Generic documents (fallback)
  mastra_documents: defineTable({
    table: v.string(),
    primaryKey: v.string(),
    record: v.any(),
  })
    .index('by_table', ['table'])
    .index('by_table_primary', ['table', 'primaryKey']),
});
```

### 3. Create the storage handler

In `convex/mastra/storage.ts`:

```ts
import { mastraStorage } from '@mastra/convex/server';

export const handle = mastraStorage;
```

### 4. Deploy to Convex

```bash
npx convex dev
# or for production
npx convex deploy
```

### 5. Use in Mastra

```ts
import { ConvexStore } from '@mastra/convex';

const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  storageFunction: 'mastra/storage:handle', // default
});
```

For vectors:

```ts
import { ConvexVector } from '@mastra/convex';

const vector = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});
```

## Architecture

This adapter uses **typed Convex tables** for each Mastra domain:

| Domain         | Convex Table                | Purpose              |
| -------------- | --------------------------- | -------------------- |
| Threads        | `mastra_threads`            | Conversation threads |
| Messages       | `mastra_messages`           | Chat messages        |
| Resources      | `mastra_resources`          | User working memory  |
| Workflows      | `mastra_workflow_snapshots` | Workflow state       |
| Scores         | `mastra_scores`             | Evaluation data      |
| Vector Indexes | `mastra_vector_indexes`     | Index metadata       |
| Vectors        | `mastra_vectors`            | Embeddings           |
| Fallback       | `mastra_documents`          | Unknown tables       |

## Testing

Set the following environment variables before running tests:

- `CONVEX_TEST_URL` – the Convex deployment URL (e.g., `https://your-name.convex.cloud`)
- `CONVEX_TEST_ADMIN_KEY` – an admin token for that deployment
- `CONVEX_TEST_STORAGE_FUNCTION` _(optional)_ – override if you mounted `mastraStorage` elsewhere

```bash
pnpm --filter @mastra/convex test
```

## Status

Experimental – expect breaking changes while the adapter matures.
