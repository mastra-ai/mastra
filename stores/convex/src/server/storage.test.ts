import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage/constants';
import type { GenericId } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';

import type { StorageRequest, StorageResponse } from '../storage/types';
import { handleTypedOperation, mastraStorage } from './storage';

type TypedOperationCtx = Parameters<typeof handleTypedOperation>[0];
type StorageHandlerForTest = typeof mastraStorage & {
  _handler: (ctx: TypedOperationCtx, request: StorageRequest) => Promise<StorageResponse>;
};
type TestDoc = { _id: GenericId<string>; id?: string };
type TestQueryBuilder = {
  eq: (field: string, value: string) => TestQueryBuilder;
};

const asConvexId = (id: string) => id as GenericId<string>;

describe('mastraStorage typed load', () => {
  it('uses by_workflow_run for workflow snapshot composite keys', async () => {
    const workflowRun = {
      _id: asConvexId('snapshot-doc'),
      workflow_name: 'workflow-a',
      run_id: 'run-1',
      snapshot: {},
    };

    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const unique = vi.fn(async () => workflowRun);
    const take = vi.fn(async () => {
      throw new Error('load should not scan workflow snapshots for composite keys');
    });
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { unique, take };
    });
    const query = vi.fn(() => ({ withIndex, take }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_workflow_snapshots', {
      op: 'load',
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: 'workflow-a', run_id: 'run-1' },
    });

    expect(result).toEqual({ ok: true, result: workflowRun });
    expect(query).toHaveBeenCalledWith('mastra_workflow_snapshots');
    expect(withIndex).toHaveBeenCalledWith('by_workflow_run', expect.any(Function));
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'workflow_name', 'workflow-a');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'run_id', 'run-1');
    expect(unique).toHaveBeenCalledTimes(1);
    expect(take).not.toHaveBeenCalled();
  });
});

