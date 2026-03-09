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
| Scorers        | `mastra_scorers`            | Evaluation data      |
| Vector Indexes | `mastra_vector_indexes`     | Index metadata       |
| Vectors        | `mastra_vectors`            | Embeddings           |
| Fallback       | `mastra_documents`          | Unknown tables       |

All typed tables include:

- An `id` field for Mastra's record ID (distinct from Convex's auto-generated `_id`)
- A `by_record_id` index for efficient lookups by Mastra ID

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
