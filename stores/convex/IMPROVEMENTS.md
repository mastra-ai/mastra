# Convex Adapter Improvements

Based on feedback from Ian (Convex), this document outlines the key issues with the current implementation and proposed improvements.

## Summary of Issues

| # | Issue | Severity | Current State |
|---|-------|----------|---------------|
| 1 | Admin token sensitivity | High | `adminAuthToken` exposed at runtime |
| 2 | No index usage in queries | Critical | `load`/`queryTable` scan up to 10k rows |
| 3 | Low-level protocol vs semantic API | Medium | Generic SQL-style ops, indexes not utilized |
| 4 | Vector table bandwidth limits | High | `.take(10000)` will exceed 16MiB limit |
| 5 | No vector index/search | Critical | Full table scan + client-side cosine similarity |
| 6 | Not a Convex component | Medium | No namespace isolation |
| 7 | No live-updating queries | Feature | Users must write custom queries |

---

## Issue 1: Admin Token Sensitivity

### Current Problem
The `adminAuthToken` is a highly sensitive token that allows destructive actions beyond just deploying code. Currently, it's required at runtime for all operations.

### Proposed Solutions

**Option A: Separate Push-Time vs Runtime Credentials**
```typescript
// Push-time only (migrations, schema changes)
const adminStore = new ConvexStore({
  id: 'convex',
  deploymentUrl: '...',
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!, // Only needed for push
});
await adminStore.init();

// Runtime - use Convex's action/mutation tokens instead
const runtimeStore = new ConvexStore({
  id: 'convex',
  deploymentUrl: '...',
  // No admin token - use Convex function authentication instead
});
```

**Option B: Use Convex Client SDK with Auth**

Instead of HTTP API with admin auth, use the Convex client SDK with user-level or service-level authentication:

```typescript
import { ConvexClient } from 'convex/browser';

// Runtime operations use Convex client with JWT/session auth
const client = new ConvexClient(process.env.CONVEX_URL!);
client.setAuth(tokenProvider); // User or service token
```

**Option C: Function-Level Access Control**

Add function-level auth checks in the Convex mutation:

```typescript
// convex/mastra/storage.ts
export const handle = mutationGeneric({
  args: { ... },
  handler: async (ctx, request) => {
    // Validate caller has appropriate permissions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !hasStorageAccess(identity)) {
      throw new Error('Unauthorized');
    }
    // ... rest of handler
  }
});
```

### Recommendation
Use **Option B + C**: Refactor to use the Convex client SDK with proper authentication, and remove the need for admin tokens at runtime entirely. Admin token should only be needed during deployment (`npx convex deploy`).

---

## Issue 2: No Index Usage in load/queryTable

### Current Problem

The `load` and `queryTable` operations always fetch up to 10,000 rows without leveraging the defined indexes:

```typescript:146:162:stores/convex/src/server/storage.ts
case 'queryTable': {
  // Use take() to avoid hitting Convex's 32k document limit
  const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
  let docs = await ctx.db.query(convexTable).take(maxDocs);

  // Apply filters if provided
  if (request.filters && request.filters.length > 0) {
    docs = docs.filter((doc: any) => request.filters!.every(filter => doc[filter.field] === filter.value));
  }
  // ...
}
```

This:
1. Loads 10k rows first
2. Then filters in-memory
3. Ignores indexes like `by_resource`, `by_thread`, `by_workflow_run`
4. **Will break when data exceeds 10k rows**

### Proposed Solution

Create specialized query handlers that use the appropriate index based on the filter fields:

```typescript
// In server/storage.ts
case 'queryTable': {
  const { tableName, filters, limit } = request;
  
  // Detect which index to use based on filter fields
  const indexedQuery = getIndexedQuery(ctx.db, convexTable, filters);
  
  const maxDocs = limit ?? 1000;
  const docs = await indexedQuery.take(maxDocs);
  
  return { ok: true, result: docs };
}

function getIndexedQuery(db: any, table: string, filters?: EqualityFilter[]) {
  if (!filters || filters.length === 0) {
    return db.query(table);
  }

  // Map filter combinations to indexes
  const filterMap = new Map(filters.map(f => [f.field, f.value]));
  
  // Thread messages: use by_thread index
  if (table === 'mastra_messages' && filterMap.has('thread_id')) {
    return db.query(table)
      .withIndex('by_thread', q => q.eq('thread_id', filterMap.get('thread_id')));
  }
  
  // Threads by resource: use by_resource index
  if (table === 'mastra_threads' && filterMap.has('resourceId')) {
    return db.query(table)
      .withIndex('by_resource', q => q.eq('resourceId', filterMap.get('resourceId')));
  }
  
  // Workflow runs: use by_workflow_run index
  if (table === 'mastra_workflow_snapshots' && filterMap.has('workflow_name')) {
    const query = db.query(table)
      .withIndex('by_workflow_run', q => {
        let qb = q.eq('workflow_name', filterMap.get('workflow_name'));
        if (filterMap.has('run_id')) {
          qb = qb.eq('run_id', filterMap.get('run_id'));
        }
        return qb;
      });
    return query;
  }
  
  // Fallback to full scan (should log warning)
  console.warn(`No index available for filters on ${table}:`, filters);
  return db.query(table);
}
```

