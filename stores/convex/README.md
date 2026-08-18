# @mastra/convex

Convex adapters for Mastra:

- `ConvexStore` implements the Mastra storage contract (threads, messages, workflows, scores, resources, schedules, channels, background tasks, observational memory).
- `ConvexVector` stores embeddings inside Convex and performs development-scale cosine similarity search.
- `ConvexNativeVector` uses Convex native vector search for production workloads.
- `ConvexServerCache` stores Mastra server cache entries in Convex for durable stream replay and response caching.
- `@mastra/convex/server` exposes the required Convex table definitions, storage mutation, cache handlers, and native vector handlers.

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
  mastraSchedulesTable,
  mastraScheduleTriggersTable,
  mastraChannelInstallationsTable,
  mastraChannelConfigTable,
  mastraBackgroundTasksTable,
  mastraObservationalMemoryTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraCacheTable,
  mastraCacheListItemsTable,
  mastraDocumentsTable,
} from '@mastra/convex/schema';

export default defineSchema({
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_schedules: mastraSchedulesTable,
  mastra_schedule_triggers: mastraScheduleTriggersTable,
  mastra_channel_installations: mastraChannelInstallationsTable,
  mastra_channel_config: mastraChannelConfigTable,
  mastra_background_tasks: mastraBackgroundTasksTable,
  mastra_observational_memory: mastraObservationalMemoryTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraVectorsTable,
  mastra_cache: mastraCacheTable,
  mastra_cache_list_items: mastraCacheListItemsTable,
  mastra_documents: mastraDocumentsTable,
});
```

### 3. Create the storage and cache handlers

In `convex/mastra/storage.ts`:

```ts
import { mastraStorage } from '@mastra/convex/server';

export const handle = mastraStorage;
```

In `convex/mastra/cache.ts`:

```ts
import { mastraCache } from '@mastra/convex/server';

export const handle = mastraCache;
```

### 4. Deploy to Convex

```bash
npx convex dev
# or for production
npx convex deploy
```

### 5. Use in Mastra

```ts
import { ConvexServerCache, ConvexStore } from '@mastra/convex';

const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  storageFunction: 'mastra/storage:handle', // default
});

const cache = new ConvexServerCache({
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  cacheFunction: 'mastra/cache:handle', // default
  requestTimeoutMs: 30_000, // default
});
```

`clear()` removes rows whose stored prefix exactly matches the configured cache prefix. Cleanup runs in bounded batches, so reads for a key being cleared can return empty results until cleanup finishes. During cleanup, cache metadata can briefly use an internal `deleted` state before the next cleanup pass removes it. List pushes refresh the configured cache TTL.
Use this cache for durable replay of moderate-frequency events; batch high-frequency token streams or use a lower-latency cache backend.

For vectors:

```ts
import { ConvexVector } from '@mastra/convex';

const vector = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});
```

`ConvexVector` scans stored vectors through the storage handler and computes similarity in the adapter. Use it for local development, tests, and small datasets.

For native Convex vector search, define a dedicated table in `convex/schema.ts`:

```ts
import { defineSchema } from 'convex/server';
import { defineMastraNativeVectorTable } from '@mastra/convex/schema';

export default defineSchema({
  docs_vectors: defineMastraNativeVectorTable({
    dimensions: 1536,
  }),
});
```

Export the native vector handlers in `convex/mastra/nativeVector.ts`:

```ts
import { mastraNativeVectorAction, mastraNativeVectorMutation, mastraNativeVectorQuery } from '@mastra/convex/server';

export const query = mastraNativeVectorAction;
export const read = mastraNativeVectorQuery;
export const write = mastraNativeVectorMutation;
```

Configure the native vector adapter:

```ts
import { ConvexNativeVector } from '@mastra/convex';

const vector = new ConvexNativeVector({
  id: 'convex-native-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  indexes: {
    docs: {
      tableName: 'docs_vectors',
      vectorIndexName: 'by_embedding',
      dimension: 1536,
    },
  },
});
```

Native vector search uses Convex's schema-defined vector indexes and action-only `ctx.vectorSearch` API. It supports `topK` values from 1 to 256 and equality filters on fields declared in the Convex vector index `filterFields`.

## Architecture

This adapter uses **typed Convex tables** for each Mastra domain:

| Domain               | Convex Table                                            | Purpose                          |
| -------------------- | ------------------------------------------------------- | -------------------------------- |
| Threads              | `mastra_threads`                                        | Conversation threads             |
| Messages             | `mastra_messages`                                       | Chat messages                    |
| Resources            | `mastra_resources`                                      | User working memory              |
| Workflows            | `mastra_workflow_snapshots`                             | Workflow state                   |
| Scorers              | `mastra_scorers`                                        | Evaluation data                  |
| Schedules            | `mastra_schedules`                                      | Workflow schedules               |
| Triggers             | `mastra_schedule_triggers`                              | Schedule history                 |
| Channels             | `mastra_channel_installations`, `mastra_channel_config` | Channel installations and config |
| Background Tasks     | `mastra_background_tasks`                               | Background task state            |
| Observational Memory | `mastra_observational_memory`                           | Observational memory generations |
| Vector Indexes       | `mastra_vector_indexes`                                 | Index metadata                   |
| Vectors              | `mastra_vectors`                                        | Embeddings                       |
| Cache                | `mastra_cache`                                          | Cache metadata                   |
| Cache Items          | `mastra_cache_list_items`                               | Cache list entries               |
| Fallback             | `mastra_documents`                                      | Unknown tables                   |

All typed tables include:

- An `id` field for Mastra's record ID (distinct from Convex's auto-generated `_id`)
- A `by_record_id` index for efficient lookups by Mastra ID

Schedule due reads and trigger-history reads use bounded Convex queries to avoid deployment read limits. When no explicit trigger-history limit is provided, the adapter returns the newest 100 rows. Schedule listing is capped at 8,000 rows per call. Schedule rows also store a normalized `workflow_id` alongside the serialized target so workflow filters can run inside Convex before the listing cap is applied.

Background task reads and updates also tolerate older rows that were written to the fallback `mastra_documents` table.

### Observational memory

`ConvexStore` supports Mastra's observational memory. Records are keyed by a `lookupKey` (`thread:{id}` or `resource:{id}`) and the latest generation is served through the `by_lookup_key` index. All observational memory read-modify-write operations run inside the deployed storage mutation, so swaps and counter updates are atomic.

Upgrading from a version without observational memory: add `mastraObservationalMemoryTable` to your `convex/schema.ts` (as shown in the quick start) and run `npx convex deploy` again.

Active observations and buffered chunks share one Convex document, which is subject to Convex's 1 MiB document size limit. Default observational memory thresholds stay well below this limit; extremely large custom thresholds can exceed it.

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
