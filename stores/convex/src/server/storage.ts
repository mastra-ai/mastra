import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { GenericMutationCtx as MutationCtx } from 'convex/server';
import { mutationGeneric } from 'convex/server';

import type { StorageRequest, StorageResponse } from '../storage/types';

// Vector-specific table names (not in @mastra/core)
const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
const VECTOR_TABLE_PREFIX = 'mastra_vector_';

/**
 * Determines which Convex table to use based on the logical table name.
 * Returns the Convex table name and whether it's a typed table or fallback.
 */
function resolveTable(tableName: string): { convexTable: string; isTyped: boolean } {
  switch (tableName) {
    case TABLE_THREADS:
      return { convexTable: 'mastra_threads', isTyped: true };
    case TABLE_MESSAGES:
      return { convexTable: 'mastra_messages', isTyped: true };
    case TABLE_RESOURCES:
      return { convexTable: 'mastra_resources', isTyped: true };
    case TABLE_WORKFLOW_SNAPSHOT:
      return { convexTable: 'mastra_workflow_snapshots', isTyped: true };
    case TABLE_SCORERS:
      return { convexTable: 'mastra_scorers', isTyped: true };
    case TABLE_VECTOR_INDEXES:
      return { convexTable: 'mastra_vector_indexes', isTyped: true };
    default:
      // Check if it's a vector data table
      if (tableName.startsWith(VECTOR_TABLE_PREFIX)) {
        return { convexTable: 'mastra_vectors', isTyped: true };
      }
      // Fallback to generic documents table for unknown tables
      return { convexTable: 'mastra_documents', isTyped: false };
  }
}

/**
 * Main storage mutation handler.
 * Routes operations to the appropriate typed table.
 */
export const mastraStorage = mutationGeneric(async (ctx, request: StorageRequest): Promise<StorageResponse> => {
  try {
    const { convexTable, isTyped } = resolveTable(request.tableName);

    // Handle vector data tables specially (but NOT vector_indexes which is a typed table)
    if (request.tableName.startsWith(VECTOR_TABLE_PREFIX) && request.tableName !== TABLE_VECTOR_INDEXES) {
      return handleVectorOperation(ctx, request);
    }

    // Handle typed tables
    if (isTyped) {
      return handleTypedOperation(ctx, convexTable, request);
    }

    // Fallback to generic table for unknown tables
    return handleGenericOperation(ctx, request);
  } catch (error) {
    const err = error as Error;
    return {
      ok: false,
      error: err.message,
    };
  }
});

/**
 * Handle operations on typed tables (threads, messages, etc.)
 * Records are stored with their `id` field as a regular field (not _id).
 * We query by the `id` field to find/update records.
 */
async function handleTypedOperation(
  ctx: MutationCtx<any>,
  convexTable: string,
  request: StorageRequest,
): Promise<StorageResponse> {
  switch (request.op) {
    case 'insert': {
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Record is missing an id`);
      }

      // Find existing record by id field using index
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', id))
        .unique();

      if (existing) {
        // Update existing - don't include id in patch (it's already set)
        const { id: _, ...updateData } = record;
        await ctx.db.patch(existing._id, updateData);
      } else {
        // Insert new - include id as a regular field
        await ctx.db.insert(convexTable, record);
      }
      return { ok: true };
    }

    case 'batchInsert': {
      for (const record of request.records) {
        const id = record.id;
        if (!id) continue;

        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique();

        if (existing) {
          const { id: _, ...updateData } = record;
          await ctx.db.patch(existing._id, updateData);
        } else {
          await ctx.db.insert(convexTable, record);
        }
      }
      return { ok: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        // Find by id field using index
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', keys.id))
          .unique();
        return { ok: true, result: doc || null };
      }

      // Query by other fields - use take() to avoid 32k limit
      const docs = await ctx.db.query(convexTable).take(10000);
      const match = docs.find((doc: any) => Object.entries(keys).every(([key, value]) => doc[key] === value));
      return { ok: true, result: match || null };
    }

    case 'queryTable': {
      // Use take() to avoid hitting Convex's 32k document limit
      const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
      let docs = await ctx.db.query(convexTable).take(maxDocs);

      // Apply filters if provided
      if (request.filters && request.filters.length > 0) {
        docs = docs.filter((doc: any) => request.filters!.every(filter => doc[filter.field] === filter.value));
      }

      // Apply limit if provided
      if (request.limit) {
        docs = docs.slice(0, request.limit);
      }

      return { ok: true, result: docs };
    }

    case 'clearTable':
    case 'dropTable': {
      // Delete a small batch per call to stay within Convex's 1-second mutation timeout.
      // Client must call repeatedly until hasMore is false.
      const BATCH_SIZE = 25;
      const docs = await ctx.db.query(convexTable).take(BATCH_SIZE + 1);
      const hasMore = docs.length > BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, BATCH_SIZE) : docs;

      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      for (const id of request.ids) {
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique();
        if (doc) {
          await ctx.db.delete(doc._id);
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${(request as any).op}` };
  }
}

