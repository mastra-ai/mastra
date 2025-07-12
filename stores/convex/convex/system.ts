import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

/**
 * Drop all tables and recreate schema
 */
export const dropAllTables = mutation({
  args: {},
  handler: async ctx => {
    // This is a no-op in Convex as we can't dynamically drop tables
    // Schemas are managed via schema.ts and deployed with the app

    // For testing purposes only - clear all data from tables
    try {
      // Get all threads and delete them
      const threads = await ctx.db.query('threads').collect();
      for (const thread of threads) {
        await ctx.db.delete(thread._id);
      }
    } catch (error) {
      console.error('Error deleting threads:', error);
    }

    try {
      // Get all messages and delete them
      const messages = await ctx.db.query('messages').collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
    }

    try {
      // Get all traces and delete them
      const traces = await ctx.db.query('traces').collect();
      for (const trace of traces) {
        await ctx.db.delete(trace._id);
      }
    } catch (error) {
      console.error('Error deleting traces:', error);
    }

    try {
      // Get all evals and delete them
      const evals = await ctx.db.query('evals').collect();
      for (const evalRecord of evals) {
        await ctx.db.delete(evalRecord._id);
      }
    } catch (error) {
      console.error('Error deleting evals:', error);
    }

    try {
      // Get all workflow runs and delete them
      const runs = await ctx.db.query('workflowRuns').collect();
      for (const run of runs) {
        await ctx.db.delete(run._id);
      }
    } catch (error) {
      console.error('Error deleting workflow runs:', error);
    }
  },
});

/**
 * Ensure tables are created (no-op in Convex)
 */
export const ensureTables = mutation({
  args: {},
  handler: async () => {
    // This is a no-op in Convex as tables are defined in schema.ts
    // Convex automatically ensures tables exist based on schema definition
    // This function exists for API compatibility with other storage backends
    return;
  },
});

/**
 * Get table columns for a table
 */
export const getTableColumns = query({
  args: {
    tableName: v.string(),
  },
  handler: async (ctx, args) => {
    // In Convex, schema information isn't directly accessible at runtime
    // We'll return a predefined schema based on the table name for compatibility

    const { tableName } = args;

    // Map of table schemas for Mastra compatibility
    const tableSchemas: Record<string, any[]> = {
      threads: [
        { name: 'threadId', type: 'STRING', primaryKey: true },
        { name: 'resourceId', type: 'STRING' },
        { name: 'title', type: 'STRING' },
        { name: 'metadata', type: 'JSON' },
        { name: 'createdAt', type: 'NUMBER' },
        { name: 'updatedAt', type: 'NUMBER' },
      ],
      messages: [
        { name: 'messageId', type: 'STRING', primaryKey: true },
        { name: 'threadId', type: 'STRING' },
        { name: 'messageType', type: 'STRING' },
        { name: 'content', type: 'JSON' },
        { name: 'createdAt', type: 'NUMBER' },
      ],
      traces: [
        { name: 'traceId', type: 'STRING', primaryKey: true },
        { name: 'threadId', type: 'STRING' },
        { name: 'transportId', type: 'STRING' },
        { name: 'runId', type: 'STRING' },
        { name: 'rootRunId', type: 'STRING' },
        { name: 'timestamp', type: 'NUMBER' },
        { name: 'properties', type: 'JSON' },
        { name: 'spans', type: 'JSON' },
        { name: 'spanDurations', type: 'JSON' },
      ],
      evals: [
        { name: 'evalId', type: 'STRING', primaryKey: true },
        { name: 'threadId', type: 'STRING' },
        { name: 'agentName', type: 'STRING' },
        { name: 'type', type: 'STRING' },
        { name: 'metadata', type: 'JSON' },
        { name: 'data', type: 'JSON' },
        { name: 'createdAt', type: 'NUMBER' },
      ],
      workflowRuns: [
        { name: 'runId', type: 'STRING', primaryKey: true },
        { name: 'workflowName', type: 'STRING' },
        { name: 'resourceId', type: 'STRING' },
        { name: 'stateType', type: 'STRING' },
        { name: 'state', type: 'JSON' },
        { name: 'error', type: 'JSON' },
        { name: 'createdAt', type: 'NUMBER' },
        { name: 'updatedAt', type: 'NUMBER' },
        { name: 'completedAt', type: 'NUMBER' },
      ],
    };

    return tableSchemas[tableName] || null;
  },
});

export const clearTable = mutation({
  args: {
    tableName: v.string(),
  },
  handler: async (ctx, args) => {
    const { tableName } = args;

    try {
      // This assumes the table name provided is valid in the database schema
      const records = await ctx.db.query(tableName as any).collect();

      // Delete each record from the table
      for (const record of records) {
        await ctx.db.delete(record._id);
      }

      return { success: true, count: records.length };
    } catch (error: unknown) {
      console.error(`Error clearing table ${tableName}:`, error);
      // Handle error.message safely with type checking
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },
});
