import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { GenericMutationCtx as MutationCtx } from 'convex/server';
import { mutationGeneric } from 'convex/server';

import type { EqualityFilter, StorageRequest, StorageResponse } from '../storage/types';

// Vector-specific table names (not in @mastra/core)
const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
const VECTOR_TABLE_PREFIX = 'mastra_vector_';

// Safe batch sizes to stay within Convex limits
const QUERY_BATCH_SIZE = 1000; // Safe for most queries
const VECTOR_BATCH_SIZE = 500; // Smaller for vector data (embeddings are large)
const DELETE_BATCH_SIZE = 25; // Small batches for deletes to stay within 1s timeout

/**
 * Determines which Convex table to use based on the logical table name.
 * Returns the Convex table name and whether it's a typed table or fallback.
 */
function resolveTable(tableName: string): { convexTable: string; isTyped: boolean } {
  switch (tableName) {
    case TABLE_THREADS:
      return { convexTable: 'mastra_threads', isTyped: true };
    case TABLE_MESSAGES:
      return { convexTable: 'mastra_messages', isTyped: true };
    case TABLE_RESOURCES:
      return { convexTable: 'mastra_resources', isTyped: true };
    case TABLE_WORKFLOW_SNAPSHOT:
      return { convexTable: 'mastra_workflow_snapshots', isTyped: true };
    case TABLE_SCORERS:
      return { convexTable: 'mastra_scorers', isTyped: true };
    case TABLE_VECTOR_INDEXES:
      return { convexTable: 'mastra_vector_indexes', isTyped: true };
    default:
      // Check if it's a vector data table
      if (tableName.startsWith(VECTOR_TABLE_PREFIX)) {
        return { convexTable: 'mastra_vectors', isTyped: true };
      }
      // Fallback to generic documents table for unknown tables
      return { convexTable: 'mastra_documents', isTyped: false };
  }
}

/**
 * Main storage mutation handler.
 * Routes operations to the appropriate typed table and uses indexes when possible.
 */
export const mastraStorage = mutationGeneric(async (ctx, request: StorageRequest): Promise<StorageResponse> => {
  try {
    // Handle semantic operations first (these are optimized)
    if ('op' in request) {
      switch (request.op) {
        // Thread semantic operations
        case 'getThread':
          return handleGetThread(ctx, request.threadId);
        case 'listThreadsByResource':
          return handleListThreadsByResource(ctx, request);

        // Message semantic operations
        case 'getMessages':
          return handleGetMessages(ctx, request);
        case 'getMessagesByResource':
          return handleGetMessagesByResource(ctx, request);

        // Workflow semantic operations
        case 'getWorkflowRun':
          return handleGetWorkflowRun(ctx, request.workflowName, request.runId);
        case 'listWorkflowRuns':
          return handleListWorkflowRuns(ctx, request);

        // Vector semantic operations
        case 'vectorSearch':
          return handleVectorSearch(ctx, request);
        case 'getVectorIndexStats':
          return handleGetVectorIndexStats(ctx, request.indexName);
        case 'upsertVectors':
          return handleUpsertVectors(ctx, request);

        // Aggregation operations
        case 'countMessages':
          return handleCountMessages(ctx, request.threadId);
        case 'countThreads':
          return handleCountThreads(ctx, request.resourceId);
        case 'countWorkflowRuns':
          return handleCountWorkflowRuns(ctx, request);
        case 'countVectors':
          return handleCountVectors(ctx, request.indexName);
      }
    }

    // Handle generic operations (with index optimization where possible)
    const tableName = 'tableName' in request ? request.tableName : '';
    const { convexTable, isTyped } = resolveTable(tableName);

    // Handle vector data tables specially (but NOT vector_indexes which is a typed table)
    if (tableName.startsWith(VECTOR_TABLE_PREFIX) && tableName !== TABLE_VECTOR_INDEXES) {
      return handleVectorOperation(ctx, request as any);
    }

    // Handle typed tables with index optimization
    if (isTyped) {
      return handleTypedOperation(ctx, convexTable, tableName, request as any);
    }

    // Fallback to generic table for unknown tables
    return handleGenericOperation(ctx, request as any);
  } catch (error) {
    const err = error as Error;
    return {
      ok: false,
      error: err.message,
    };
  }
});

