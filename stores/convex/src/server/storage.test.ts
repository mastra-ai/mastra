import { TABLE_SCHEDULES, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage/constants';
import type { GenericId } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';

import type { StorageRequest, StorageResponse } from '../storage/types';
import { handleTypedOperation, mastraStorage } from './storage';

type TypedOperationCtx = Parameters<typeof handleTypedOperation>[0];
type StorageHandlerForTest = typeof mastraStorage & {
  _handler: (ctx: TypedOperationCtx, request: StorageRequest) => Promise<StorageResponse>;
};
type TestDoc = { _id: GenericId<string>; id?: string; record?: Record<string, unknown> };
type TestQueryBuilder = {
  eq: (field: string, value: unknown) => TestQueryBuilder;
  lte?: (field: string, value: number) => TestQueryBuilder;
  gte?: (field: string, value: number) => TestQueryBuilder;
  lt?: (field: string, value: number) => TestQueryBuilder;
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

describe('mastraStorage schedules', () => {
  function createScheduleClaimCtx(schedule: Record<string, unknown> | null) {
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const unique = vi.fn(async () => schedule);
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { unique };
    });
    const query = vi.fn(() => ({ withIndex }));
    const patch = vi.fn(async () => undefined);
    const ctx = { db: { query, patch } } as unknown as TypedOperationCtx;

    return { ctx, builder, withIndex, query, patch };
  }

  it('creates schedules without upserting existing ids', async () => {
    const existing = { _id: asConvexId('schedule-doc'), id: 'schedule-1' };
    const createCtx = createScheduleClaimCtx(null);
    const insert = vi.fn(async () => undefined);
    (createCtx.ctx as any).db.insert = insert;

    const result = await handleTypedOperation(createCtx.ctx, 'mastra_schedules', {
      op: 'createSchedule',
      tableName: TABLE_SCHEDULES,
      record: { id: 'schedule-1', cron: '* * * * *' },
    });

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith('mastra_schedules', { id: 'schedule-1', cron: '* * * * *' });

    const duplicateCtx = createScheduleClaimCtx(existing);
    await expect(
      handleTypedOperation(duplicateCtx.ctx, 'mastra_schedules', {
        op: 'createSchedule',
        tableName: TABLE_SCHEDULES,
        record: { id: 'schedule-1', cron: '* * * * *' },
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('records schedule triggers without upserting existing ids', async () => {
    const existing = { _id: asConvexId('trigger-doc'), id: 'trigger-1' };
    const createCtx = createScheduleClaimCtx(null);
    const insert = vi.fn(async () => undefined);
    (createCtx.ctx as any).db.insert = insert;

    const result = await handleTypedOperation(createCtx.ctx, 'mastra_schedule_triggers', {
      op: 'recordScheduleTrigger',
      tableName: 'mastra_schedule_triggers',
      record: { id: 'trigger-1', schedule_id: 'schedule-1' },
    });

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith('mastra_schedule_triggers', {
      id: 'trigger-1',
      schedule_id: 'schedule-1',
    });

    const duplicateCtx = createScheduleClaimCtx(existing);
    await expect(
      handleTypedOperation(duplicateCtx.ctx, 'mastra_schedule_triggers', {
        op: 'recordScheduleTrigger',
        tableName: 'mastra_schedule_triggers',
        record: { id: 'trigger-1', schedule_id: 'schedule-1' },
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('atomically claims a due schedule when nextFireAt matches', async () => {
    const claimCtx = createScheduleClaimCtx({
      _id: asConvexId('schedule-doc'),
      id: 'schedule-1',
      status: 'active',
      next_fire_at: 100,
    });

    const result = await handleTypedOperation(claimCtx.ctx, 'mastra_schedules', {
      op: 'updateScheduleNextFire',
      tableName: TABLE_SCHEDULES,
      id: 'schedule-1',
      expectedNextFireAt: 100,
      newNextFireAt: 200,
      lastFireAt: 150,
      lastRunId: 'run-1',
    });

    expect(result).toEqual({ ok: true, result: true });
    expect(claimCtx.query).toHaveBeenCalledWith('mastra_schedules');
    expect(claimCtx.withIndex).toHaveBeenCalledWith('by_record_id', expect.any(Function));
    expect(claimCtx.builder.eq).toHaveBeenCalledWith('id', 'schedule-1');
    expect(claimCtx.patch).toHaveBeenCalledWith(asConvexId('schedule-doc'), {
      next_fire_at: 200,
      last_fire_at: 150,
      last_run_id: 'run-1',
      updated_at: expect.any(Number),
    });
  });

  it('does not claim a schedule when nextFireAt changed', async () => {
    const claimCtx = createScheduleClaimCtx({
      _id: asConvexId('schedule-doc'),
      id: 'schedule-1',
      status: 'active',
      next_fire_at: 101,
    });

    const result = await handleTypedOperation(claimCtx.ctx, 'mastra_schedules', {
      op: 'updateScheduleNextFire',
      tableName: TABLE_SCHEDULES,
      id: 'schedule-1',
      expectedNextFireAt: 100,
      newNextFireAt: 200,
      lastFireAt: 150,
      lastRunId: 'run-1',
    });

    expect(result).toEqual({ ok: true, result: false });
    expect(claimCtx.patch).not.toHaveBeenCalled();
  });

  it('patches only requested schedule fields without stale CAS fields', async () => {
    const existing = {
      _id: asConvexId('schedule-doc'),
      id: 'schedule-1',
      status: 'active',
      next_fire_at: 200,
      last_fire_at: 150,
      last_run_id: 'run-1',
    };
    const claimCtx = createScheduleClaimCtx(existing);

    const result = await handleTypedOperation(claimCtx.ctx, 'mastra_schedules', {
      op: 'updateSchedule',
      tableName: TABLE_SCHEDULES,
      id: 'schedule-1',
      patch: {
        metadata: null,
        updated_at: 250,
      },
    });

    expect(result).toEqual({ ok: true, result: { ...existing, metadata: null, updated_at: 250 } });
    expect(claimCtx.patch).toHaveBeenCalledWith(asConvexId('schedule-doc'), {
      metadata: null,
      updated_at: 250,
    });
  });

  it('lists due active schedules through the status and next-fire index', async () => {
    const docs = [{ _id: asConvexId('schedule-1'), id: 'schedule-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
      lte: vi.fn((_field: string, _value: number) => builder),
    };
    const take = vi.fn(async () => docs);
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { take };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedules', {
      op: 'listDueSchedules',
      tableName: TABLE_SCHEDULES,
      now: 500,
      limit: 10,
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(withIndex).toHaveBeenCalledWith('by_status_next_fire_at', expect.any(Function));
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    expect(builder.lte).toHaveBeenCalledWith('next_fire_at', 500);
    expect(take).toHaveBeenCalledWith(10);
  });

  it('uses a bounded default for due schedules when no limit is provided', async () => {
    const docs = [{ _id: asConvexId('schedule-1'), id: 'schedule-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
      lte: vi.fn((_field: string, _value: number) => builder),
    };
    const take = vi.fn(async () => docs);
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { take };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedules', {
      op: 'listDueSchedules',
      tableName: TABLE_SCHEDULES,
      now: 500,
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(take).toHaveBeenCalledWith(100);
  });

  it('applies remaining schedule query filters inside Convex before taking rows', async () => {
    const docs = [{ _id: asConvexId('schedule-1'), id: 'schedule-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: unknown) => builder),
    };
    const filterQuery = { take: vi.fn(async () => docs) };
    const queryFilter = vi.fn((predicate: (q: any) => unknown) => {
      const q = {
        field: vi.fn((field: string) => ({ field })),
        eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
        and: vi.fn((...predicates: unknown[]) => predicates),
      };
      predicate(q);
      expect(q.field).toHaveBeenCalledWith('status');
      expect(q.eq).toHaveBeenCalledWith({ field: 'status' }, 'active');
      return filterQuery;
    });
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { filter: queryFilter, take: vi.fn(async () => docs) };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedules', {
      op: 'queryTable',
      tableName: TABLE_SCHEDULES,
      filters: [
        { field: 'owner_id', value: null },
        { field: 'status', value: 'active' },
      ],
      limit: 8_000,
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(withIndex).toHaveBeenCalledWith('by_owner_id', expect.any(Function));
    expect(builder.eq).toHaveBeenCalledWith('owner_id', null);
    expect(queryFilter).toHaveBeenCalledTimes(1);
    expect(filterQuery.take).toHaveBeenCalledWith(10_000);
  });

  it('uses the composite workflow/status index for filtered schedule lists', async () => {
    const docs = [{ _id: asConvexId('schedule-1'), id: 'schedule-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: unknown) => builder),
    };
    const take = vi.fn(async () => docs);
    const filter = vi.fn();
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { filter, take };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedules', {
      op: 'queryTable',
      tableName: TABLE_SCHEDULES,
      filters: [
        { field: 'status', value: 'active' },
        { field: 'workflow_id', value: 'workflow-1' },
      ],
      limit: 8_000,
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(withIndex).toHaveBeenCalledWith('by_workflow_status', expect.any(Function));
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'workflow_id', 'workflow-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'active');
    expect(filter).not.toHaveBeenCalled();
    expect(take).toHaveBeenCalledWith(10_000);
  });

  it('applies explicit filters even when an index hint uses the same fields', async () => {
    const docs = [{ _id: asConvexId('snapshot-1'), id: 'snapshot-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: unknown) => builder),
    };
    const filterQuery = { take: vi.fn(async () => docs) };
    const queryFilter = vi.fn((predicate: (q: any) => unknown) => {
      const q = {
        field: vi.fn((field: string) => ({ field })),
        eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
        and: vi.fn((...predicates: unknown[]) => predicates),
      };
      predicate(q);
      expect(q.field).toHaveBeenCalledWith('workflow_name');
      expect(q.eq).toHaveBeenCalledWith({ field: 'workflow_name' }, 'workflow-b');
      return filterQuery;
    });
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { filter: queryFilter, take: vi.fn(async () => docs) };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_workflow_snapshots', {
      op: 'queryTable',
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      filters: [{ field: 'workflow_name', value: 'workflow-b' }],
      indexHint: { index: 'by_workflow', workflowName: 'workflow-a' },
      limit: 10,
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(withIndex).toHaveBeenCalledWith('by_workflow', expect.any(Function));
    expect(builder.eq).toHaveBeenCalledWith('workflow_name', 'workflow-a');
    expect(queryFilter).toHaveBeenCalledTimes(1);
    expect(filterQuery.take).toHaveBeenCalledWith(20);
  });

  it('lists trigger history through the schedule and actual-fire index newest first', async () => {
    const docs = [{ _id: asConvexId('trigger-1'), id: 'trigger-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
      gte: vi.fn((_field: string, _value: number) => builder),
      lt: vi.fn((_field: string, _value: number) => builder),
    };
    const take = vi.fn(async () => docs);
    const order = vi.fn((_direction: 'asc' | 'desc') => ({ take }));
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { order };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedule_triggers', {
      op: 'listScheduleTriggers',
      tableName: 'mastra_schedule_triggers',
      scheduleId: 'schedule-1',
      fromActualFireAt: 100,
      toActualFireAt: 500,
      limit: 1_500,
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(withIndex).toHaveBeenCalledWith('by_schedule_actual', expect.any(Function));
    expect(builder.eq).toHaveBeenCalledWith('schedule_id', 'schedule-1');
    expect(builder.gte).toHaveBeenCalledWith('actual_fire_at', 100);
    expect(builder.lt).toHaveBeenCalledWith('actual_fire_at', 500);
    expect(order).toHaveBeenCalledWith('desc');
    expect(take).toHaveBeenCalledWith(1_500);
  });

  it('uses a bounded default for trigger history when no limit is provided', async () => {
    const docs = [{ _id: asConvexId('trigger-1'), id: 'trigger-1' }];
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const take = vi.fn(async () => docs);
    const order = vi.fn((_direction: 'asc' | 'desc') => ({ take }));
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { order };
    });
    const query = vi.fn(() => ({ withIndex }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedule_triggers', {
      op: 'listScheduleTriggers',
      tableName: 'mastra_schedule_triggers',
      scheduleId: 'schedule-1',
    });

    expect(result).toEqual({ ok: true, result: docs });
    expect(order).toHaveBeenCalledWith('desc');
    expect(take).toHaveBeenCalledWith(100);
  });

  it('deletes one trigger-history batch by schedule id', async () => {
    const docs = Array.from({ length: 26 }, (_, index) => ({ _id: asConvexId(`trigger-${index}`) }));
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const take = vi.fn(async () => docs);
    const withIndex = vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
      queryBuilder(builder);
      return { take };
    });
    const query = vi.fn(() => ({ withIndex }));
    const deleteDoc = vi.fn(async () => undefined);
    const ctx = { db: { query, delete: deleteDoc } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_schedule_triggers', {
      op: 'deleteScheduleTriggers',
      tableName: 'mastra_schedule_triggers',
      scheduleId: 'schedule-1',
    });

    expect(result).toEqual({ ok: true, hasMore: true });
    expect(withIndex).toHaveBeenCalledWith('by_schedule_actual', expect.any(Function));
    expect(builder.eq).toHaveBeenCalledWith('schedule_id', 'schedule-1');
    expect(take).toHaveBeenCalledWith(26);
    expect(deleteDoc).toHaveBeenCalledTimes(25);
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
    const deletedIds: GenericId<string>[] = [];
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
    const deleteDoc = vi.fn(async (id: GenericId<string>) => {
      deletedIds.push(id);
    });
    const ctx = { db: { query, patch, insert, delete: deleteDoc } } as unknown as TypedOperationCtx;

    return {
      ctx,
      lookupKeys,
      patches,
      inserts,
      deletedIds,
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

  it('typed patch updates an existing record without deleting it', async () => {
    const batchCtx = createBatchInsertCtx(new Map([['task-1', { _id: asConvexId('task-doc') }]]));

    const result = await handleTypedOperation(batchCtx.ctx, 'mastra_background_tasks', {
      op: 'patch',
      tableName: 'mastra_background_tasks',
      id: 'task-1',
      record: { id: 'should-not-change', status: 'completed', completedAt: '2026-01-01T00:00:00.000Z' },
    });

    expect(result).toEqual({ ok: true, result: true });
    expect(batchCtx.lookupKeys).toEqual(['task-1', 'mastra_background_tasks|task-1']);
    expect(batchCtx.patches).toEqual([
      {
        id: asConvexId('task-doc'),
        data: { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z' },
      },
    ]);
    expect(batchCtx.inserts).toEqual([]);
    expect(batchCtx.deletedIds).toEqual([]);
  });

  it('background task patch deletes stale legacy fallback rows after typed rows exist', async () => {
    const batchCtx = createBatchInsertCtx(
      new Map([
        ['task-1', { _id: asConvexId('task-doc') }],
        [
          'mastra_background_tasks|task-1',
          {
            _id: asConvexId('legacy-task-doc'),
            record: { id: 'task-1', status: 'pending', agentId: 'agent-1' },
          },
        ],
      ]),
    );

    const result = await handleTypedOperation(batchCtx.ctx, 'mastra_background_tasks', {
      op: 'patch',
      tableName: 'mastra_background_tasks',
      id: 'task-1',
      record: { status: 'running' },
    });

    expect(result).toEqual({ ok: true, result: true });
    expect(batchCtx.lookupKeys).toEqual(['task-1', 'mastra_background_tasks|task-1']);
    expect(batchCtx.patches).toEqual([{ id: asConvexId('task-doc'), data: { status: 'running' } }]);
    expect(batchCtx.deletedIds).toEqual([asConvexId('legacy-task-doc')]);
  });

  it('background task patch updates legacy fallback rows when no typed row exists', async () => {
    const batchCtx = createBatchInsertCtx(
      new Map([
        [
          'mastra_background_tasks|task-1',
          {
            _id: asConvexId('legacy-task-doc'),
            record: { id: 'task-1', status: 'pending', agentId: 'agent-1', retryCount: 0 },
          },
        ],
      ]),
    );

    const result = await handleTypedOperation(batchCtx.ctx, 'mastra_background_tasks', {
      op: 'patch',
      tableName: 'mastra_background_tasks',
      id: 'task-1',
      record: { status: 'running', retry_count: 1, startedAt: '2026-01-01T00:01:00.000Z' },
    });

    expect(result).toEqual({ ok: true, result: true });
    expect(batchCtx.lookupKeys).toEqual(['task-1', 'mastra_background_tasks|task-1']);
    expect(batchCtx.patches).toEqual([
      {
        id: asConvexId('legacy-task-doc'),
        data: {
          record: {
            id: 'task-1',
            status: 'running',
            agentId: 'agent-1',
            retry_count: 1,
            startedAt: '2026-01-01T00:01:00.000Z',
          },
        },
      },
    ]);
  });

  it('background task load falls back to legacy generic documents during upgrade', async () => {
    const batchCtx = createBatchInsertCtx(
      new Map([
        [
          'mastra_background_tasks|task-1',
          {
            _id: asConvexId('legacy-task-doc'),
            record: { id: 'task-1', status: 'pending', agentId: 'agent-1' },
          },
        ],
      ]),
    );

    const result = await handleTypedOperation(batchCtx.ctx, 'mastra_background_tasks', {
      op: 'load',
      tableName: 'mastra_background_tasks',
      keys: { id: 'task-1' },
    });

    expect(result).toEqual({ ok: true, result: { id: 'task-1', status: 'pending', agentId: 'agent-1' } });
    expect(batchCtx.lookupKeys).toEqual(['task-1', 'mastra_background_tasks|task-1']);
  });

  it('background task queryTable applies filters to legacy generic documents', async () => {
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const typedDocs = [
      { _id: asConvexId('typed-running'), id: 'typed-running', status: 'running', agent_id: 'agent-1' },
      { _id: asConvexId('typed-completed'), id: 'typed-completed', status: 'completed', agent_id: 'agent-1' },
    ];
    const legacyDocs = [
      {
        _id: asConvexId('legacy-duplicate-doc'),
        record: { id: 'typed-running', status: 'running', agentId: 'agent-1' },
      },
      {
        _id: asConvexId('legacy-running-doc'),
        record: { id: 'legacy-running', status: 'running', agentId: 'agent-1' },
      },
      {
        _id: asConvexId('legacy-completed-doc'),
        record: { id: 'legacy-completed', status: 'completed', agentId: 'agent-1' },
      },
    ];
    const query = vi.fn((table: string) => ({
      withIndex: vi.fn((indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
        const indexedFilters: Array<{ field: string; value: string }> = [];
        const localBuilder: TestQueryBuilder = {
          eq: vi.fn((field: string, value: string) => {
            indexedFilters.push({ field, value: String(value) });
            return localBuilder;
          }),
        };
        queryBuilder(builder);
        queryBuilder(localBuilder);
        const applyIndexedFilters = (doc: Record<string, unknown>) =>
          indexedFilters.every(filter => doc[filter.field] === filter.value);
        return {
          take: vi.fn(async () => (table === 'mastra_documents' ? legacyDocs : typedDocs.filter(applyIndexedFilters))),
          unique: vi.fn(async () =>
            table === 'mastra_background_tasks' && indexName === 'by_record_id'
              ? (typedDocs.find(doc => doc.id === indexedFilters.find(filter => filter.field === 'id')?.value) ?? null)
              : null,
          ),
        };
      }),
      take: vi.fn(async () => (table === 'mastra_background_tasks' ? typedDocs : [])),
    }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_background_tasks', {
      op: 'queryTable',
      tableName: 'mastra_background_tasks',
      filters: [
        { field: 'status', value: 'running' },
        { field: 'agent_id', value: 'agent-1' },
      ],
    });

    expect(result).toEqual({
      ok: true,
      result: [
        { _id: asConvexId('typed-running'), id: 'typed-running', status: 'running', agent_id: 'agent-1' },
        { id: 'legacy-running', status: 'running', agentId: 'agent-1' },
      ],
    });
  });

  it('background task queryTable suppresses stale legacy rows when a typed row exists', async () => {
    const typedDocs = [{ _id: asConvexId('typed-task-doc'), id: 'task-1', status: 'completed', agent_id: 'agent-1' }];
    const legacyDocs = [
      {
        _id: asConvexId('legacy-task-doc'),
        record: { id: 'task-1', status: 'running', agentId: 'agent-1' },
      },
    ];
    const query = vi.fn((table: string) => ({
      withIndex: vi.fn((indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
        const eqValues: string[] = [];
        const builder: TestQueryBuilder = {
          eq: vi.fn((_field: string, value: string) => {
            eqValues.push(String(value));
            return builder;
          }),
        };
        queryBuilder(builder);
        return {
          take: vi.fn(async () => (table === 'mastra_documents' ? legacyDocs : [])),
          unique: vi.fn(async () =>
            table === 'mastra_background_tasks' && indexName === 'by_record_id'
              ? (typedDocs.find(doc => doc.id === eqValues[0]) ?? null)
              : null,
          ),
        };
      }),
      take: vi.fn(async () => (table === 'mastra_background_tasks' ? typedDocs : [])),
    }));
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_background_tasks', {
      op: 'queryTable',
      tableName: 'mastra_background_tasks',
      filters: [{ field: 'status', value: 'running' }],
    });

    expect(result).toEqual({ ok: true, result: [] });
  });

  it('background task queryTable falls back to generic documents when the typed table is not deployed', async () => {
    const builder: TestQueryBuilder = {
      eq: vi.fn((_field: string, _value: string) => builder),
    };
    const legacyDocs = [
      {
        _id: asConvexId('legacy-running-doc'),
        record: { id: 'legacy-running', status: 'running', agentId: 'agent-1' },
      },
      {
        _id: asConvexId('legacy-completed-doc'),
        record: { id: 'legacy-completed', status: 'completed', agentId: 'agent-1' },
      },
    ];
    const query = vi.fn((table: string) => {
      if (table === 'mastra_background_tasks') {
        throw new Error("Table 'mastra_background_tasks' does not exist");
      }

      return {
        withIndex: vi.fn((_indexName: string, queryBuilder: (q: TestQueryBuilder) => TestQueryBuilder) => {
          queryBuilder(builder);
          return {
            take: vi.fn(async () => legacyDocs),
          };
        }),
        take: vi.fn(async () => []),
      };
    });
    const ctx = { db: { query } } as unknown as TypedOperationCtx;

    const result = await (mastraStorage as StorageHandlerForTest)._handler(ctx, {
      op: 'queryTable',
      tableName: 'mastra_background_tasks',
      filters: [
        { field: 'status', value: 'running' },
        { field: 'agent_id', value: 'agent-1' },
      ],
    });

    expect(result).toEqual({
      ok: true,
      result: [{ id: 'legacy-running', status: 'running', agentId: 'agent-1' }],
    });
  });

  it('routes background task operations to the typed background task table', async () => {
    const batchCtx = createBatchInsertCtx(new Map([['task-1', { _id: asConvexId('task-doc') }]]));

    const result = await (mastraStorage as StorageHandlerForTest)._handler(batchCtx.ctx, {
      op: 'patch',
      tableName: 'mastra_background_tasks',
      id: 'task-1',
      record: { status: 'running' },
    });

    expect(result).toEqual({ ok: true, result: true });
    expect(batchCtx.lookupKeys).toEqual(['task-1', 'mastra_background_tasks|task-1']);
    expect(batchCtx.patches).toEqual([{ id: asConvexId('task-doc'), data: { status: 'running' } }]);
    expect(batchCtx.inserts).toEqual([]);
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

  it('vector patch updates vector fields without wrapping them in a record object', async () => {
    const batchCtx = createBatchInsertCtx(new Map([['embeddings|existing', { _id: asConvexId('vector-existing') }]]));

    const result = await (mastraStorage as StorageHandlerForTest)._handler(batchCtx.ctx, {
      op: 'patch',
      tableName: 'mastra_vector_embeddings',
      id: 'existing',
      record: { id: 'other', indexName: 'other-index', embedding: [3], metadata: { version: 3 } },
    });

    expect(result).toEqual({ ok: true, result: true });
    expect(batchCtx.lookupKeys).toEqual(['embeddings|existing']);
    expect(batchCtx.patches).toEqual([
      {
        id: asConvexId('vector-existing'),
        data: { embedding: [3], metadata: { version: 3 } },
      },
    ]);
    expect(batchCtx.inserts).toEqual([]);
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

  it('background task deleteMany deletes typed and legacy fallback rows', async () => {
    const deleteCtx = createIndexedDeleteCtx(
      new Map([
        ['task-1', { _id: asConvexId('typed-task-doc'), id: 'task-1' }],
        [
          'mastra_background_tasks|task-1',
          {
            _id: asConvexId('legacy-task-doc'),
            record: { id: 'task-1', status: 'pending' },
          },
        ],
      ]),
    );

    const result = await handleTypedOperation(deleteCtx.ctx, 'mastra_background_tasks', {
      op: 'deleteMany',
      tableName: 'mastra_background_tasks',
      ids: ['task-1'],
    });

    expect(result).toEqual({ ok: true });
    expect(deleteCtx.lookupKeys).toEqual(['task-1', 'mastra_background_tasks|task-1']);
    expect(deleteCtx.deletedIds.sort()).toEqual([asConvexId('legacy-task-doc'), asConvexId('typed-task-doc')]);
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

  it('background task clearTable deletes legacy fallback rows after typed rows drain', async () => {
    const legacyDocs = [
      { _id: asConvexId('legacy-task-doc-1'), record: { id: 'legacy-task-1' } },
      { _id: asConvexId('legacy-task-doc-2'), record: { id: 'legacy-task-2' } },
    ];
    const indexCalls: Array<{ table: string; indexName?: string; eqValues: string[] }> = [];
    const deletedIds: GenericId<string>[] = [];
    const query = vi.fn((table: string) => ({
      take: vi.fn(async () => []),
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
        return { take: vi.fn(async () => legacyDocs) };
      }),
    }));
    const deleteDoc = vi.fn(async (id: GenericId<string>) => {
      deletedIds.push(id);
    });
    const ctx = { db: { query, delete: deleteDoc } } as unknown as TypedOperationCtx;

    const result = await handleTypedOperation(ctx, 'mastra_background_tasks', {
      op: 'clearTable',
      tableName: 'mastra_background_tasks',
    });

    expect(result).toEqual({ ok: true, hasMore: false });
    expect(indexCalls).toEqual([
      { table: 'mastra_documents', indexName: 'by_table', eqValues: ['mastra_background_tasks'] },
    ]);
    expect(deletedIds.sort()).toEqual([asConvexId('legacy-task-doc-1'), asConvexId('legacy-task-doc-2')]);
  });

  it('background task clearTable skips legacy lookup when the typed delete batch is full', async () => {
    const docs: TestDoc[] = Array.from({ length: 25 }, (_, index) => ({ _id: asConvexId(`task-doc-${index}`) }));
    const clearCtx = createClearTableCtx(docs);

    const result = await handleTypedOperation(clearCtx.ctx, 'mastra_background_tasks', {
      op: 'clearTable',
      tableName: 'mastra_background_tasks',
    });

    expect(result).toEqual({ ok: true, hasMore: false });
    expect(clearCtx.indexCalls).toEqual([]);
    expect(clearCtx.deletedIds).toHaveLength(25);
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