describe('mastraStorage bulk mutations', () => {
  const waitForConcurrency = () => new Promise(resolve => setTimeout(resolve, 1));

  function createIndexedDeleteCtx(docsByLookupKey: Map<string, TestDoc>) {
    const lookupKeys: string[] = [];
    const deletedIds: GenericId<string>[] = [];
    let activeLookups = 0;
    let maxConcurrentLookups = 0;
    let activeDeletes = 0;
    let maxConcurrentDeletes = 0;

    const query = vi.fn((_table: string) => ({
      withIndex: vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
        const eqValues: string[] = [];
        const builder: TestQueryBuilder = {
          eq: vi.fn((_field: string, value: string) => {
            eqValues.push(String(value));
            return builder;
          }),
        };
        queryBuilder(builder);

        const lookupKey = eqValues.join('|');
        lookupKeys.push(lookupKey);

        return {
          unique: vi.fn(async () => {
            activeLookups += 1;
            maxConcurrentLookups = Math.max(maxConcurrentLookups, activeLookups);
            await waitForConcurrency();
            activeLookups -= 1;
            return docsByLookupKey.get(lookupKey) ?? null;
          }),
        };
      }),
    }));
    const deleteDoc = vi.fn(async (id: GenericId<string>) => {
      activeDeletes += 1;
      maxConcurrentDeletes = Math.max(maxConcurrentDeletes, activeDeletes);
      await waitForConcurrency();
      activeDeletes -= 1;
      deletedIds.push(id);
    });
    const ctx = { db: { query, delete: deleteDoc } } as unknown as TypedOperationCtx;

    return {
      ctx,
      lookupKeys,
      deletedIds,
      query,
      deleteDoc,
      get maxConcurrentLookups() {
        return maxConcurrentLookups;
      },
      get maxConcurrentDeletes() {
        return maxConcurrentDeletes;
      },
    };
  }

  function createClearTableCtx(docs: TestDoc[]) {
    const deletedIds: GenericId<string>[] = [];
    const indexCalls: Array<{ table: string; indexName?: string; eqValues: string[] }> = [];
    let activeDeletes = 0;
    let maxConcurrentDeletes = 0;

    const take = vi.fn(async () => docs);
    const query = vi.fn((table: string) => ({
      take,
      withIndex: vi.fn((indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
        const eqValues: string[] = [];
        const builder: TestQueryBuilder = {
          eq: vi.fn((_field: string, value: string) => {
            eqValues.push(String(value));
            return builder;
          }),
        };
        queryBuilder(builder);
        indexCalls.push({ table, indexName, eqValues });
        return { take };
      }),
    }));
    const deleteDoc = vi.fn(async (id: GenericId<string>) => {
      activeDeletes += 1;
      maxConcurrentDeletes = Math.max(maxConcurrentDeletes, activeDeletes);
      await waitForConcurrency();
      activeDeletes -= 1;
      deletedIds.push(id);
    });
    const ctx = { db: { query, delete: deleteDoc } } as unknown as TypedOperationCtx;

    return {
      ctx,
      indexCalls,
      deletedIds,
      take,
      get maxConcurrentDeletes() {
        return maxConcurrentDeletes;
      },
    };
  }

  function createBatchInsertCtx(existingDocsByLookupKey: Map<string, TestDoc>) {
    const lookupKeys: string[] = [];
    const patches: Array<{ id: GenericId<string>; data: Record<string, unknown> }> = [];
    const inserts: Array<{ table: string; record: Record<string, unknown> }> = [];
    let activeLookups = 0;
    let maxConcurrentLookups = 0;
    let activeWrites = 0;
    let maxConcurrentWrites = 0;

    const query = vi.fn((_table: string) => ({
      withIndex: vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
        const eqValues: string[] = [];
        const builder: TestQueryBuilder = {
          eq: vi.fn((_field: string, value: string) => {
            eqValues.push(String(value));
            return builder;
          }),
        };
        queryBuilder(builder);

        const lookupKey = eqValues.join('|');
        lookupKeys.push(lookupKey);

        return {
          unique: vi.fn(async () => {
            activeLookups += 1;
            maxConcurrentLookups = Math.max(maxConcurrentLookups, activeLookups);
            await waitForConcurrency();
            activeLookups -= 1;
            return existingDocsByLookupKey.get(lookupKey) ?? null;
          }),
        };
      }),
    }));
    const patch = vi.fn(async (id: GenericId<string>, data: Record<string, unknown>) => {
      activeWrites += 1;
      maxConcurrentWrites = Math.max(maxConcurrentWrites, activeWrites);
      await waitForConcurrency();
      activeWrites -= 1;
      patches.push({ id, data });
    });
    const insert = vi.fn(async (table: string, record: Record<string, unknown>) => {
      activeWrites += 1;
      maxConcurrentWrites = Math.max(maxConcurrentWrites, activeWrites);
      await waitForConcurrency();
      activeWrites -= 1;
      inserts.push({ table, record });
    });
    const ctx = { db: { query, patch, insert } } as unknown as TypedOperationCtx;

    return {
      ctx,
      lookupKeys,
      patches,
      inserts,
      get maxConcurrentLookups() {
        return maxConcurrentLookups;
      },
      get maxConcurrentWrites() {
        return maxConcurrentWrites;
      },
    };
  }

  it('typed batchInsert coalesces duplicate records while preserving patch merge semantics', async () => {
    const batchCtx = createBatchInsertCtx(new Map([['existing', { _id: asConvexId('doc-existing') }]]));

    const result = await handleTypedOperation(batchCtx.ctx, 'mastra_threads', {
      op: 'batchInsert',
      tableName: 'mastra_threads',
      records: [
        { id: 'existing', title: 'first' },
        { id: 'new', title: 'new-first' },
        { title: 'missing-id' },
        { id: 'existing', metadata: { keep: true } },
        { id: 'new', metadata: { latest: true } },
      ],
    });

    expect(result).toEqual({ ok: true });
    expect(batchCtx.lookupKeys).toEqual(['existing', 'new']);
    expect(batchCtx.patches).toEqual([
      {
        id: asConvexId('doc-existing'),
        data: { title: 'first', metadata: { keep: true } },
      },
    ]);
    expect(batchCtx.inserts).toEqual([
      {
        table: 'mastra_threads',
        record: { id: 'new', title: 'new-first', metadata: { latest: true } },
      },
    ]);
    expect(batchCtx.maxConcurrentLookups).toBe(2);
    expect(batchCtx.maxConcurrentWrites).toBe(2);
  });

  it('typed batchInsert caps lookup and write concurrency to the storage mutation batch size', async () => {
    const batchCtx = createBatchInsertCtx(
      new Map(
        Array.from({ length: 30 }, (_, index) => [
          `id-${index}`,
          { _id: asConvexId(`doc-${index}`), id: `id-${index}` },
        ]),
      ),
    );

    const result = await handleTypedOperation(batchCtx.ctx, 'mastra_threads', {
      op: 'batchInsert',
      tableName: 'mastra_threads',
      records: Array.from({ length: 30 }, (_, index) => ({ id: `id-${index}`, title: `thread ${index}` })),
    });

    expect(result).toEqual({ ok: true });
    expect(batchCtx.lookupKeys).toHaveLength(30);
    expect(batchCtx.patches).toHaveLength(30);
    expect(batchCtx.inserts).toHaveLength(0);
    expect(batchCtx.maxConcurrentLookups).toBe(25);
    expect(batchCtx.maxConcurrentWrites).toBe(25);
  });

  it('vector batchInsert keeps the last record for duplicate ids and scopes lookups by vector index', async () => {
    const batchCtx = createBatchInsertCtx(new Map([['embeddings|existing', { _id: asConvexId('vector-existing') }]]));

    const result = await (mastraStorage as StorageHandlerForTest)._handler(batchCtx.ctx, {
      op: 'batchInsert',
      tableName: 'mastra_vector_embeddings',
      records: [
        { id: 'existing', embedding: [1], metadata: { version: 1 } },
        { id: 'new', embedding: [10], metadata: { version: 1 } },
        { id: 'existing', embedding: [2], metadata: { version: 2 } },
        { id: 'new', embedding: [20], metadata: { version: 2 } },
      ],
    });

    expect(result).toEqual({ ok: true });
    expect(batchCtx.lookupKeys).toEqual(['embeddings|existing', 'embeddings|new']);
    expect(batchCtx.patches).toEqual([
      {
        id: asConvexId('vector-existing'),
        data: { embedding: [2], metadata: { version: 2 } },
      },
    ]);
    expect(batchCtx.inserts).toEqual([
      {
        table: 'mastra_vectors',
        record: { id: 'new', indexName: 'embeddings', embedding: [20], metadata: { version: 2 } },
      },
    ]);
  });

  it('generic batchInsert keeps the last duplicate record for fallback tables', async () => {
    const batchCtx = createBatchInsertCtx(
      new Map([['custom_table|existing', { _id: asConvexId('generic-existing') }]]),
    );

    const result = await (mastraStorage as StorageHandlerForTest)._handler(batchCtx.ctx, {
      op: 'batchInsert',
      tableName: 'custom_table',
      records: [
        { id: 'existing', value: 1 },
        { id: 'new', value: 10 },
        { id: 'existing', value: 2 },
        { id: 'new', value: 20 },
      ],
    });

    expect(result).toEqual({ ok: true });
    expect(batchCtx.lookupKeys).toEqual(['custom_table|existing', 'custom_table|new']);
    expect(batchCtx.patches).toEqual([
      {
        id: asConvexId('generic-existing'),
        data: { record: { id: 'existing', value: 2 } },
      },
    ]);
    expect(batchCtx.inserts).toEqual([
      {
        table: 'mastra_documents',
        record: { table: 'custom_table', primaryKey: 'new', record: { id: 'new', value: 20 } },
      },
    ]);
  });

  it('deleteMany dedupes ids and resolves indexed lookups and deletes concurrently', async () => {
    const docsById = new Map([
      ['one', { _id: asConvexId('doc-one'), id: 'one' }],
      ['two', { _id: asConvexId('doc-two'), id: 'two' }],
    ]);
    const deleteCtx = createIndexedDeleteCtx(docsById);

    const result = await handleTypedOperation(deleteCtx.ctx, 'mastra_threads', {
      op: 'deleteMany',
      tableName: 'mastra_threads',
      ids: ['one', 'missing', 'two', 'one'],
    });

    expect(result).toEqual({ ok: true });
    expect(deleteCtx.lookupKeys).toEqual(['one', 'missing', 'two']);
    expect(deleteCtx.deletedIds.sort()).toEqual([asConvexId('doc-one'), asConvexId('doc-two')]);
    expect(deleteCtx.maxConcurrentLookups).toBe(3);
    expect(deleteCtx.maxConcurrentDeletes).toBe(2);
  });

  it('deleteMany does not query or delete for an empty id list', async () => {
    const query = vi.fn();
    const deleteDoc = vi.fn();
    const ctx = { db: { query, delete: deleteDoc } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_threads', {
      op: 'deleteMany',
      tableName: 'mastra_threads',
      ids: [],
    });

    expect(result).toEqual({ ok: true });
    expect(query).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('deleteMany caps lookup and delete concurrency to the storage delete batch size', async () => {
    const docsById = new Map(
      Array.from({ length: 30 }, (_, index) => [`id-${index}`, { _id: asConvexId(`doc-${index}`), id: `id-${index}` }]),
    );
    const deleteCtx = createIndexedDeleteCtx(docsById);

    const result = await handleTypedOperation(deleteCtx.ctx, 'mastra_threads', {
      op: 'deleteMany',
      tableName: 'mastra_threads',
      ids: Array.from({ length: 30 }, (_, index) => `id-${index}`),
    });

    expect(result).toEqual({ ok: true });
    expect(deleteCtx.lookupKeys).toHaveLength(30);
    expect(deleteCtx.deletedIds).toHaveLength(30);
    expect(deleteCtx.maxConcurrentLookups).toBe(25);
    expect(deleteCtx.maxConcurrentDeletes).toBe(25);
  });

  it('clearTable deletes only the current batch concurrently and reports hasMore', async () => {
    const docs: TestDoc[] = Array.from({ length: 26 }, (_, index) => ({ _id: asConvexId(`doc-${index}`) }));
    const clearCtx = createClearTableCtx(docs);

    const result = await handleTypedOperation(clearCtx.ctx, 'mastra_threads', {
      op: 'clearTable',
      tableName: 'mastra_threads',
    });

    expect(result).toEqual({ ok: true, hasMore: true });
    expect(clearCtx.take).toHaveBeenCalledWith(26);
    expect(clearCtx.deletedIds).toHaveLength(25);
    expect(clearCtx.deletedIds).not.toContain(asConvexId('doc-25'));
    expect(clearCtx.maxConcurrentDeletes).toBe(25);
  });

  it('deleteMany applies the same concurrent lookup behavior to vector tables', async () => {
    const deleteCtx = createIndexedDeleteCtx(
      new Map([
        ['embeddings|one', { _id: asConvexId('vector-one'), id: 'one' }],
        ['embeddings|two', { _id: asConvexId('vector-two'), id: 'two' }],
      ]),
    );

    const result = await (mastraStorage as StorageHandlerForTest)._handler(deleteCtx.ctx, {
      op: 'deleteMany',
      tableName: 'mastra_vector_embeddings',
      ids: ['one', 'two', 'one'],
    });

    expect(result).toEqual({ ok: true });
    expect(deleteCtx.lookupKeys).toEqual(['embeddings|one', 'embeddings|two']);
    expect(deleteCtx.deletedIds.sort()).toEqual([asConvexId('vector-one'), asConvexId('vector-two')]);
    expect(deleteCtx.maxConcurrentLookups).toBe(2);
    expect(deleteCtx.maxConcurrentDeletes).toBe(2);
  });

  it('clearTable scopes vector table deletes by vector index and deletes the current batch concurrently', async () => {
    const clearCtx = createClearTableCtx(
      Array.from({ length: 3 }, (_, index) => ({ _id: asConvexId(`vector-doc-${index}`) })),
    );

    const result = await (mastraStorage as StorageHandlerForTest)._handler(clearCtx.ctx, {
      op: 'clearTable',
      tableName: 'mastra_vector_embeddings',
    });

    expect(result).toEqual({ ok: true, hasMore: false });
    expect(clearCtx.indexCalls).toEqual([{ table: 'mastra_vectors', indexName: 'by_index', eqValues: ['embeddings'] }]);
    expect(clearCtx.take).toHaveBeenCalledWith(26);
    expect(clearCtx.deletedIds.sort()).toEqual([
      asConvexId('vector-doc-0'),
      asConvexId('vector-doc-1'),
      asConvexId('vector-doc-2'),
    ]);
    expect(clearCtx.maxConcurrentDeletes).toBe(3);
  });

  it('deleteMany applies the same concurrent lookup behavior to generic fallback tables', async () => {
    const deleteCtx = createIndexedDeleteCtx(
      new Map([
        ['custom_table|one', { _id: asConvexId('generic-one'), id: 'one' }],
        ['custom_table|two', { _id: asConvexId('generic-two'), id: 'two' }],
      ]),
    );

    const result = await (mastraStorage as StorageHandlerForTest)._handler(deleteCtx.ctx, {
      op: 'deleteMany',
      tableName: 'custom_table',
      ids: ['one', 'missing', 'two', 'one'],
    });

    expect(result).toEqual({ ok: true });
    expect(deleteCtx.lookupKeys).toEqual(['custom_table|one', 'custom_table|missing', 'custom_table|two']);
    expect(deleteCtx.deletedIds.sort()).toEqual([asConvexId('generic-one'), asConvexId('generic-two')]);
    expect(deleteCtx.maxConcurrentLookups).toBe(3);
    expect(deleteCtx.maxConcurrentDeletes).toBe(2);
  });

  it('dropTable scopes generic fallback deletes by table and deletes the current batch concurrently', async () => {
    const clearCtx = createClearTableCtx(
      Array.from({ length: 2 }, (_, index) => ({ _id: asConvexId(`generic-doc-${index}`) })),
    );

    const result = await (mastraStorage as StorageHandlerForTest)._handler(clearCtx.ctx, {
      op: 'dropTable',
      tableName: 'custom_table',
    });

    expect(result).toEqual({ ok: true, hasMore: false });
    expect(clearCtx.indexCalls).toEqual([
      { table: 'mastra_documents', indexName: 'by_table', eqValues: ['custom_table'] },
    ]);
    expect(clearCtx.take).toHaveBeenCalledWith(26);
    expect(clearCtx.deletedIds.sort()).toEqual([asConvexId('generic-doc-0'), asConvexId('generic-doc-1')]);
    expect(clearCtx.maxConcurrentDeletes).toBe(2);
  });
});