// ============================================================================
// Semantic Operation Handlers - Use optimal indexes
// ============================================================================

/**
 * Get a thread by ID using the by_record_id index.
 */
async function handleGetThread(ctx: MutationCtx<any>, threadId: string): Promise<StorageResponse> {
  const doc = await ctx.db
    .query('mastra_threads')
    .withIndex('by_record_id', (q: any) => q.eq('id', threadId))
    .unique();
  return { ok: true, result: doc };
}

/**
 * List threads by resource ID using the by_resource index.
 */
async function handleListThreadsByResource(
  ctx: MutationCtx<any>,
  request: { resourceId: string; limit?: number; cursor?: string; orderBy?: string; orderDirection?: string },
): Promise<StorageResponse> {
  const { resourceId, limit = QUERY_BATCH_SIZE, cursor, orderDirection = 'desc' } = request;

  let query = ctx.db.query('mastra_threads').withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));

  // Apply cursor if provided (for pagination)
  if (cursor) {
    query = query.filter((q: any) =>
      orderDirection === 'desc' ? q.lt(q.field('createdAt'), cursor) : q.gt(q.field('createdAt'), cursor),
    );
  }

  const docs = await query.order(orderDirection as 'asc' | 'desc').take(Math.min(limit, QUERY_BATCH_SIZE));

  const nextCursor = docs.length === limit && docs.length > 0 ? docs[docs.length - 1]?.createdAt : undefined;

  return { ok: true, result: docs, cursor: nextCursor, hasMore: docs.length === limit };
}

/**
 * Get messages for a thread using the by_thread_created index.
 */
async function handleGetMessages(
  ctx: MutationCtx<any>,
  request: { threadId: string; limit?: number; cursor?: string; orderDirection?: string },
): Promise<StorageResponse> {
  const { threadId, limit = QUERY_BATCH_SIZE, cursor, orderDirection = 'asc' } = request;

  let query = ctx.db.query('mastra_messages').withIndex('by_thread', (q: any) => q.eq('thread_id', threadId));

  // Apply cursor if provided (for pagination)
  if (cursor) {
    query = query.filter((q: any) =>
      orderDirection === 'desc' ? q.lt(q.field('createdAt'), cursor) : q.gt(q.field('createdAt'), cursor),
    );
  }

  const docs = await query.order(orderDirection as 'asc' | 'desc').take(Math.min(limit, QUERY_BATCH_SIZE));

  const nextCursor = docs.length === limit && docs.length > 0 ? docs[docs.length - 1]?.createdAt : undefined;

  return { ok: true, result: docs, cursor: nextCursor, hasMore: docs.length === limit };
}

/**
 * Get messages by resource ID using the by_resource index.
 */
async function handleGetMessagesByResource(
  ctx: MutationCtx<any>,
  request: { resourceId: string; limit?: number; cursor?: string },
): Promise<StorageResponse> {
  const { resourceId, limit = QUERY_BATCH_SIZE, cursor } = request;

  let query = ctx.db.query('mastra_messages').withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));

  if (cursor) {
    query = query.filter((q: any) => q.gt(q.field('createdAt'), cursor));
  }

  const docs = await query.order('desc').take(Math.min(limit, QUERY_BATCH_SIZE));

  const nextCursor = docs.length === limit && docs.length > 0 ? docs[docs.length - 1]?.createdAt : undefined;

  return { ok: true, result: docs, cursor: nextCursor, hasMore: docs.length === limit };
}

/**
 * Get a workflow run using the by_workflow_run index.
 */
async function handleGetWorkflowRun(
  ctx: MutationCtx<any>,
  workflowName: string,
  runId: string,
): Promise<StorageResponse> {
  const doc = await ctx.db
    .query('mastra_workflow_snapshots')
    .withIndex('by_workflow_run', (q: any) => q.eq('workflow_name', workflowName).eq('run_id', runId))
    .unique();
  return { ok: true, result: doc };
}

