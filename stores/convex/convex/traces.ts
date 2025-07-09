import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

/**
 * Save a trace
 */
export const save = mutation({
  args: { trace: v.any() },
  handler: async (ctx, args) => {
    const { trace } = args;

    const traceData = {
      traceId: trace.id,
      threadId: trace.threadId,
      transportId: trace.transportId,
      runId: trace.runId,
      rootRunId: trace.rootRunId,
      timestamp: trace.timestamp || Date.now(),
      properties: trace.properties || {},
      spans: trace.spans || [],
      spanDurations: trace.spanDurations || {},
    };

    // Check if trace already exists
    const existingTrace = await ctx.db
      .query('traces')
      .withIndex('by_traceId', q => q.eq('traceId', trace.id))
      .first();

    if (existingTrace) {
      // Update existing trace
      await ctx.db.patch(existingTrace._id, traceData);
    } else {
      // Insert new trace
      await ctx.db.insert('traces', traceData);
    }

    return trace;
  },
});

/**
 * Get traces for a thread
 */
export const getByThreadId = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const traces = await ctx.db
      .query('traces')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .order('desc')
      .collect();

    return traces;
  },
});

/**
 * Get traces with efficient pagination
 */
export const getPaginated = query({
  args: {
    threadId: v.optional(v.string()),
    runId: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
    sortDirection: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    // Determine the sort order (defaulting to descending)
    const sortOrder = args.sortDirection === 'asc' ? 'asc' : 'desc';

    // Start with a base query
    let query;

    // Choose the appropriate index based on the provided filters
    if (args.threadId !== undefined) {
      // Extract to a local const to satisfy TypeScript that it's not undefined
      const threadId = args.threadId;
      // When threadId is provided, use the by_threadId index
      query = ctx.db.query('traces').withIndex('by_threadId', q => q.eq('threadId', threadId));
    } else if (args.runId !== undefined) {
      // Extract to a local const to satisfy TypeScript that it's not undefined
      const runId = args.runId;
      // When runId is provided, use the by_runId index
      query = ctx.db.query('traces').withIndex('by_runId', q => q.eq('runId', runId));
    } else {
      // Default query when no specific index fields are provided
      query = ctx.db.query('traces');
    }

    // Apply additional filters after the index selection
    // Filter by runId (if threadId was the primary filter)
    if (args.threadId !== undefined && args.runId !== undefined) {
      // We already know runId is defined due to the condition check
      query = query.filter(q => q.eq(q.field('runId'), args.runId));
    }

    // Apply date range filters
    if (args.startDate !== undefined) {
      const startDate = args.startDate; // Extract to a local const to satisfy TypeScript
      query = query.filter(q => q.gte(q.field('timestamp'), startDate));
    }

    if (args.endDate !== undefined) {
      const endDate = args.endDate; // Extract to a local const to satisfy TypeScript
      query = query.filter(q => q.lte(q.field('timestamp'), endDate));
    }

    // Apply sorting
    const orderedQuery = query.order(sortOrder);

    // Apply pagination
    const paginationResult = await orderedQuery.paginate(args.paginationOpts);

    // Get total count
    const total = await orderedQuery.collect().then(results => results.length);

    // Return the paginated results with metadata
    return {
      ...paginationResult,
      total,
      totalPages: Math.ceil(total / args.paginationOpts.numItems),
    };
  },
});
