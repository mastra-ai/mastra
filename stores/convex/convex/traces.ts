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
      id: trace.id,
      parentSpanId: trace.parentSpanId,
      name: trace.name,
      traceId: trace.traceId,
      scope: trace.scope,
      attributes: trace.attributes,
      status: trace.status,
      kind: trace.kind,
      events: trace.events,
      links: trace.links,
      other: trace.other,
      startTime: trace.startTime,
      endTime: trace.endTime,
      createdAt: trace.createdAt,
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
export const getByTraceId = query({
  args: { traceId: v.string() },
  handler: async (ctx, args) => {
    const traces = await ctx.db
      .query('traces')
      .withIndex('by_traceId', q => q.eq('traceId', args.traceId))
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
    traceId: v.optional(v.string()),
    parentSpanId: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
    skipCount: v.optional(v.number()), // Add skipCount as a separate parameter
    sortDirection: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    // Determine the sort order (defaulting to descending)
    const sortOrder = args.sortDirection === 'asc' ? 'asc' : 'desc';

    // Start with a base query
    let query;

    // Choose the appropriate index based on the provided filters
    if (args.traceId !== undefined) {
      // Extract to a local const to satisfy TypeScript that it's not undefined
      const traceId = args.traceId;
      // When traceId is provided, use the by_traceId index
      query = ctx.db.query('traces').withIndex('by_traceId', q => q.eq('traceId', traceId));
    } else if (args.parentSpanId !== undefined) {
      // Extract to a local const to satisfy TypeScript that it's not undefined
      const parentSpanId = args.parentSpanId;
      // When parentSpanId is provided, use the by_parentSpanId index
      query = ctx.db.query('traces').withIndex('by_parentSpanId', q => q.eq('parentSpanId', parentSpanId));
    } else {
      // Default query when no specific index fields are provided
      query = ctx.db.query('traces');
    }

    // Apply additional filters after the index selection
    // Filter by runId (if threadId was the primary filter)
    if (args.traceId !== undefined && args.parentSpanId !== undefined) {
      // We already know runId is defined due to the condition check
      query = query.filter(q => q.eq(q.field('parentSpanId'), args.parentSpanId));
    }

    // Apply date range filters
    if (args.startDate !== undefined) {
      const startDate = args.startDate; // Extract to a local const to satisfy TypeScript
      query = query.filter(q => q.gte(q.field('createdAt'), startDate));
    }

    if (args.endDate !== undefined) {
      const endDate = args.endDate; // Extract to a local const to satisfy TypeScript
      query = query.filter(q => q.lte(q.field('createdAt'), endDate));
    }

    // Apply sorting for pagination query
    const paginationQuery = query.order(sortOrder);

    // Apply pagination with skip count support
    const paginationOpts = args.paginationOpts;
    const skipCount = args.skipCount || 0; // Use the skipCount parameter we added

    // First get all items up to the requested page end
    const allResults = await paginationQuery.take(paginationOpts.numItems + skipCount);

    // Then slice to get just the current page
    const pageResults = allResults.slice(skipCount);

    // Create pagination result matching the Convex format
    const paginationResult = {
      page: pageResults,
      continueCursor: null, // For simplicity, not implementing cursor-based continuation
    };

    // Create a separate query for counting total records
    // Need to rebuild the query with the same filters
    let countQuery;

    // Choose the appropriate index based on the provided filters
    if (args.traceId !== undefined) {
      const traceId = args.traceId; // Local const to satisfy TypeScript
      countQuery = ctx.db.query('traces').withIndex('by_traceId', q => q.eq('traceId', traceId));
    } else if (args.parentSpanId !== undefined) {
      const parentSpanId = args.parentSpanId; // Local const to satisfy TypeScript
      countQuery = ctx.db.query('traces').withIndex('by_parentSpanId', q => q.eq('parentSpanId', parentSpanId));
    } else {
      countQuery = ctx.db.query('traces');
    }

    // Apply additional filters for count query
    if (args.traceId !== undefined && args.parentSpanId !== undefined) {
      countQuery = countQuery.filter(q => q.eq(q.field('parentSpanId'), args.parentSpanId));
    }

    // Apply date range filters for count query
    if (args.startDate !== undefined) {
      const startDate = args.startDate; // Local const to satisfy TypeScript
      countQuery = countQuery.filter(q => q.gte(q.field('createdAt'), startDate));
    }

    if (args.endDate !== undefined) {
      const endDate = args.endDate; // Local const to satisfy TypeScript
      countQuery = countQuery.filter(q => q.lte(q.field('createdAt'), endDate));
    }

    // Get total count
    const total = await countQuery.collect().then(results => results.length);

    // Get number of items per page with default fallback
    const numItems = args.paginationOpts.numItems || 10; // Default to 10 if not specified

    // Return the paginated results with metadata
    // Structure the response to match the expected format with a 'traces' property
    return {
      page: Math.ceil(args.paginationOpts.numItems ? paginationResult.page.length / args.paginationOpts.numItems : 1),
      perPage: args.paginationOpts.numItems || 10,
      total,
      totalPages: Math.ceil(total / numItems),
      traces: paginationResult.page, // Include the traces array from the paginated results
    };
  },
});