/**
 * List workflow runs with optional filters, using appropriate indexes.
 */
async function handleListWorkflowRuns(
  ctx: MutationCtx<any>,
  request: { workflowName?: string; resourceId?: string; status?: string; limit?: number; cursor?: string },
): Promise<StorageResponse> {
  const { workflowName, resourceId, status, limit = QUERY_BATCH_SIZE, cursor } = request;

  let query;

  // Choose the best index based on available filters
  if (workflowName) {
    query = ctx.db
      .query('mastra_workflow_snapshots')
      .withIndex('by_workflow', (q: any) => q.eq('workflow_name', workflowName));
  } else if (resourceId) {
    query = ctx.db
      .query('mastra_workflow_snapshots')
      .withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));
  } else {
    // Fallback to createdAt index for general listing
    query = ctx.db.query('mastra_workflow_snapshots').withIndex('by_created');
  }

  // Apply cursor for pagination
  if (cursor) {
    query = query.filter((q: any) => q.lt(q.field('createdAt'), cursor));
  }

  let docs = await query.order('desc').take(Math.min(limit, QUERY_BATCH_SIZE));

  // Apply in-memory filters for fields without dedicated indexes
  if (status) {
    docs = docs.filter((doc: any) => {
      const snapshot = typeof doc.snapshot === 'string' ? JSON.parse(doc.snapshot) : doc.snapshot;
      return snapshot?.status === status;
    });
  }

  const nextCursor = docs.length === limit && docs.length > 0 ? docs[docs.length - 1]?.createdAt : undefined;

  return { ok: true, result: docs, cursor: nextCursor, hasMore: docs.length === limit };
}

// ============================================================================
// Vector Semantic Operations
// ============================================================================

/**
 * Perform vector similarity search.
 *
 * This implementation:
 * 1. First tries native Convex vector search (if vectorIndex is defined)
 * 2. Falls back to brute-force search with server-side cosine similarity
 *
 * For optimal performance at scale, define a vectorIndex in your schema:
 * ```ts
 * mastra_vectors: mastraVectorsTable.vectorIndex('by_embedding', {
 *   vectorField: 'embedding',
 *   dimensions: 1536,
 *   filterFields: ['indexName'],
 * })
 * ```
 */
async function handleVectorSearch(
  ctx: MutationCtx<any>,
  request: {
    indexName: string;
    queryVector: number[];
    topK: number;
    filter?: Record<string, any>;
    includeVector?: boolean;
    useNativeSearch?: boolean;
  },
): Promise<StorageResponse> {
  const { indexName, queryVector, topK, filter, includeVector = false, useNativeSearch = true } = request;

  // Try native vector search first (if available)
  if (useNativeSearch) {
    try {
      const nativeResults = await tryNativeVectorSearch(ctx, indexName, queryVector, topK, includeVector);
      if (nativeResults) {
        // Apply metadata filter if provided
        let results = nativeResults;
        if (filter && Object.keys(filter).length > 0) {
          results = results.filter((doc: any) => matchesFilter(doc.metadata, filter));
        }
        return { ok: true, result: results.slice(0, topK) };
      }
    } catch {
      // Native search not available, fall back to brute-force
    }
  }

  // Fallback: brute-force search with server-side cosine similarity
  return handleBruteForceVectorSearch(ctx, indexName, queryVector, topK, filter, includeVector);
}

/**
 * Try native Convex vector search using vectorIndex.
 * Returns null if vectorIndex is not available.
 */
