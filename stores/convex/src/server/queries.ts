/**
 * Convex query functions for live-updating subscriptions.
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
