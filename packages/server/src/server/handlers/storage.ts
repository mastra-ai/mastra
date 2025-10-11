import type { MastraStorage } from '@mastra/core/storage';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_AI_SPANS,
  type TABLE_NAMES,
} from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';

interface StorageContext extends Context {
  tableName?: TABLE_NAMES;
}

// Get list of all available tables (excluding mastra_traces)
export async function getTablesHandler({ mastra }: Pick<StorageContext, 'mastra'>) {
  try {
    const storage = mastra.getStorage();

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    const tables = [
      { name: TABLE_WORKFLOW_SNAPSHOT, label: 'Workflow Snapshots' },
      { name: TABLE_EVALS, label: 'Evaluations' },
      { name: TABLE_MESSAGES, label: 'Messages' },
      { name: TABLE_THREADS, label: 'Threads' },
      { name: TABLE_SCORERS, label: 'Scorers' },
      { name: TABLE_AI_SPANS, label: 'AI Spans' },
    ];

    // Only include resources table if supported
    if (storage.supports.resourceWorkingMemory) {
      tables.push({ name: TABLE_RESOURCES, label: 'Resources' });
    }

    return { tables };
  } catch (error) {
    return handleError(error, 'Error getting tables');
  }
}

// Get data from a specific table with pagination
export async function getTableDataHandler({
  mastra,
  tableName,
  page = 0,
  perPage = 50,
  search,
}: Pick<StorageContext, 'mastra' | 'tableName'> & {
  page?: number;
  perPage?: number;
  search?: string;
}) {
  try {
    const storage = mastra.getStorage() as any;

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    if (!tableName) {
      throw new HTTPException(400, { message: 'Table name is required' });
    }

    // Validate table name - exclude mastra_traces
    const validTables = [
      TABLE_WORKFLOW_SNAPSHOT,
      TABLE_EVALS,
      TABLE_MESSAGES,
      TABLE_THREADS,
      TABLE_RESOURCES,
      TABLE_SCORERS,
      TABLE_AI_SPANS,
    ];

    if (!validTables.includes(tableName as any)) {
      throw new HTTPException(400, { message: 'Invalid table name' });
    }

    let data: any[] = [];
    let totalCount = 0;

    // Use the storage adapter's underlying database connection if available
    // This is a best-effort approach that works with common storage adapters
    if (storage.db || storage.client || storage.connection) {
      const db = storage.db || storage.client || storage.connection;
      
      // Try to use common query patterns
      try {
        // For SQL-based storage (PostgreSQL, LibSQL, etc.)
        if (typeof db.execute === 'function' || typeof db.query === 'function') {
          const offset = page * perPage;
          const queryFn = db.execute || db.query;
          
          // Build query
          let query = `SELECT * FROM ${tableName}`;
          let countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
          
          if (search) {
            // Simple search across all text columns - this is a basic implementation
            query += ` WHERE CAST(* AS TEXT) LIKE '%${search}%'`;
            countQuery += ` WHERE CAST(* AS TEXT) LIKE '%${search}%'`;
          }
          
          query += ` LIMIT ${perPage} OFFSET ${offset}`;
          
          // Execute queries
          const result = await queryFn.call(db, query);
          const countResult = await queryFn.call(db, countQuery);
          
          data = result.rows || result || [];
          totalCount = countResult.rows?.[0]?.count || countResult?.[0]?.count || 0;
        }
      } catch (dbError) {
        console.error('Database query failed:', dbError);
        // Fall through to return empty results with message
      }
    }

    return {
      data,
      pagination: {
        page,
        perPage,
        totalCount,
        totalPages: Math.ceil(totalCount / perPage),
      },
      message: data.length === 0 ? 'No data available. Direct table querying may not be supported by this storage adapter.' : undefined,
    };
  } catch (error) {
    return handleError(error, 'Error getting table data');
  }
}

// Get a single record by keys
export async function getRecordHandler({
  mastra,
  tableName,
  keys,
}: Pick<StorageContext, 'mastra' | 'tableName'> & {
  keys: Record<string, any>;
}) {
  try {
    const storage = mastra.getStorage();

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    if (!tableName || !keys) {
      throw new HTTPException(400, { message: 'Table name and keys are required' });
    }

    const record = await storage.load({ tableName, keys });

    if (!record) {
      throw new HTTPException(404, { message: 'Record not found' });
    }

    return { record };
  } catch (error) {
    return handleError(error, 'Error getting record');
  }
}

// Update a record
export async function updateRecordHandler({
  mastra,
  tableName,
  record,
}: Pick<StorageContext, 'mastra' | 'tableName'> & {
  record: Record<string, any>;
}) {
  try {
    const storage = mastra.getStorage();

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    if (!tableName || !record) {
      throw new HTTPException(400, { message: 'Table name and record are required' });
    }

    // Validate table name - exclude mastra_traces
    const validTables = [
      TABLE_WORKFLOW_SNAPSHOT,
      TABLE_EVALS,
      TABLE_MESSAGES,
      TABLE_THREADS,
      TABLE_RESOURCES,
      TABLE_SCORERS,
      TABLE_AI_SPANS,
    ];

    if (!validTables.includes(tableName as any)) {
      throw new HTTPException(400, { message: 'Invalid table name' });
    }

    // Use storage adapter's insert method (which typically upserts)
    await storage.insert({ tableName, record });

    return { success: true, message: 'Record updated successfully' };
  } catch (error) {
    return handleError(error, 'Error updating record');
  }
}

// Delete a record (only for tables that support deletion)
export async function deleteRecordHandler({
  mastra,
  tableName,
  keys,
}: Pick<StorageContext, 'mastra' | 'tableName'> & {
  keys: Record<string, any>;
}) {
  try {
    const storage = mastra.getStorage();

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    if (!tableName || !keys) {
      throw new HTTPException(400, { message: 'Table name and keys are required' });
    }

    // Only allow deletion for specific tables
    if (tableName === TABLE_THREADS) {
      await storage.deleteThread({ threadId: keys.id });
    } else if (tableName === TABLE_MESSAGES && storage.supports.deleteMessages) {
      await storage.deleteMessages([keys.id]);
    } else {
      throw new HTTPException(400, {
        message: 'Deletion not supported for this table',
      });
    }

    return { success: true, message: 'Record deleted successfully' };
  } catch (error) {
    return handleError(error, 'Error deleting record');
  }
}

// Query table with flexible filtering
export async function queryTableHandler({
  mastra,
  tableName,
  query,
  page = 0,
  perPage = 50,
}: Pick<StorageContext, 'mastra' | 'tableName'> & {
  query?: Record<string, any>;
  page?: number;
  perPage?: number;
}) {
  try {
    const storage = mastra.getStorage() as any;

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    if (!tableName) {
      throw new HTTPException(400, { message: 'Table name is required' });
    }

    // This is a generic query interface that storage adapters should implement
    // For now, we'll return an empty result set with a message
    return {
      data: [],
      pagination: {
        page,
        perPage,
        totalCount: 0,
        totalPages: 0,
      },
      message: 'Generic table querying coming soon - use specialized endpoints for now',
    };
  } catch (error) {
    return handleError(error, 'Error querying table');
  }
}