async function tryNativeVectorSearch(
  ctx: MutationCtx<any>,
  indexName: string,
  queryVector: number[],
  topK: number,
  includeVector: boolean,
): Promise<any[] | null> {
  try {
    // Attempt to use native vector search
    // This will throw if the vectorIndex 'by_embedding' doesn't exist
    const results = await (ctx.db as any)
      .query('mastra_vectors')
      .withSearchIndex('by_embedding', (q: any) => q.vector('embedding', queryVector).eq('indexName', indexName))
      .take(topK);

    return results.map((doc: any) => ({
      id: doc.id,
      score: doc._score ?? 1.0, // Convex provides _score for vector search
      metadata: doc.metadata,
      ...(includeVector ? { vector: doc.embedding } : {}),
    }));
  } catch {
    // Vector index not available
    return null;
  }
}

/**
 * Brute-force vector search with server-side cosine similarity.
 * Used as fallback when native vectorIndex is not available.
 */
async function handleBruteForceVectorSearch(
  ctx: MutationCtx<any>,
  indexName: string,
  queryVector: number[],
  topK: number,
  filter: Record<string, any> | undefined,
  includeVector: boolean,
): Promise<StorageResponse> {
  // Use a safe batch size for vectors (embeddings are large)
  const fetchLimit = Math.min(VECTOR_BATCH_SIZE, topK * 10);

  const docs = await ctx.db
    .query('mastra_vectors')
    .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
    .take(fetchLimit);

  // Apply metadata filter if provided
  let filtered = docs;
  if (filter && Object.keys(filter).length > 0) {
    filtered = docs.filter((doc: any) => matchesFilter(doc.metadata, filter));
  }

  // Calculate cosine similarity server-side
  const scored = filtered
    .map((doc: any) => ({
      id: doc.id,
      score: cosineSimilarity(queryVector, doc.embedding),
      metadata: doc.metadata,
      ...(includeVector ? { vector: doc.embedding } : {}),
    }))
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { ok: true, result: scored };
}

/**
 * Get vector index statistics without loading all vectors.
 */
async function handleGetVectorIndexStats(ctx: MutationCtx<any>, indexName: string): Promise<StorageResponse> {
  // Get index metadata
  const indexMeta = await ctx.db
    .query('mastra_vector_indexes')
    .withIndex('by_record_id', (q: any) => q.eq('id', indexName))
    .unique();

  if (!indexMeta) {
    return { ok: false, error: `Index ${indexName} not found` };
  }

  // Count vectors efficiently by sampling
  // Note: For accurate count, we'd need a separate counter or aggregate query
  const sampleDocs = await ctx.db
    .query('mastra_vectors')
    .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
    .take(VECTOR_BATCH_SIZE + 1);

  const hasMore = sampleDocs.length > VECTOR_BATCH_SIZE;

  return {
    ok: true,
    result: {
      dimension: indexMeta.dimension,
      count: hasMore ? `${VECTOR_BATCH_SIZE}+` : sampleDocs.length,
      metric: indexMeta.metric || 'cosine',
    },
  };
}

/**
 * Upsert vectors in batches.
 */
async function handleUpsertVectors(
  ctx: MutationCtx<any>,
  request: {
    indexName: string;
    vectors: Array<{ id: string; embedding: number[]; metadata?: Record<string, any> }>;
  },
): Promise<StorageResponse> {
  const { indexName, vectors } = request;

  for (const vector of vectors) {
    const existing = await ctx.db
      .query('mastra_vectors')
      .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', vector.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        embedding: vector.embedding,
        metadata: vector.metadata,
      });
    } else {
      await ctx.db.insert('mastra_vectors', {
        id: vector.id,
        indexName,
        embedding: vector.embedding,
        metadata: vector.metadata,
      });
    }
  }

  return { ok: true, result: vectors.map(v => v.id) };
}

// ============================================================================
// Aggregation Handlers - Efficient counts
// ============================================================================

/**
 * Count messages for a thread using the by_thread index.
 * More efficient than loading all messages.
 */
async function handleCountMessages(ctx: MutationCtx<any>, threadId: string): Promise<StorageResponse> {
  // Use index to efficiently count
  const docs = await ctx.db
    .query('mastra_messages')
    .withIndex('by_thread', (q: any) => q.eq('thread_id', threadId))
    .take(QUERY_BATCH_SIZE + 1);

  const count = docs.length;
  const isEstimate = count > QUERY_BATCH_SIZE;

  return {
    ok: true,
    result: {
      count: isEstimate ? QUERY_BATCH_SIZE : count,
      isEstimate,
    },
  };
}

