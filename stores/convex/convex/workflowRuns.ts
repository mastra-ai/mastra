import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { query, mutation } from './_generated/server';

/**
 * Save a workflow run
 */
export const save = mutation({
  args: { workflowRun: v.any() },
  handler: async (ctx, args) => {
    const { workflowRun } = args;

    const runData = {
      runId: workflowRun.id,
      workflowName: workflowRun.workflowName,
      resourceId: workflowRun.resourceId,
      stateType: workflowRun.stateType,
      state: workflowRun.state || {},
      error: workflowRun.error,
      createdAt: workflowRun.createdAt || Date.now(),
      updatedAt: workflowRun.updatedAt || Date.now(),
      completedAt: workflowRun.completedAt,
    };

    // Check if workflow run already exists
    const existingRun = await ctx.db
      .query('workflowRuns')
      .withIndex('by_runId', q => q.eq('runId', workflowRun.id))
      .first();

    if (existingRun) {
      // Update existing run
      await ctx.db.patch(existingRun._id, {
        ...runData,
        updatedAt: Date.now(),
      });
    } else {
      // Insert new run
      await ctx.db.insert('workflowRuns', runData);
    }

    return workflowRun;
  },
});

/**
 * Get a workflow run by ID
 */
export const get = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('workflowRuns')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first();

    return run || null;
  },
});

/**
 * Get workflow runs by state type
 */
export const getByStateType = query({
  args: { stateType: v.string() },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query('workflowRuns')
      .withIndex('by_stateType', q => q.eq('stateType', args.stateType))
      .collect();

    return runs;
  },
});

/**
 * Update workflow runs
 */
export const update = mutation({
  args: { runs: v.array(v.any()) },
  handler: async (ctx, args) => {
    const { runs } = args;
    let updatedCount = 0;

    for (const run of runs) {
      // Find the run by ID
      const existingRun = await ctx.db
        .query('workflowRuns')
        .withIndex('by_runId', q => q.eq('runId', run.id))
        .first();

      if (existingRun) {
        // Update run
        const updateData: Partial<Doc<'workflowRuns'>> = {
          updatedAt: Date.now(),
        };

        if (run.state !== undefined) {
          updateData.state = run.state;
        }

        if (run.stateType !== undefined) {
          updateData.stateType = run.stateType;
        }

        if (run.error !== undefined) {
          updateData.error = run.error;
        }

        if (run.completedAt !== undefined) {
          updateData.completedAt = run.completedAt;
        }

        await ctx.db.patch(existingRun._id, updateData);
        updatedCount++;
      }
    }

    return updatedCount;
  },
});

/**
 * Get workflow runs with filters
 */

export const getWithFilters = query({
  args: {
    workflowName: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Define a function to build our query with all filters applied
    const buildQuery = () => {
      // Start with determining the correct index to use
      let queryBuilder;

      if (args.resourceId) {
        // Use the by_resourceId index when filtering by resourceId
        queryBuilder = ctx.db
          .query('workflowRuns')
          .withIndex('by_resourceId', q => q.eq('resourceId', args.resourceId));
      } else {
        // Otherwise use the default index
        queryBuilder = ctx.db.query('workflowRuns');
      }

      // Apply workflow name filter if provided
      if (args.workflowName) {
        queryBuilder = queryBuilder.filter(q => q.eq(q.field('workflowName'), args.workflowName));
      }

      // Apply date range filters
      if (args.fromDate && args.toDate) {
        queryBuilder = queryBuilder.filter(q =>
          q.and(
            q.gte(q.field('createdAt'), args.fromDate as number),
            q.lte(q.field('createdAt'), args.toDate as number),
          ),
        );
      } else if (args.fromDate) {
        queryBuilder = queryBuilder.filter(q => q.gte(q.field('createdAt'), args.fromDate as number));
      } else if (args.toDate) {
        queryBuilder = queryBuilder.filter(q => q.lte(q.field('createdAt'), args.toDate as number));
      }

      return queryBuilder.order('desc');
    };

    // Build the query
    const query = buildQuery();

    // Order by creation date, newest first and paginate
    const paginationResult = await query.paginate(args.paginationOpts);

    // Get total count (this will be an additional query)
    const totalResults = await buildQuery().collect();

    return {
      ...paginationResult,
      total: totalResults.length,
    };
  },
});