/**
 * Handle operations on the vectors table.
 * Vectors are stored with indexName to support multiple indexes.
 */
async function handleVectorOperation(ctx: MutationCtx<any>, request: StorageRequest): Promise<StorageResponse> {
  // Extract the index name from the table name (e.g., "mastra_vector_myindex" -> "myindex")
  const indexName = request.tableName.replace(VECTOR_TABLE_PREFIX, '');
  const convexTable = 'mastra_vectors';

  switch (request.op) {
    case 'insert': {
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Vector record is missing an id`);
      }

      // Find existing by composite key (indexName, id) to scope per index
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          embedding: record.embedding,
          metadata: record.metadata,
        });
      } else {
        await ctx.db.insert(convexTable, {
          id,
          indexName,
          embedding: record.embedding,
          metadata: record.metadata,
        });
      }
      return { ok: true };
    }

    case 'batchInsert': {
      for (const record of request.records) {
        const id = record.id;
        if (!id) continue;

        // Find existing by composite key (indexName, id) to scope per index
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            embedding: record.embedding,
            metadata: record.metadata,
          });
        } else {
          await ctx.db.insert(convexTable, {
            id,
            indexName,
            embedding: record.embedding,
            metadata: record.metadata,
          });
        }
      }
      return { ok: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        // Use composite key (indexName, id) to scope lookup per index
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', keys.id))
          .unique();
        return { ok: true, result: doc || null };
      }
      return { ok: true, result: null };
    }

    case 'queryTable': {
      // Use take() to avoid hitting Convex's 32k document limit
      const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
      let docs = await ctx.db
        .query(convexTable)
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(maxDocs);

      // Apply filters if provided
      if (request.filters && request.filters.length > 0) {
        docs = docs.filter((doc: any) => request.filters!.every(filter => doc[filter.field] === filter.value));
      }

      // Apply limit if provided
      if (request.limit) {
        docs = docs.slice(0, request.limit);
      }

      return { ok: true, result: docs };
    }

    case 'clearTable':
    case 'dropTable': {
      // Delete a small batch per call to stay within Convex's 1-second mutation timeout.
      // Client must call repeatedly until hasMore is false.
      const BATCH_SIZE = 25;
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(BATCH_SIZE + 1);
      const hasMore = docs.length > BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, BATCH_SIZE) : docs;

      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      for (const id of request.ids) {
        // Use composite key (indexName, id) to scope deletion per index
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique();
        if (doc) {
          await ctx.db.delete(doc._id);
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${(request as any).op}` };
  }
}

/**
 * Handle operations on the generic documents table.
 * Used as fallback for unknown table names.
 */
async function handleGenericOperation(ctx: MutationCtx<any>, request: StorageRequest): Promise<StorageResponse> {
  const tableName = request.tableName;
  const convexTable = 'mastra_documents';

  switch (request.op) {
    case 'insert': {
      const record = request.record;
      if (!record.id) {
        throw new Error(`Record for table ${tableName} is missing an id`);
      }
      const primaryKey = String(record.id);

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', primaryKey))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { record });
      } else {
        await ctx.db.insert(convexTable, {
          table: tableName,
          primaryKey,
          record,
        });
      }
      return { ok: true };
    }

    case 'batchInsert': {
      for (const record of request.records) {
        if (!record.id) continue;
        const primaryKey = String(record.id);

        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', primaryKey))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, { record });
        } else {
          await ctx.db.insert(convexTable, {
            table: tableName,
            primaryKey,
            record,
          });
        }
      }
      return { ok: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(keys.id)))
          .unique();
        return { ok: true, result: existing ? existing.record : null };
      }

      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(10000);
      const match = docs.find((doc: any) => Object.entries(keys).every(([key, value]) => doc.record?.[key] === value));
      return { ok: true, result: match ? match.record : null };
    }

    case 'queryTable': {
      // Use take() to avoid hitting Convex's 32k document limit
      const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(maxDocs);

      let records = docs.map((doc: any) => doc.record);

      if (request.filters && request.filters.length > 0) {
        records = records.filter((record: any) =>
          request.filters!.every(filter => record?.[filter.field] === filter.value),
        );
      }

      if (request.limit) {
        records = records.slice(0, request.limit);
      }

      return { ok: true, result: records };
    }

    case 'clearTable':
    case 'dropTable': {
      // Delete a small batch per call to stay within Convex's 1-second mutation timeout.
      // Client must call repeatedly until hasMore is false.
      const BATCH_SIZE = 25;
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(BATCH_SIZE + 1);
      const hasMore = docs.length > BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, BATCH_SIZE) : docs;

      for (const doc of docsToDelete) {
        await ctx.db.delete(doc._id);
      }
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      for (const id of request.ids) {
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(id)))
          .unique();
        if (existing) {
          await ctx.db.delete(existing._id);
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${(request as any).op}` };
  }
}
