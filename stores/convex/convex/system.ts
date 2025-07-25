import { v } from 'convex/values';
import type { DataModel } from './_generated/dataModel';
import { query, mutation } from './_generated/server';

/**
 * Clear all tables
 */
export const clearAllTables = mutation({
  args: {},
  handler: async ctx => {
    // This is a no-op in Convex as we can't dynamically drop tables
    // Schemas are managed via schema.ts and deployed with the app

    // For testing purposes only - clear all data from tables
    const clearTable = async <T extends keyof DataModel>(tableName: T) => {
      try {
        const items = await ctx.db.query(tableName).collect();
        // Delete all items in parallel
        await Promise.all(items.map(item => ctx.db.delete(item._id)));
        return { tableName, success: true, count: items.length };
      } catch (error) {
        console.error(`Error deleting ${tableName}:`, error);
        return { tableName, success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    // Clear all tables in parallel
    const results = await Promise.allSettled([
      clearTable('threads'),
      clearTable('messages'),
      clearTable('traces'),
      clearTable('evals'),
      clearTable('workflowRuns'),
    ]);

    // Log summary of operations
    const summary = results
      .map(result =>
        result.status === 'fulfilled'
          ? `${result.value.tableName}: ${result.value.success ? `cleared ${result.value.count} items` : 'failed'}`
          : 'Unknown error',
      )
      .join('\n');

    console.log('Clear tables summary:\n' + summary);
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
        { name: 'role', type: 'STRING' },
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
      const validTables = ['threads', 'messages', 'traces', 'evals', 'workflowRuns'] as const;
      type ValidTableName = (typeof validTables)[number];

      if (!validTables.includes(tableName as ValidTableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
      }

      const records = await ctx.db.query(tableName as ValidTableName).collect();

      for (const record of records) {
        await ctx.db.delete(record._id);
      }

      return { success: true, count: records.length };
    } catch (error: unknown) {
      console.error(`Error clearing table ${tableName}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },
});
