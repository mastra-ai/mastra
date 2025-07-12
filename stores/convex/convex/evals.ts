import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

/**
 * Save an evaluation
 */
export const save = mutation({
  args: { evalData: v.any() },
  handler: async (ctx, args) => {
    const { evalData } = args;

    const evalRecord = {
      input: evalData.input,
      output: evalData.output,
      result: evalData.result,
      agentName: evalData.agentName,
      createdAt: evalData.createdAt,
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
