/**
 * Convex query functions for live-updating subscriptions and vector search.
 *
 * These queries can be used with Convex's reactive query system to get
 * real-time updates when data changes.
 *
 * Usage in your Convex project:
 * ```ts
 * // convex/mastra/queries.ts
 * export {
 *   watchThread,
 *   watchMessages,
 *   watchWorkflowRun,
 *   watchThreadsByResource,
 *   vectorSearch,
 * } from '@mastra/convex/server/queries';
 * ```
 *
 * Then subscribe from your client:
 * ```ts
 * import { useQuery } from 'convex/react';
 * import { api } from '../convex/_generated/api';
 *
 * const messages = useQuery(api.mastra.queries.watchMessages, { threadId: '...' });
 * ```
 */

import { queryGeneric } from 'convex/server';
import { v } from 'convex/values';

// ============================================================================
// Vector Search Query
// ============================================================================

/**
 * Perform native vector similarity search.
 *
 * Requires a vectorIndex to be defined on the mastra_vectors table:
 * ```ts
 * mastra_vectors: mastraVectorsTable.vectorIndex('by_embedding', {
 *   vectorField: 'embedding',
 *   dimensions: 1536,
 *   filterFields: ['indexName'],
 * })
 * ```
 *
 * If no vectorIndex is defined, falls back to brute-force search.
 */
export const vectorSearch = queryGeneric({
  args: {
    indexName: v.string(),
    queryVector: v.array(v.float64()),
    topK: v.optional(v.number()),
    includeVector: v.optional(v.boolean()),
  },
  handler: async (ctx, { indexName, queryVector, topK = 10, includeVector = false }) => {
    // Try native vector search first
    try {
      const results = await (ctx.db as any)
        .query('mastra_vectors')
        .withSearchIndex('by_embedding', (q: any) => q.vector('embedding', queryVector).eq('indexName', indexName))
        .take(topK);

      return results.map((doc: any) => ({
        id: doc.id,
        score: doc._score ?? 1.0,
        metadata: doc.metadata,
        ...(includeVector ? { vector: doc.embedding } : {}),
      }));
    } catch {
      // Fall back to brute-force search
      const docs = await ctx.db
        .query('mastra_vectors')
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(Math.min(500, topK * 10));

      const scored = docs
        .map((doc: any) => ({
          id: doc.id,
          score: cosineSimilarity(queryVector, doc.embedding),
          metadata: doc.metadata,
          ...(includeVector ? { vector: doc.embedding } : {}),
        }))
        .filter((r: any) => Number.isFinite(r.score))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, topK);

      return scored;
    }
  },
});

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;

  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dot += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  if (magA === 0 || magB === 0) return -1;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ============================================================================
// Live Query Functions
// ============================================================================

/**
 * Watch a thread by ID for live updates.
 * Uses the by_record_id index for efficient lookup.
 */
export const watchThread = queryGeneric({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query('mastra_threads')
      .withIndex('by_record_id', (q: any) => q.eq('id', threadId))
      .unique();
  },
});

/**
 * Watch messages for a thread with live updates.
 * Uses the by_thread index for efficient lookup.
 */
export const watchMessages = queryGeneric({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, { threadId, limit = 100, order = 'asc' }) => {
    const query = ctx.db.query('mastra_messages').withIndex('by_thread', (q: any) => q.eq('thread_id', threadId));

    return await query.order(order).take(Math.min(limit, 1000));
  },
});

/**
 * Watch threads for a resource with live updates.
 * Uses the by_resource index for efficient lookup.
 */
export const watchThreadsByResource = queryGeneric({
  args: {
    resourceId: v.string(),
    limit: v.optional(v.number()),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, { resourceId, limit = 50, order = 'desc' }) => {
    const query = ctx.db.query('mastra_threads').withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));

    return await query.order(order).take(Math.min(limit, 1000));
  },
});

/**
 * Watch a workflow run for live updates.
 * Uses the by_workflow_run index for efficient lookup.
 */
export const watchWorkflowRun = queryGeneric({
  args: {
    workflowName: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, { workflowName, runId }) => {
    return await ctx.db
      .query('mastra_workflow_snapshots')
      .withIndex('by_workflow_run', (q: any) => q.eq('workflow_name', workflowName).eq('run_id', runId))
      .unique();
  },
});

