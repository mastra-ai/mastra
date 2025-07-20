import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

/**
 * Save an evaluation
 */
export const save = mutation({
  args: {
    evalData: v.object({
      input: v.string(),
      output: v.string(),
      result: v.any(),
      agentName: v.string(),
      createdAt: v.string(),
      metricName: v.string(),
      instructions: v.string(),
      runId: v.string(),
      globalRunId: v.string(),
      testInfo: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const { evalData } = args;

    const evalRecord = {
      input: evalData.input,
      output: evalData.output,
      result: evalData.result,
      agentName: evalData.agentName,
      createdAt: new Date(evalData.createdAt).getTime(),
      metricName: evalData.metricName,
      instructions: evalData.instructions,
      runId: evalData.runId,
      globalRunId: evalData.globalRunId,
      testInfo: evalData.testInfo,
    };

    // Check if evaluation already exists
    const existingEval = await ctx.db
      .query('evals')
      .withIndex('by_runId', q => q.eq('runId', evalData.runId))
      .first();

    if (existingEval) {
      // Update existing evaluation
      await ctx.db.patch(existingEval._id, evalRecord);
    } else {
      // Insert new evaluation
      await ctx.db.insert('evals', evalRecord);
    }

    return evalData;
  },
});

/**
 * Batch save multiple evaluations
 */
export const batchSave = mutation({
  args: {
    evals: v.array(
      v.object({
        input: v.string(),
        output: v.string(),
        result: v.any(),
        agentName: v.string(),
        createdAt: v.string(),
        metricName: v.string(),
        instructions: v.string(),
        runId: v.string(),
        globalRunId: v.string(),
        testInfo: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { evals } = args;

    for (const evalData of evals) {
      const evalRecord = {
        input: evalData.input,
        output: evalData.output,
        result: evalData.result,
        agentName: evalData.agentName,
        createdAt: new Date(evalData.createdAt).getTime(),
        metricName: evalData.metricName,
        instructions: evalData.instructions,
        runId: evalData.runId,
        globalRunId: evalData.globalRunId,
        testInfo: evalData.testInfo,
      };

      // Check if evaluation already exists
      const existingEval = await ctx.db
        .query('evals')
        .withIndex('by_runId', q => q.eq('runId', evalData.runId))
        .first();

      if (existingEval) {
        // Update existing evaluation
        await ctx.db.patch(existingEval._id, evalRecord);
      } else {
        // Insert new evaluation
        await ctx.db.insert('evals', evalRecord);
      }
    }

    return { success: true, count: evals.length };
  },
});

/**
 * Get an evaluation by ID
 */
export const get = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const evalRecord = await ctx.db
      .query('evals')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first();

    return evalRecord || null;
  },
});

/**
 * Get evaluations by thread ID
 */
export const getByGlobalRunId = query({
  args: { globalRunId: v.string() },
  handler: async (ctx, args) => {
    const evals = await ctx.db
      .query('evals')
      .withIndex('by_globalRunId', q => q.eq('globalRunId', args.globalRunId))
      .collect();

    return evals;
  },
});

/**
 * Get evaluations by agent name
 */
export const getByAgentName = query({
  args: {
    agentName: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('evals').withIndex('by_agentName', q => q.eq('agentName', args.agentName));

    // Apply type filter if provided
    if (args.type) {
      query = query.filter(q => q.eq(q.field('metricName'), args.type));
    }

    const evals = await query.collect();
    return evals;
  },
});

/**
 * Load an evaluation by different key combinations
 * @param keys Object containing one of:
 *   - runId: string - Get a single evaluation by runId
 *   - globalRunId: string - Get all evaluations for a global run
 *   - agentName: string - Get all evaluations for an agent (optionally filtered by type)
 *   - type?: string - Required when agentName is provided, filters by metricName
 */
export const load = query({
  args: {
    keys: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const { keys } = args;

    // Route based on provided keys
    if (keys.runId) {
      // Get single evaluation by runId
      return await ctx.db
        .query('evals')
        .withIndex('by_runId', q => q.eq('runId', keys.runId!))
        .first();
    }

    if (keys.globalRunId) {
      // Get all evaluations for a global run
      return await ctx.db
        .query('evals')
        .withIndex('by_globalRunId', q => q.eq('globalRunId', keys.globalRunId!))
        .collect();
    }

    if (keys.agentName) {
      // Get evaluations by agent name, optionally filtered by type
      let query = ctx.db.query('evals').withIndex('by_agentName', q => q.eq('agentName', keys.agentName!));

      if (keys.type) {
        query = query.filter(q => q.eq(q.field('metricName'), keys.type));
      }

      return await query.collect();
    }

    throw new Error('Must provide one of: runId, globalRunId, or agentName');
  },
});
