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
  args: {
    thread: v.object({
      id: v.string(),
      resourceId: v.string(),
      title: v.string(),
      metadata: v.any(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  },
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
 * Save multiple threads in a batch
 */
export const batchSave = mutation({
  args: {
    threads: v.array(
      v.object({
        id: v.string(),
        resourceId: v.optional(v.string()),
        title: v.optional(v.string()),
        metadata: v.optional(v.any()),
        createdAt: v.optional(v.number()),
        updatedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { threads } = args;
    const savedThreads = [];

    for (const thread of threads) {
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

        savedThreads.push({
          ...thread,
          updatedAt: Date.now(),
        });
      } else {
        // Create new thread
        const threadData = {
          threadId: thread.id,
          resourceId: thread.resourceId,
          title: thread.title,
          metadata: thread.metadata || {},
          createdAt: thread.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        const id = await ctx.db.insert('threads', threadData);
        savedThreads.push({
          ...thread,
          _id: id,
        });
      }
    }

    return {
      success: true,
      count: savedThreads.length,
      threads: savedThreads,
    };
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

/**
 * Load threads based on different key combinations
 * @param keys Object containing one of:
 *   - threadId: string - Get a single thread by its ID
 *   - resourceId: string - Get threads for a resource
 *   - paginationOpts?: PaginationOptions - Optional pagination options
 *   - sortDirection?: 'asc' | 'desc' - Sort order (default: 'desc' for most recent first)
 */
export const load = query({
  args: {
    keys: v.record(v.string(), v.any()), // Using v.any() to support complex values like paginationOpts
  },
  handler: async (ctx, args) => {
    const { keys } = args;

    // Handle single thread by ID
    if (keys.threadId && typeof keys.threadId === 'string') {
      const thread = await ctx.db
        .query('threads')
        .withIndex('by_threadId', q => q.eq('threadId', keys.threadId))
        .first();
      return thread || null;
    }

    // Handle threads by resourceId
    if (keys.resourceId && typeof keys.resourceId === 'string') {
      const sortOrder = keys.sortDirection === 'asc' ? 'asc' : 'desc';
      let query = ctx.db
        .query('threads')
        .withIndex('by_resourceId', q => q.eq('resourceId', keys.resourceId))
        .order(sortOrder);

      // Apply pagination if options are provided
      if (keys.paginationOpts) {
        const paginatedResults = await query.paginate(keys.paginationOpts);
        // Get total count for pagination metadata
        const total = await ctx.db
          .query('threads')
          .withIndex('by_resourceId', q => q.eq('resourceId', keys.resourceId))
          .collect()
          .then(results => results.length);

        return {
          ...paginatedResults,
          total,
          totalPages: Math.ceil(total / keys.paginationOpts.numItems),
        };
      }

      // Return all results if no pagination
      const threads = await query.collect();
      return threads.map(thread => ({
        id: thread.threadId,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
        resourceId: thread.resourceId,
      }));
    }

    throw new Error('Must provide either threadId or resourceId in keys');
  },
});