/**
 * Count threads, optionally filtered by resource.
 */
async function handleCountThreads(ctx: MutationCtx<any>, resourceId?: string): Promise<StorageResponse> {
  let query;
  if (resourceId) {
    query = ctx.db.query('mastra_threads').withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));
  } else {
    query = ctx.db.query('mastra_threads');
  }

  const docs = await query.take(QUERY_BATCH_SIZE + 1);
  const count = docs.length;
  const isEstimate = count > QUERY_BATCH_SIZE;

  return {
    ok: true,
    result: {
      count: isEstimate ? QUERY_BATCH_SIZE : count,
      isEstimate,
    },
  };
}

/**
 * Count workflow runs with optional filters.
 */
async function handleCountWorkflowRuns(
  ctx: MutationCtx<any>,
  request: { workflowName?: string; resourceId?: string; status?: string },
): Promise<StorageResponse> {
  const { workflowName, resourceId, status } = request;

  let query;
  if (workflowName) {
    query = ctx.db
      .query('mastra_workflow_snapshots')
      .withIndex('by_workflow', (q: any) => q.eq('workflow_name', workflowName));
  } else if (resourceId) {
    query = ctx.db
      .query('mastra_workflow_snapshots')
      .withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));
  } else {
    query = ctx.db.query('mastra_workflow_snapshots');
  }

  let docs = await query.take(QUERY_BATCH_SIZE + 1);

  // Apply status filter if provided
  if (status) {
    docs = docs.filter((doc: any) => {
      const snapshot = typeof doc.snapshot === 'string' ? JSON.parse(doc.snapshot) : doc.snapshot;
      return snapshot?.status === status;
    });
  }

  const count = docs.length;
  const isEstimate = count > QUERY_BATCH_SIZE;

  return {
    ok: true,
    result: {
      count: isEstimate ? QUERY_BATCH_SIZE : count,
      isEstimate,
    },
  };
}

/**
 * Count vectors in an index.
 */
async function handleCountVectors(ctx: MutationCtx<any>, indexName: string): Promise<StorageResponse> {
  const docs = await ctx.db
    .query('mastra_vectors')
    .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
    .take(VECTOR_BATCH_SIZE + 1);

  const count = docs.length;
  const isEstimate = count > VECTOR_BATCH_SIZE;

  return {
    ok: true,
    result: {
      count: isEstimate ? VECTOR_BATCH_SIZE : count,
      isEstimate,
    },
  };
}

// ============================================================================
// Generic Operation Handlers - With index optimization
// ============================================================================

/**
 * Handle operations on typed tables (threads, messages, etc.)
 * Now with smart index selection based on filter patterns.
 */
