import type { GenericMutationCtx as MutationCtx } from 'convex/server';
import { mutationGeneric } from 'convex/server';

import type { StorageRequest, StorageResponse } from '../storage/types';

const TABLE_NAME = 'mastra_documents';

export const mastraStorage = mutationGeneric(async (ctx, request: StorageRequest): Promise<StorageResponse> => {
  try {
    switch (request.op) {
      case 'insert':
        await upsertRecord(ctx, request.tableName, request.record);
        return { ok: true };
      case 'batchInsert':
        for (const record of request.records) {
          await upsertRecord(ctx, request.tableName, record);
        }
        return { ok: true };
      case 'load': {
        const record = await loadRecord(ctx, request.tableName, request.keys);
        return { ok: true, result: record };
      }
      case 'clearTable':
      case 'dropTable': {
        await deleteByTable(ctx, request.tableName);
        return { ok: true };
      }
      case 'queryTable': {
        const records = await queryTable(ctx, request.tableName, request.filters);
        const limited = request.limit ? records.slice(0, request.limit) : records;
        return { ok: true, result: limited };
      }
      case 'deleteMany':
        await deleteMany(ctx, request.tableName, request.ids);
        return { ok: true };
      default:
        return { ok: false, error: `Unsupported operation ${(request as any).op}` };
    }
  } catch (error) {
    const err = error as Error;
    return {
      ok: false,
      error: err.message,
    };
  }
});

async function upsertRecord(ctx: MutationCtx, tableName: string, record: Record<string, any>) {
  if (!record.id) {
    throw new Error(`Record for table ${tableName} is missing an id`);
  }
  const primaryKey = String(record.id);
  const existing = await ctx.db
    .query(TABLE_NAME)
    .withIndex('by_table_primary', q => q.eq('table', tableName).eq('primaryKey', primaryKey))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { record });
  } else {
    await ctx.db.insert(TABLE_NAME, {
      table: tableName,
      primaryKey,
      record,
    });
  }
}

async function loadRecord(ctx: MutationCtx, tableName: string, keys: Record<string, any>) {
  if (keys.id) {
    const existing = await ctx.db
      .query(TABLE_NAME)
      .withIndex('by_table_primary', q => q.eq('table', tableName).eq('primaryKey', String(keys.id)))
      .unique();
    return existing ? existing.record : null;
  }

  const records = await queryTable(ctx, tableName);
  return records.find(record => matches(record, keys)) ?? null;
}

async function deleteByTable(ctx: MutationCtx, tableName: string) {
  const docs = await ctx.db
    .query(TABLE_NAME)
    .withIndex('by_table', q => q.eq('table', tableName))
    .collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

async function queryTable(ctx: MutationCtx, tableName: string, filters?: { field: string; value: any }[]) {
  const docs = await ctx.db
    .query(TABLE_NAME)
    .withIndex('by_table', q => q.eq('table', tableName))
    .collect();
  if (!filters || filters.length === 0) {
    return docs.map(doc => doc.record);
  }

  return docs.map(doc => doc.record).filter(record => filters.every(filter => record?.[filter.field] === filter.value));
}

async function deleteMany(ctx: MutationCtx, tableName: string, ids: string[]) {
  for (const id of ids) {
    const existing = await ctx.db
      .query(TABLE_NAME)
      .withIndex('by_table_primary', q => q.eq('table', tableName).eq('primaryKey', String(id)))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  }
}

function matches(record: Record<string, any>, keys: Record<string, any>) {
  return Object.entries(keys).every(([key, value]) => record?.[key] === value);
}
