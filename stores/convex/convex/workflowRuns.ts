import type { WorkflowRunState, WorkflowRunStatus } from '@mastra/core';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { query, mutation } from './_generated/server';

/**
 * Convert a database workflow run to an app model
 */
function convertDbToAppModel(run: Doc<'workflowRuns'>): any {
  const snapshot = typeof run.snapshot === 'string' ? run.snapshot : (run.snapshot as WorkflowRunState | {});

  // IMPORTANT: Keep createdAt and updatedAt as numbers for Convex compatibility
  // The ConvexStorage class will convert them to Date objects on the client side
  return {
    ...run,
    snapshot,
    // Ensure fields are number type to avoid Convex serialization errors
    createdAt: Number(run.createdAt),
    updatedAt: Number(run.updatedAt),
  };
}

/**
 * Save a workflow run
 */
export const save = mutation({
  args: { workflowRun: v.any() },
  handler: async (ctx, args) => {
    const { workflowRun } = args;

    // For stateType-based queries, respect explicit stateType or status from state/snapshot
    const status = workflowRun.stateType || workflowRun.state?.status || workflowRun.snapshot?.status || 'pending';

    const runData = {
      runId: workflowRun.runId,
      workflowName: workflowRun.workflowName || 'unknown',
      resourceId: workflowRun.resourceId,
      snapshot: workflowRun.state || workflowRun.snapshot || {},
      status: status as WorkflowRunStatus,
      createdAt: new Date(workflowRun.createdAt).getTime(),
      updatedAt: new Date(workflowRun.updatedAt).getTime(),
    };

    // Check if workflow run already exists
    const existingRun = await ctx.db
      .query('workflowRuns')
      .withIndex('by_runId', q => q.eq('runId', workflowRun.runId))
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
 * Save multiple workflow runs in a batch
 */
export const batchSave = mutation({
  args: {
    workflowRuns: v.array(
      v.object({
        runId: v.string(),
        workflowName: v.optional(v.string()),
        resourceId: v.optional(v.string()),
        state: v.optional(v.any()),
        snapshot: v.optional(v.any()),
        stateType: v.optional(v.string()),
        status: v.optional(v.string()),
        createdAt: v.optional(v.union(v.string(), v.number())),
        updatedAt: v.optional(v.union(v.string(), v.number())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { workflowRuns } = args;
    const savedRuns = [];

    for (const workflowRun of workflowRuns) {
      // For stateType-based queries, respect explicit stateType or status from state/snapshot
      const status = workflowRun.stateType || workflowRun.state?.status || workflowRun.snapshot?.status || 'pending';

      // Convert dates to timestamps if they're strings
      const createdAt = workflowRun.createdAt ? new Date(workflowRun.createdAt).getTime() : Date.now();
      const updatedAt = workflowRun.updatedAt ? new Date(workflowRun.updatedAt).getTime() : Date.now();

      const runData = {
        runId: workflowRun.runId,
        workflowName: workflowRun.workflowName || 'unknown',
        resourceId: workflowRun.resourceId || '',
        snapshot: workflowRun.state || workflowRun.snapshot || {},
        status: status as WorkflowRunStatus,
        createdAt,
        updatedAt,
      };

      // Check if workflow run already exists
      const existingRun = await ctx.db
        .query('workflowRuns')
        .withIndex('by_runId', q => q.eq('runId', workflowRun.runId))
        .first();

      let savedRun;
      if (existingRun) {
        // Update existing run
        await ctx.db.patch(existingRun._id, {
          ...runData,
          updatedAt: Date.now(),
        });
        savedRun = {
          ...workflowRun,
          _id: existingRun._id,
          _creationTime: existingRun._creationTime,
        };
      } else {
        // Insert new run
        const id = await ctx.db.insert('workflowRuns', runData);
        savedRun = {
          ...workflowRun,
          _id: id,
        };
      }
      savedRuns.push(savedRun);
    }

    return {
      success: true,
      count: savedRuns.length,
      workflowRuns: savedRuns,
    };
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

    if (run) {
      // Use helper to convert database record to application model
      return convertDbToAppModel(run);
    }

    return null;
  },
});

/**
 * Get workflow runs by status
 */
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal('running'),
      v.literal('success'),
      v.literal('failed'),
      v.literal('suspended'),
      v.literal('waiting'),
      v.literal('pending'),
    ),
  },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query('workflowRuns')
      .withIndex('by_status', q => q.eq('status', args.status))
      .collect();

    // Convert database records to application model
    return runs.map(convertDbToAppModel);
  },
});

/**
 * Legacy function for backward compatibility
 */
export const getByStateType = query({
  args: { stateType: v.string() },
  handler: async (ctx, args) => {
    // Map old stateType to new status field
    const status = args.stateType as WorkflowRunStatus;

    const runs = await ctx.db
      .query('workflowRuns')
      .withIndex('by_status', q => q.eq('status', status))
      .collect();

    // Convert database records to application model
    return runs.map(convertDbToAppModel);
  },
});

/**
 * Update workflow runs
 */
export const update = mutation({
  args: {
    runs: v.array(
      v.object({
        runId: v.string(),
        resourceId: v.string(),
        workflowName: v.string(),
        snapshot: v.any(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { runs } = args;
    let updatedCount = 0;

    for (const run of runs) {
      // Find the run by ID
      const existingRun = await ctx.db
        .query('workflowRuns')
        .withIndex('by_runId', q => q.eq('runId', run.runId))
        .first();

      if (existingRun) {
        // Update run - ensure timestamp is a number (already using Date.now() which returns milliseconds)
        const updateData: Partial<Doc<'workflowRuns'>> = {
          updatedAt: Date.now(), // This already returns milliseconds as a number
        };

        // Handle state field mapping to snapshot
        if (run.snapshot !== undefined) {
          updateData.snapshot = run.snapshot;
        }

        // Handle any error in the snapshot
        if (run.snapshot?.error !== undefined) {
          // Store error in the snapshot if there's an existing snapshot
          if (existingRun.snapshot && typeof existingRun.snapshot === 'object') {
            updateData.snapshot = {
              ...(existingRun.snapshot as object),
              error: run.snapshot.error,
            };
          } else {
            // Create new snapshot with just the error
            updateData.snapshot = { error: run.snapshot.error };
          }
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
    status: v.optional(
      v.union(
        v.literal('running'),
        v.literal('success'),
        v.literal('failed'),
        v.literal('suspended'),
        v.literal('waiting'),
        v.literal('pending'),
      ),
    ),
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
      } else if (args.workflowName) {
        // Use the by_workflowName index when filtering by workflowName
        // We know workflowName is defined here because of the if condition
        const workflowName = args.workflowName;
        queryBuilder = ctx.db
          .query('workflowRuns')
          .withIndex('by_workflowName', q => q.eq('workflowName', workflowName));
      } else if (args.status) {
        // Use the by_status index when filtering by status
        // We know status is defined here because of the if condition
        const status = args.status;
        queryBuilder = ctx.db.query('workflowRuns').withIndex('by_status', q => q.eq('status', status));
      } else {
        // Otherwise use the default index
        queryBuilder = ctx.db.query('workflowRuns');
      }

      // Apply additional workflow name filter if needed and not already used in index
      if (args.workflowName && args.resourceId !== undefined) {
        queryBuilder = queryBuilder.filter(q => q.eq(q.field('workflowName'), args.workflowName));
      }

      // Apply additional status filter if needed and not already used in index
      if (args.status && (args.resourceId !== undefined || args.workflowName !== undefined)) {
        // We know status is defined here because of the if condition
        const status = args.status;
        queryBuilder = queryBuilder.filter(q => q.eq(q.field('status'), status));
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

    // Convert the results to application model with proper date handling
    const items = paginationResult.page.map(convertDbToAppModel);

    return {
      runs: items,
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.continueCursor,
      total: totalResults.length,
    };
  },
});

/**
 * Load workflow runs based on different key combinations
 * @param keys Object containing one of:
 *   - runId: string - Get a single workflow run by its ID
 *   - status: WorkflowRunStatus - Get runs by status
 *   - resourceId: string - Get runs for a specific resource
 *   - workflowName: string - Get runs for a specific workflow
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

    // Handle single workflow run by ID
    if (keys.runId && typeof keys.runId === 'string') {
      const run = await ctx.db
        .query('workflowRuns')
        .withIndex('by_runId', q => q.eq('runId', keys.runId))
        .first();

      return run ? convertDbToAppModel(run) : null;
    }

    // Handle workflow runs by status
    if (keys.status && typeof keys.status === 'string') {
      let query = ctx.db
        .query('workflowRuns')
        .withIndex('by_status', q => q.eq('status', keys.status))
        .order(sortOrder);

      // Apply additional filters
      if (keys.resourceId) {
        query = query.filter(q => q.eq(q.field('resourceId'), keys.resourceId));
      }
      if (keys.workflowName) {
        query = query.filter(q => q.eq(q.field('workflowName'), keys.workflowName));
      }

      if (keys.paginationOpts) {
        const paginatedResults = await query.paginate(keys.paginationOpts);
        const total = await query.collect().then(results => results.length);

        return {
          ...paginatedResults,
          page: paginatedResults.page.map(convertDbToAppModel),
          total,
          totalPages: Math.ceil(total / keys.paginationOpts.numItems),
        };
      }

      const runs = await query.collect();
      return {
        page: runs.map(convertDbToAppModel),
        isDone: true,
        continueCursor: null,
        total: runs.length,
        totalPages: 1,
      };
    }

    // Handle workflow runs by resourceId
    if (keys.resourceId && typeof keys.resourceId === 'string') {
      let query = ctx.db
        .query('workflowRuns')
        .withIndex('by_resourceId', q => q.eq('resourceId', keys.resourceId))
        .order(sortOrder);

      if (keys.workflowName) {
        query = query.filter(q => q.eq(q.field('workflowName'), keys.workflowName));
      }

      if (keys.paginationOpts) {
        const paginatedResults = await query.paginate(keys.paginationOpts);
        const total = await query.collect().then(results => results.length);

        return {
          ...paginatedResults,
          page: paginatedResults.page.map(convertDbToAppModel),
          total,
          totalPages: Math.ceil(total / keys.paginationOpts.numItems),
        };
      }

      const runs = await query.collect();
      return runs.map(convertDbToAppModel);
    }

    throw new Error('Must provide one of: runId, status, or resourceId in keys');
  },
});