---

## Issue 3: Low-Level Protocol vs Semantic API

### Current Problem

The current protocol uses generic SQL-style operations (`insert`, `load`, `queryTable`) with filters, forcing the server-side handler to infer intent from filter values. This makes it hard to optimize.

### Proposed Solution

Add semantic operation types that map directly to Mastra's storage methods:

```typescript
// New semantic request types
export type StorageRequest =
  // Generic ops (keep for fallback)
  | { op: 'insert'; ... }
  | { op: 'queryTable'; ... }
  
  // Semantic memory ops - explicit intent, optimal indexes
  | { op: 'getThread'; threadId: string }
  | { op: 'listThreadsByResource'; resourceId: string; limit?: number; cursor?: string }
  | { op: 'getMessages'; threadId: string; limit?: number; cursor?: string }
  | { op: 'getMessagesByIds'; messageIds: string[] }
  
  // Semantic workflow ops
  | { op: 'getWorkflowRun'; workflowName: string; runId: string }
  | { op: 'listWorkflowRuns'; workflowName?: string; resourceId?: string; status?: string; limit?: number }
  
  // Semantic vector ops
  | { op: 'vectorSearch'; indexName: string; queryVector: number[]; topK: number; filter?: object };
```

Server-side handlers can then use the optimal index for each operation:

```typescript
case 'getMessages': {
  const { threadId, limit = 100, cursor } = request;
  let query = ctx.db.query('mastra_messages')
    .withIndex('by_thread_created', q => q.eq('thread_id', threadId));
  
  if (cursor) {
    query = query.filter(q => q.gt(q.field('createdAt'), cursor));
  }
  
  const docs = await query.take(limit);
  const nextCursor = docs.length === limit ? docs[docs.length - 1].createdAt : undefined;
  
  return { ok: true, result: docs, cursor: nextCursor };
}
```

---

## Issue 4: Vector Table Bandwidth Limits

### Current Problem

```typescript:100:103:stores/convex/src/vector/index.ts
const vectors = await this.callStorage<VectorRecord[]>({
  op: 'queryTable',
  tableName: this.vectorTable(indexName),
});
```

And on the server side:
```typescript:279:283:stores/convex/src/server/storage.ts
const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
let docs = await ctx.db
  .query(convexTable)
  .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
  .take(maxDocs);
```

With 1536-dimension embeddings (typical for OpenAI):
- Each vector: ~12KB (1536 * 8 bytes)
- 10,000 vectors: ~120MB
- **Far exceeds Convex's 16MiB bandwidth limit**

### Proposed Solution

1. **Reduce default limit to 1000 max** (or less for high-dimension vectors)
2. **Use pagination with cursors** for large result sets
3. **Calculate safe limits based on dimension**

```typescript
// Calculate safe batch size based on embedding dimension
function getVectorBatchSize(dimension: number): number {
  const bytesPerVector = dimension * 8 + 200; // embedding + metadata overhead
  const maxBytes = 8 * 1024 * 1024; // 8MiB safe limit (half of max)
  return Math.min(1000, Math.floor(maxBytes / bytesPerVector));
}

// In describeIndex - use count query instead of loading all vectors
async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
  // Don't load all vectors just to count them!
  const result = await this.callStorage<{ dimension: number; count: number }>({
    op: 'describeVectorIndex',  // New semantic operation
    indexName,
  });
  
  return {
    dimension: result.dimension,
    count: result.count,
    metric: 'cosine',
  };
}
```

---

## Issue 5: No Vector Index or Vector Search

### Current Problem

The vector implementation:
1. **Has no vector index defined** in the schema
2. **Performs full table scan** on every query
3. **Computes cosine similarity client-side** in Node.js