async function handleTypedOperation(
  ctx: MutationCtx<any>,
  convexTable: string,
  tableName: string,
  request: any,
): Promise<StorageResponse> {
  switch (request.op) {
    case 'insert': {
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Record is missing an id`);
      }

      // Find existing record by id field using index
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', id))
        .unique();

      if (existing) {
        // Update existing - don't include id in patch (it's already set)
        const { id: _, ...updateData } = record;
        await ctx.db.patch(existing._id, updateData);
      } else {
        // Insert new - include id as a regular field
        await ctx.db.insert(convexTable, record);
      }
      return { ok: true };
    }

    case 'batchInsert': {
      for (const record of request.records) {
        const id = record.id;
        if (!id) continue;

        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique();

        if (existing) {
          const { id: _, ...updateData } = record;
          await ctx.db.patch(existing._id, updateData);
        } else {
          await ctx.db.insert(convexTable, record);
        }
      }
      return { ok: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        // Find by id field using index
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', keys.id))
          .unique();
        return { ok: true, result: doc || null };
      }

      // Try to use specific indexes based on table and keys
      const indexedResult = await tryIndexedLoad(ctx, convexTable, tableName, keys);
      if (indexedResult !== undefined) {
        return { ok: true, result: indexedResult };
      }

      // Fallback: limited scan with filter
      const docs = await ctx.db.query(convexTable).take(QUERY_BATCH_SIZE);
      const match = docs.find((doc: any) => Object.entries(keys).every(([key, value]) => doc[key] === value));
      return { ok: true, result: match || null };
    }

    case 'queryTable': {
      const filters = request.filters as EqualityFilter[] | undefined;
      const limit = Math.min(request.limit ?? QUERY_BATCH_SIZE, QUERY_BATCH_SIZE);

      // Try to use an index based on the filter pattern
      const indexedDocs = await tryIndexedQuery(ctx, convexTable, tableName, filters, limit);

      if (indexedDocs !== undefined) {
        return { ok: true, result: indexedDocs };
      }

      // Fallback: scan with in-memory filter (log warning)
      console.warn(`[mastra-convex] No index available for queryTable on ${tableName} with filters:`, filters);
      let docs = await ctx.db.query(convexTable).take(limit);

      if (filters && filters.length > 0) {
        docs = docs.filter((doc: any) => filters.every(filter => doc[filter.field] === filter.value));
      }

      return { ok: true, result: docs };
    }

    case 'clearTable':
    case 'dropTable': {
      const docs = await ctx.db.query(convexTable).take(DELETE_BATCH_SIZE + 1);
      const hasMore = docs.length > DELETE_BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, DELETE_BATCH_SIZE) : docs;

      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      for (const id of request.ids) {
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique();
        if (doc) {
          await ctx.db.delete(doc._id);
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${request.op}` };
  }
}

/**
 * Try to load a record using an appropriate index based on table and keys.
 */
async function tryIndexedLoad(
  ctx: MutationCtx<any>,
  convexTable: string,
  tableName: string,
  keys: Record<string, any>,
): Promise<any | undefined> {
  // Workflow snapshots: use by_workflow_run for (workflow_name, run_id) lookup
  if (tableName === TABLE_WORKFLOW_SNAPSHOT && keys.workflow_name && keys.run_id) {
    return await ctx.db
      .query(convexTable)
      .withIndex('by_workflow_run', (q: any) => q.eq('workflow_name', keys.workflow_name).eq('run_id', keys.run_id))
      .unique();
  }

  return undefined;
}

/**
 * Try to query using an appropriate index based on table and filter pattern.
 */