/**
 * Watch workflow runs for a specific workflow with live updates.
 * Uses the by_workflow index for efficient lookup.
 */
export const watchWorkflowRuns = queryGeneric({
  args: {
    workflowName: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workflowName, resourceId, limit = 50 }) => {
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
      query = ctx.db.query('mastra_workflow_snapshots').withIndex('by_created');
    }

    return await query.order('desc').take(Math.min(limit, 1000));
  },
});

/**
 * Watch a resource (user) for live updates to working memory.
 * Uses the by_record_id index for efficient lookup.
 */
export const watchResource = queryGeneric({
  args: {
    resourceId: v.string(),
  },
  handler: async (ctx, { resourceId }) => {
    return await ctx.db
      .query('mastra_resources')
      .withIndex('by_record_id', (q: any) => q.eq('id', resourceId))
      .unique();
  },
});

// ============================================================================
// Count Queries - Efficient aggregations
// ============================================================================

/**
 * Count messages for a thread.
 */
export const countMessages = queryGeneric({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const docs = await ctx.db
      .query('mastra_messages')
      .withIndex('by_thread', (q: any) => q.eq('thread_id', threadId))
      .take(1001);

    return {
      count: Math.min(docs.length, 1000),
      isEstimate: docs.length > 1000,
    };
  },
});

/**
 * Count threads for a resource.
 */
export const countThreads = queryGeneric({
  args: {
    resourceId: v.optional(v.string()),
  },
  handler: async (ctx, { resourceId }) => {
    let query;
    if (resourceId) {
      query = ctx.db.query('mastra_threads').withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));
    } else {
      query = ctx.db.query('mastra_threads');
    }

    const docs = await query.take(1001);

    return {
      count: Math.min(docs.length, 1000),
      isEstimate: docs.length > 1000,
    };
  },
});

/**
 * Count workflow runs with optional filters.
 */
export const countWorkflowRuns = queryGeneric({
  args: {
    workflowName: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  handler: async (ctx, { workflowName, resourceId }) => {
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

    const docs = await query.take(1001);

    return {
      count: Math.min(docs.length, 1000),
      isEstimate: docs.length > 1000,
    };
  },
});

// ============================================================================
// Paginated Queries - Cursor-based pagination
// ============================================================================

/**
 * Paginated messages query with cursor support.
 */
export const paginatedMessages = queryGeneric({
  args: {
    threadId: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, { threadId, cursor, limit = 50, order = 'asc' }) => {
    let query = ctx.db.query('mastra_messages').withIndex('by_thread', (q: any) => q.eq('thread_id', threadId));

    // Apply cursor filter
    if (cursor) {
      query = query.filter((q: any) =>
        order === 'desc' ? q.lt(q.field('createdAt'), cursor) : q.gt(q.field('createdAt'), cursor),
      );
    }

    const docs = await query.order(order).take(Math.min(limit, 1000) + 1);
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.createdAt : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  },
});

/**
 * Paginated threads query with cursor support.
 */
export const paginatedThreads = queryGeneric({
  args: {
    resourceId: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, { resourceId, cursor, limit = 50, order = 'desc' }) => {
    let query = ctx.db.query('mastra_threads').withIndex('by_resource', (q: any) => q.eq('resourceId', resourceId));

    if (cursor) {
      query = query.filter((q: any) =>
        order === 'desc' ? q.lt(q.field('createdAt'), cursor) : q.gt(q.field('createdAt'), cursor),
      );
    }

    const docs = await query.order(order).take(Math.min(limit, 1000) + 1);
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.createdAt : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  },
});

/**
 * Paginated workflow runs query with cursor support.
 */
export const paginatedWorkflowRuns = queryGeneric({
  args: {
    workflowName: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workflowName, resourceId, cursor, limit = 50 }) => {
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
      query = ctx.db.query('mastra_workflow_snapshots').withIndex('by_created');
    }

    if (cursor) {
      query = query.filter((q: any) => q.lt(q.field('createdAt'), cursor));
    }

    const docs = await query.order('desc').take(Math.min(limit, 1000) + 1);
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.createdAt : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  },
});