```typescript:130:159:stores/convex/src/vector/index.ts
async query({ indexName, queryVector, topK = 10, ... }): Promise<QueryResult[]> {
  // PROBLEM: Loads ALL vectors from the table
  const vectors = await this.callStorage<VectorRecord[]>({
    op: 'queryTable',
    tableName: this.vectorTable(indexName),
  });

  // PROBLEM: Filters in JS, not using any index
  const filtered = filter && !this.isEmptyFilter(filter)
    ? vectors.filter(record => this.matchesFilter(record.metadata, filter))
    : vectors;

  // PROBLEM: Cosine similarity computed client-side
  const scored = filtered
    .map(record => ({
      id: record.id,
      score: cosineSimilarity(queryVector, record.embedding),
      ...
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

This approach:
- Cannot scale past 1000 vectors (bandwidth limits)
- Is extremely slow (O(n) for every query)
- Wastes bandwidth transferring all embeddings

### Proposed Solution

**Use Convex's native vector search** (available since late 2024):

```typescript
// Update schema.ts to define vector index
export const mastraVectorsTable = defineTable({
  id: v.string(),
  indexName: v.string(),
  embedding: v.array(v.float64()),
  metadata: v.optional(v.any()),
})
  .index('by_index_id', ['indexName', 'id'])
  .index('by_index', ['indexName'])
  // ADD: Vector index for semantic search
  .vectorIndex('by_embedding', {
    vectorField: 'embedding',
    dimensions: 1536,  // Or make configurable per index
    filterFields: ['indexName'],
  });
```

Update the server handler to use vector search:

```typescript
// New operation type
| { op: 'vectorSearch'; indexName: string; queryVector: number[]; topK: number; filter?: object }

// Handler
case 'vectorSearch': {
  const { indexName, queryVector, topK, filter } = request;
  
  const results = await ctx.db
    .query('mastra_vectors')
    .withSearchIndex('by_embedding', q =>
      q.vector('embedding', queryVector)
       .eq('indexName', indexName)
    )
    .take(topK);
  
  return {
    ok: true,
    result: results.map(doc => ({
      id: doc.id,
      score: doc._score,  // Convex provides the score
      metadata: doc.metadata,
    })),
  };
}
```

Update the client:

```typescript
// In vector/index.ts
async query({ indexName, queryVector, topK = 10, filter }: QueryVectorParams): Promise<QueryResult[]> {
  // Use native vector search instead of full scan
  return this.callStorage<QueryResult[]>({
    op: 'vectorSearch',
    indexName,
    queryVector,
    topK,
    filter,
  });
}
```

### Dimension Configuration Challenge

Convex vector indexes require declaring dimensions at schema definition time. Options:

**A. Fixed dimension (simplest)**
```typescript
// Support common dimensions with separate indexes
.vectorIndex('by_embedding_1536', { dimensions: 1536, ... })
.vectorIndex('by_embedding_3072', { dimensions: 3072, ... })
```

**B. Separate tables per dimension**
```typescript
// mastra_vectors_1536, mastra_vectors_3072, etc.
// Dynamically create during createIndex()
```

**C. Document in README that users define their own**
```typescript
// Users add their own vector index with their dimension
.vectorIndex('my_embeddings', {
  vectorField: 'embedding',
  dimensions: 1536, // User specifies
  filterFields: ['indexName'],
})
```

---

## Issue 6: Convex Component Architecture

### Current Problem

The adapter is a standard npm package that users import. This means:
- No namespace isolation for Mastra tables
- Users must manually add tables to their schema
- Potential naming conflicts with user tables
- No encapsulated API surface

### Proposed Solution: Convex Component

Convex Components (announced 2024) provide:
- **Isolated table namespace** - tables prefixed with component name
- **Well-known function names** - clear API surface
- **Encapsulation** - internal implementation hidden from users

Structure:

```
@mastra/convex-component/
├── convex/
│   ├── _generated/
│   ├── schema.ts          # Internal tables (auto-prefixed)
│   ├── storage.ts         # Storage mutations
│   ├── queries.ts         # Live-updating queries
│   └── vectors.ts         # Vector search functions
├── component.config.ts    # Component manifest
└── client/
    ├── index.ts           # ConvexStore adapter
    └── vector.ts          # ConvexVector adapter
```

Component manifest:

```typescript
// component.config.ts
import { defineComponent } from 'convex/server';
import { v } from 'convex/values';