async function tryIndexedQuery(
  ctx: MutationCtx<any>,
  convexTable: string,
  tableName: string,
  filters: EqualityFilter[] | undefined,
  limit: number,
): Promise<any[] | undefined> {
  if (!filters || filters.length === 0) {
    // No filters - just return first batch
    return await ctx.db.query(convexTable).take(limit);
  }

  const filterMap = new Map(filters.map(f => [f.field, f.value]));

  // Messages: use by_thread index when filtering by thread_id
  if (tableName === TABLE_MESSAGES && filterMap.has('thread_id')) {
    const threadId = filterMap.get('thread_id');
    let docs = await ctx.db
      .query(convexTable)
      .withIndex('by_thread', (q: any) => q.eq('thread_id', threadId))
      .take(limit);

    // Apply remaining filters
    const remainingFilters = filters.filter(f => f.field !== 'thread_id');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Messages: use by_resource index when filtering by resourceId
  if (tableName === TABLE_MESSAGES && filterMap.has('resourceId')) {
    const resourceId = filterMap.get('resourceId');
    let docs = await ctx.db
      .query(convexTable)
      .withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId))
      .take(limit);

    const remainingFilters = filters.filter(f => f.field !== 'resourceId');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Threads: use by_resource index when filtering by resourceId
  if (tableName === TABLE_THREADS && filterMap.has('resourceId')) {
    const resourceId = filterMap.get('resourceId');
    let docs = await ctx.db
      .query(convexTable)
      .withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId))
      .take(limit);

    const remainingFilters = filters.filter(f => f.field !== 'resourceId');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Workflow snapshots: use by_workflow index
  if (tableName === TABLE_WORKFLOW_SNAPSHOT && filterMap.has('workflow_name')) {
    const workflowName = filterMap.get('workflow_name');
    let query = ctx.db.query(convexTable).withIndex('by_workflow', (q: any) => q.eq('workflow_name', workflowName));

    let docs = await query.take(limit);

    // Apply remaining filters (like run_id)
    const remainingFilters = filters.filter(f => f.field !== 'workflow_name');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Workflow snapshots: use by_resource index
  if (tableName === TABLE_WORKFLOW_SNAPSHOT && filterMap.has('resourceId')) {
    const resourceId = filterMap.get('resourceId');
    let docs = await ctx.db
      .query(convexTable)
      .withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId))
      .take(limit);

    const remainingFilters = filters.filter(f => f.field !== 'resourceId');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Scores: use by_scorer index
  if (tableName === TABLE_SCORERS && filterMap.has('scorerId')) {
    const scorerId = filterMap.get('scorerId');
    let docs = await ctx.db
      .query(convexTable)
      .withIndex('by_scorer', (q: any) => q.eq('scorerId', scorerId))
      .take(limit);

    const remainingFilters = filters.filter(f => f.field !== 'scorerId');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Scores: use by_entity index
  if (tableName === TABLE_SCORERS && filterMap.has('entityId')) {
    const entityId = filterMap.get('entityId');
    const entityType = filterMap.get('entityType');
    let query = ctx.db.query(convexTable).withIndex('by_entity', (q: any) => {
      let qb = q.eq('entityId', entityId);
      if (entityType !== undefined) {
        qb = qb.eq('entityType', entityType);
      }
      return qb;
    });

    let docs = await query.take(limit);

    const remainingFilters = filters.filter(f => f.field !== 'entityId' && f.field !== 'entityType');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // Scores: use by_run index
  if (tableName === TABLE_SCORERS && filterMap.has('runId')) {
    const runId = filterMap.get('runId');
    let docs = await ctx.db
      .query(convexTable)
      .withIndex('by_run', (q: any) => q.eq('runId', runId))
      .take(limit);

    const remainingFilters = filters.filter(f => f.field !== 'runId');
    if (remainingFilters.length > 0) {
      docs = docs.filter((doc: any) => remainingFilters.every(f => doc[f.field] === f.value));
    }
    return docs;
  }

  // No matching index pattern found
  return undefined;
}

/**
 * Handle operations on the vectors table.
 * Vectors are stored with indexName to support multiple indexes.
 */
async function handleVectorOperation(ctx: MutationCtx<any>, request: any): Promise<StorageResponse> {
  // Extract the index name from the table name (e.g., "mastra_vector_myindex" -> "myindex")
  const indexName = request.tableName.replace(VECTOR_TABLE_PREFIX, '');
  const convexTable = 'mastra_vectors';

  switch (request.op) {
    case 'insert': {
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Vector record is missing an id`);
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          embedding: record.embedding,
          metadata: record.metadata,
        });
      } else {
        await ctx.db.insert(convexTable, {
          id,
          indexName,
          embedding: record.embedding,
          metadata: record.metadata,
        });
      }
      return { ok: true };
    }

    case 'batchInsert': {
      for (const record of request.records) {
        const id = record.id;
        if (!id) continue;

        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            embedding: record.embedding,
            metadata: record.metadata,
          });
        } else {
          await ctx.db.insert(convexTable, {
            id,
            indexName,
            embedding: record.embedding,
            metadata: record.metadata,
          });
        }
      }
      return { ok: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', keys.id))
          .unique();
        return { ok: true, result: doc || null };
      }
      return { ok: true, result: null };
    }

    case 'queryTable': {
      // Use smaller batch size for vectors to avoid bandwidth limits
      const limit = Math.min(request.limit ?? VECTOR_BATCH_SIZE, VECTOR_BATCH_SIZE);
      let docs = await ctx.db
        .query(convexTable)
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(limit);

      if (request.filters && request.filters.length > 0) {
        docs = docs.filter((doc: any) => request.filters.every((filter: any) => doc[filter.field] === filter.value));
      }

      return { ok: true, result: docs, hasMore: docs.length === limit };
    }

    case 'clearTable':
    case 'dropTable': {
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(DELETE_BATCH_SIZE + 1);
      const hasMore = docs.length > DELETE_BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, DELETE_BATCH_SIZE) : docs;

      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      for (const id of request.ids) {
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique();
        if (doc) {
          await ctx.db.delete(doc._id);
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${request.op}` };
  }
}

/**
 * Handle operations on the generic documents table.
 * Used as fallback for unknown table names.
 */
async function handleGenericOperation(ctx: MutationCtx<any>, request: any): Promise<StorageResponse> {
  const tableName = request.tableName;
  const convexTable = 'mastra_documents';

  switch (request.op) {
    case 'insert': {
      const record = request.record;
      if (!record.id) {
        throw new Error(`Record for table ${tableName} is missing an id`);
      }
      const primaryKey = String(record.id);

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', primaryKey))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { record });
      } else {
        await ctx.db.insert(convexTable, {
          table: tableName,
          primaryKey,
          record,
        });
      }
      return { ok: true };
    }

    case 'batchInsert': {
      for (const record of request.records) {
        if (!record.id) continue;
        const primaryKey = String(record.id);

        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', primaryKey))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, { record });
        } else {
          await ctx.db.insert(convexTable, {
            table: tableName,
            primaryKey,
            record,
          });
        }
      }
      return { ok: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(keys.id)))
          .unique();
        return { ok: true, result: existing ? existing.record : null };
      }

      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(QUERY_BATCH_SIZE);
      const match = docs.find((doc: any) => Object.entries(keys).every(([key, value]) => doc.record?.[key] === value));
      return { ok: true, result: match ? match.record : null };
    }

    case 'queryTable': {
      const limit = Math.min(request.limit ?? QUERY_BATCH_SIZE, QUERY_BATCH_SIZE);
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(limit);

      let records = docs.map((doc: any) => doc.record);

      if (request.filters && request.filters.length > 0) {
        records = records.filter((record: any) =>
          request.filters.every((filter: any) => record?.[filter.field] === filter.value),
        );
      }

      return { ok: true, result: records };
    }

    case 'clearTable':
    case 'dropTable': {
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(DELETE_BATCH_SIZE + 1);
      const hasMore = docs.length > DELETE_BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, DELETE_BATCH_SIZE) : docs;

      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      for (const id of request.ids) {
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(id)))
          .unique();
        if (existing) {
          await ctx.db.delete(existing._id);
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${request.op}` };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return -1;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dot += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  if (magA === 0 || magB === 0) {
    return -1;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Check if a record's metadata matches a filter.
 */
function matchesFilter(metadata: Record<string, any> | undefined, filter: Record<string, any>): boolean {
  if (!metadata) return false;
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, value] of Object.entries(filter)) {
    if (key === 'metadata' && typeof value === 'object') {
      // Handle nested metadata filter
      return matchesFilter(metadata, value);
    }

    // Handle operators
    if (typeof value === 'object' && value !== null) {
      if ('$in' in value && Array.isArray(value.$in)) {
        if (!value.$in.includes(metadata[key])) return false;
        continue;
      }
      if ('$nin' in value && Array.isArray(value.$nin)) {
        if (value.$nin.includes(metadata[key])) return false;
        continue;
      }
      if ('$gt' in value && !(metadata[key] > value.$gt)) return false;
      if ('$gte' in value && !(metadata[key] >= value.$gte)) return false;
      if ('$lt' in value && !(metadata[key] < value.$lt)) return false;
      if ('$lte' in value && !(metadata[key] <= value.$lte)) return false;
      if ('$ne' in value && metadata[key] === value.$ne) return false;
    }

    // Simple equality
    if (metadata[key] !== value) return false;
  }

  return true;
}
