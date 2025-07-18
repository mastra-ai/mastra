import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type {} from './_generated/dataModel';
import { query, mutation } from './_generated/server';

/**
 * Get a thread by its ID
 */
export const getById = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .first();

    return thread || null;
  },
});

/**
 * Get threads by resource ID
 */
export const getByResourceId = query({
  args: { resourceId: v.string() },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query('threads')
      .withIndex('by_resourceId', q => q.eq('resourceId', args.resourceId))
      .collect();

    return threads;
  },
});

/**
 * Get threads by resource ID with efficient pagination
 */
export const getByResourceIdPaginated = query({
  args: {
    resourceId: v.string(),
    paginationOpts: paginationOptsValidator,
    sortDirection: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    // Determine sort order (default to descending by createdAt for threads)
    const sortOrder = args.sortDirection === 'asc' ? 'asc' : 'desc';

    // Build query with resource ID filter and sort order
    const paginationQuery = ctx.db
      .query('threads')
      .withIndex('by_resourceId', q => q.eq('resourceId', args.resourceId))
      .order(sortOrder);

    // Apply pagination using Convex's built-in pagination API
    const paginatedResults = await paginationQuery.paginate(args.paginationOpts);

    // Create a separate query for total count
    const countQuery = ctx.db.query('threads').withIndex('by_resourceId', q => q.eq('resourceId', args.resourceId));

    // Get total count for pagination metadata
    const total = await countQuery.collect().then(results => results.length);

    return {
      ...paginatedResults,
      total,
      totalPages: Math.ceil(total / args.paginationOpts.numItems),
    };
  },
});

/**
 * Save a thread
 */
export const save = mutation({
  args: { thread: v.any() },
  handler: async (ctx, args) => {
    const { thread } = args;
    const existingThread = await ctx.db
      .query('threads')
      .withIndex('by_threadId', q => q.eq('threadId', thread.id))
      .first();

    if (existingThread) {
      // Update existing thread
      await ctx.db.patch(existingThread._id, {
        title: thread.title,
        metadata: thread.metadata,
        updatedAt: Date.now(),
      });

      return {
        ...thread,
        updatedAt: Date.now(),
      };
    } else {
      // Create new thread
      const threadData = {
        threadId: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: thread.metadata,
        createdAt: thread.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await ctx.db.insert('threads', threadData);

      return thread;
    }
  },
});

/**
 * Update a thread
 */
export const update = mutation({
  args: {
    id: v.string(),
    title: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const existingThread = await ctx.db
      .query('threads')
      .withIndex('by_threadId', q => q.eq('threadId', args.id))
      .first();

    if (!existingThread) {
      throw new Error(`Thread with ID ${args.id} not found`);
    }

    // Update thread
    await ctx.db.patch(existingThread._id, {
      title: args.title,
      metadata: args.metadata,
      updatedAt: Date.now(),
    });

    // Return updated thread
    return {
      id: existingThread.threadId,
      resourceId: existingThread.resourceId,
      title: args.title,
      createdAt: existingThread.createdAt,
      updatedAt: Date.now(),
      metadata: args.metadata,
      messages: [], // Messages are handled separately
    };
  },
});

/**
 * Delete a thread
 */
export const deleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query('threads')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .first();

    if (!thread) {
      throw new Error(`Thread with ID ${args.threadId} not found`);
    }

    await ctx.db.delete(thread._id);
  },
});
