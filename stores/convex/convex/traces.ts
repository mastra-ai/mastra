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
 * Save multiple traces in a batch
 */
export const batchSave = mutation({
  args: {
    traces: v.array(
      v.object({
        id: v.string(),
        parentSpanId: v.optional(v.string()),
        name: v.string(),
        traceId: v.string(),
        scope: v.optional(v.string()),
        attributes: v.optional(v.any()),
        status: v.optional(v.any()),
        kind: v.optional(v.number()),
        events: v.optional(v.array(v.any())),
        links: v.optional(v.array(v.any())),
        other: v.optional(v.any()),
        startTime: v.optional(v.number()),
        endTime: v.optional(v.number()),
        createdAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { traces } = args;
    const savedTraces = [];

    for (const trace of traces) {
      const traceData = {
        id: trace.id,
        parentSpanId: trace.parentSpanId || '', // Default empty string for required field
        name: trace.name,
        traceId: trace.traceId,
        scope: trace.scope || '', // Default empty string for required field
        attributes: trace.attributes || {},
        status: trace.status || {},
        kind: trace.kind || 0,
        events: trace.events || [],
        links: trace.links || [],
        other: trace.other || {},
        startTime: trace.startTime || Date.now(),
        endTime: trace.endTime || Date.now(),
        createdAt: trace.createdAt || Date.now(),
      };

      // Check if trace already exists
      const existingTrace = await ctx.db
        .query('traces')
        .withIndex('by_traceId', q => q.eq('traceId', trace.id))
        .first();

      if (existingTrace) {
        // Update existing trace
        await ctx.db.patch(existingTrace._id, traceData);
        savedTraces.push({
          ...trace,
          _id: existingTrace._id,
          _creationTime: existingTrace._creationTime,
        });
      } else {
        // Insert new trace
        const id = await ctx.db.insert('traces', traceData);
        savedTraces.push({
          ...trace,
          _id: id,
        });
      }
    }

    return {
      success: true,
      count: savedTraces.length,
      traces: savedTraces,
    };
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
      const traceId = args.traceId;
      query = ctx.db.query('traces').withIndex('by_traceId', q => q.eq('traceId', traceId));
    } else if (args.parentSpanId !== undefined) {
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
      const startDate = args.startDate;
      query = query.filter(q => q.gte(q.field('startTime'), startDate));
    }

    if (args.endDate !== undefined) {
      const endDate = args.endDate;
      query = query.filter(q => q.lte(q.field('startTime'), endDate));
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
      const traceId = args.traceId;
      countQuery = ctx.db.query('traces').withIndex('by_traceId', q => q.eq('traceId', traceId));
    } else if (args.parentSpanId !== undefined) {
      const parentSpanId = args.parentSpanId;
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
      const startDate = args.startDate;
      countQuery = countQuery.filter(q => q.gte(q.field('startTime'), startDate));
    }

    if (args.endDate !== undefined) {
      const endDate = args.endDate;
      countQuery = countQuery.filter(q => q.lte(q.field('startTime'), endDate));
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

/**
 * Load traces based on different key combinations
 * @param keys Object containing one of:
 *   - traceId: string - Get traces by trace ID
 *   - parentSpanId: string - Get child spans of a parent span
 *   - startDate?: number - Filter traces after this timestamp
 *   - endDate?: number - Filter traces before this timestamp
 *   - paginationOpts?: PaginationOptions - Optional pagination options
 *   - sortDirection?: 'asc' | 'desc' - Sort order (default: 'desc')
 */
export const load = query({
  args: {
    keys: v.record(v.string(), v.any()), // Using v.any() to support complex values like paginationOpts
  },
  handler: async (ctx, args) => {
    const { keys } = args;
    const sortOrder = keys.sortDirection === 'asc' ? 'asc' : 'desc';

    // Handle traces by traceId
    if (keys.traceId && typeof keys.traceId === 'string') {
      let query = ctx.db
        .query('traces')
        .withIndex('by_traceId', q => q.eq('traceId', keys.traceId))
        .order(sortOrder);

      if (keys.paginationOpts) {
        const paginatedResults = await query.paginate(keys.paginationOpts);
        const total = await ctx.db
          .query('traces')
          .withIndex('by_traceId', q => q.eq('traceId', keys.traceId))
          .collect()
          .then(results => results.length);

        return {
          ...paginatedResults,
          total,
          totalPages: Math.ceil(total / keys.paginationOpts.numItems),
        };
      }

      const traces = await query.collect();
      return {
        page: traces,
        isDone: true,
        continueCursor: null,
        total: traces.length,
        totalPages: 1,
      };
    }

    // Handle traces by parentSpanId
    if (keys.parentSpanId && typeof keys.parentSpanId === 'string') {
      let query = ctx.db
        .query('traces')
        .withIndex('by_parentSpanId', q => q.eq('parentSpanId', keys.parentSpanId))
        .order(sortOrder);

      // Apply date filters if provided
      if (keys.startDate) {
        query = query.filter(q => q.gte(q.field('startTime'), Number(keys.startDate)));
      }
      if (keys.endDate) {
        query = query.filter(q => q.lte(q.field('startTime'), Number(keys.endDate)));
      }

      if (keys.paginationOpts) {
        const paginatedResults = await query.paginate(keys.paginationOpts);
        const total = await query.collect().then(results => results.length);

        return {
          ...paginatedResults,
          total,
          totalPages: Math.ceil(total / keys.paginationOpts.numItems),
        };
      }

      const traces = await query.collect();
      return {
        page: traces,
        isDone: true,
        continueCursor: null,
        total: traces.length,
        totalPages: 1,
      };
    }

    throw new Error('Must provide either traceId or parentSpanId in keys');
  },
});