export default defineComponent('mastra', {
  // Exported functions form the public API
  exports: {
    // Storage
    saveThread: { args: { thread: v.any() }, returns: v.any() },
    getThread: { args: { threadId: v.string() }, returns: v.any() },
    listThreadsByResource: { args: { resourceId: v.string() }, returns: v.any() },
    
    // Messages
    saveMessages: { args: { messages: v.array(v.any()) }, returns: v.any() },
    getMessages: { args: { threadId: v.string() }, returns: v.any() },
    
    // Live queries (subscriptions)
    watchThread: { args: { threadId: v.string() }, returns: v.any() },
    watchMessages: { args: { threadId: v.string() }, returns: v.any() },
    
    // Vector search
    vectorSearch: { args: { indexName: v.string(), vector: v.array(v.float64()), topK: v.number() }, returns: v.any() },
  },
});
```

User installation:

```typescript
// convex/convex.config.ts
import { defineApp } from 'convex/server';
import mastra from '@mastra/convex-component';

export default defineApp({
  components: {
    mastra,
  },
});
```

Usage:

```typescript
// In user's Convex functions
import { components } from './_generated/api';

// Call Mastra storage
await ctx.runMutation(components.mastra.saveThread, { thread });
const messages = await ctx.runQuery(components.mastra.getMessages, { threadId });

// Live-updating query
const unsubscribe = client.onUpdate(components.mastra.watchMessages, { threadId }, (messages) => {
  // Called whenever messages change
});
```

---

## Issue 7: Live-Updating Queries

### Current Problem

Users who want live-updating queries (real-time message updates, thread changes) must currently:
1. Write their own Convex queries
2. Query the Mastra tables directly
3. Manage subscriptions themselves

### Proposed Solution

The component architecture (Issue 6) naturally enables this. Additionally, provide query functions users can subscribe to:

```typescript
// convex/queries.ts (in component)
import { queryGeneric } from 'convex/server';

export const watchThread = queryGeneric({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query('mastra_threads')
      .withIndex('by_record_id', q => q.eq('id', threadId))
      .unique();
  },
});

export const watchMessages = queryGeneric({
  args: { threadId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { threadId, limit = 100 }) => {
    return await ctx.db
      .query('mastra_messages')
      .withIndex('by_thread_created', q => q.eq('thread_id', threadId))
      .order('desc')
      .take(limit);
  },
});

export const watchWorkflowRun = queryGeneric({
  args: { workflowName: v.string(), runId: v.string() },
  handler: async (ctx, { workflowName, runId }) => {
    return await ctx.db
      .query('mastra_workflow_snapshots')
      .withIndex('by_workflow_run', q => 
        q.eq('workflow_name', workflowName).eq('run_id', runId)
      )
      .unique();
  },
});
```

Client-side subscription:

```typescript
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// React hook for live messages
function useLiveMessages(threadId: string) {
  return useQuery(api.components.mastra.watchMessages, { threadId });
}

// Or with vanilla client
const client = new ConvexClient(url);
client.onUpdate(api.components.mastra.watchMessages, { threadId }, (messages) => {
  console.log('Messages updated:', messages);
});
```

---

## Implementation Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 P0 | 5. Vector search | High | Critical for functionality |
| 🔴 P0 | 2. Index usage | Medium | Critical for scale |
| 🟡 P1 | 4. Bandwidth limits | Low | Required for vectors |
| 🟡 P1 | 1. Admin token | Medium | Security best practice |
| 🟢 P2 | 3. Semantic API | Medium | Developer experience |
| 🟢 P2 | 6. Component | High | Long-term architecture |
| 🟢 P2 | 7. Live queries | Low | User feature |

## Recommended Next Steps

1. **Immediate (P0)**
   - Add proper index usage in `queryTable` for known filter patterns
   - Reduce vector batch sizes to avoid bandwidth limits
   - Add Convex native vector search

2. **Short-term (P1)**
   - Refactor to use Convex client SDK instead of admin HTTP API
   - Add semantic operation types for common patterns
   - Add cursor-based pagination

3. **Medium-term (P2)**
   - Create Convex component package
   - Add live query support
   - Document patterns for user extensions

---

## References

- [Convex Vector Search Docs](https://docs.convex.dev/vector-search)
- [Convex Components](https://docs.convex.dev/components)
- [Convex Authentication](https://docs.convex.dev/auth)
- [Convex Query Subscriptions](https://docs.convex.dev/client/react#live-queries)
