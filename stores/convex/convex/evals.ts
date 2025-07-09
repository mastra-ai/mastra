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
      evalId: evalData.id,
      threadId: evalData.threadId,
      agentName: evalData.agentName,
      type: evalData.type || 'live', // Default to live
      metadata: evalData.metadata || {},
      data: evalData.data || {},
      createdAt: evalData.createdAt || Date.now(),
    };

    // Check if evaluation already exists
    const existingEval = await ctx.db
      .query('evals')
      .withIndex('by_evalId', q => q.eq('evalId', evalData.id))
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
  args: { evalId: v.string() },
  handler: async (ctx, args) => {
    const evalRecord = await ctx.db
      .query('evals')
      .withIndex('by_evalId', q => q.eq('evalId', args.evalId))
      .first();

    return evalRecord || null;
  },
});

/**
 * Get evaluations by thread ID
 */
export const getByThreadId = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const evals = await ctx.db
      .query('evals')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
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
      query = query.filter(q => q.eq(q.field('type'), args.type));
    }

    const evals = await query.collect();
    return evals;
  },
});
