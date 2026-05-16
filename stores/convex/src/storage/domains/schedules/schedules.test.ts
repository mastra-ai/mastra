import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';
import { TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ConvexAdminClient } from '../../client';
import type { StorageRequest } from '../../types';
import { SchedulesConvex } from './index';

function createClient({
  callStorage = vi.fn(),
  callStorageRaw = vi.fn(),
}: {
  callStorage?: ReturnType<typeof vi.fn>;
  callStorageRaw?: ReturnType<typeof vi.fn>;
} = {}) {
  const client = new ConvexAdminClient({
    deploymentUrl: 'https://test.convex.cloud',
    adminAuthToken: 'test-token',
  });

  (client as unknown as { callStorage: typeof callStorage }).callStorage = callStorage;
  (client as unknown as { callStorageRaw: typeof callStorageRaw }).callStorageRaw = callStorageRaw;

  return { client, callStorage, callStorageRaw };
}

function createSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'schedule-1',
    target: { type: 'workflow', workflowId: 'workflow-1', inputData: { hello: 'world', $schema: 'test' } },
    cron: '*/5 * * * *',
    status: 'active',
    nextFireAt: 1_000,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createTrigger(overrides: Partial<ScheduleTrigger> = {}): ScheduleTrigger {
  return {
    id: 'trigger-1',
    scheduleId: 'schedule-1',
    runId: 'run-1',
    scheduledFireAt: 1_000,
    actualFireAt: 1_050,
    outcome: 'published',
    triggerKind: 'schedule-fire',
    ...overrides,
  };
}

describe('SchedulesConvex', () => {
  it('creates schedules through the typed schedules table', async () => {
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async () => undefined),
    });
    const storage = new SchedulesConvex({ client });
    const schedule = createSchedule();

    await expect(storage.createSchedule(schedule)).resolves.toEqual(schedule);

    expect(callStorage).toHaveBeenCalledWith({
      op: 'createSchedule',
      tableName: TABLE_SCHEDULES,
      record: {
        id: 'schedule-1',
        target: JSON.stringify(schedule.target),
        cron: schedule.cron,
        timezone: null,
        status: 'active',
        next_fire_at: 1_000,
        last_fire_at: null,
        last_run_id: null,
        created_at: 100,
        updated_at: 100,
        metadata: null,
        owner_type: null,
        owner_id: null,
      },
    });
  });

  it('clears nullable optional fields when updating a schedule', async () => {
    const existing = createSchedule({
      timezone: 'UTC',
      metadata: { priority: 1 },
      ownerType: 'agent',
      ownerId: 'agent-1',
    });
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'updateSchedule') {
          return {
            ...existing,
            next_fire_at: existing.nextFireAt,
            created_at: existing.createdAt,
            updated_at: existing.updatedAt,
            owner_type: existing.ownerType,
            owner_id: existing.ownerId,
            ...request.patch,
          };
        }
        return undefined;
      }),
    });
    const storage = new SchedulesConvex({ client });

    await storage.updateSchedule('schedule-1', {
      timezone: undefined,
      metadata: undefined,
      ownerType: undefined,
      ownerId: undefined,
    });

    expect(callStorage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        op: 'updateSchedule',
        tableName: TABLE_SCHEDULES,
        id: 'schedule-1',
        patch: expect.objectContaining({
          timezone: null,
          metadata: null,
          owner_type: null,
          owner_id: null,
        }),
      }),
    );
  });

  it('serializes schedule payload fields before calling Convex', async () => {
    const existing = createSchedule();
    const nextTarget: Schedule['target'] = {
      type: 'workflow',
      workflowId: 'workflow-2',
      inputData: { nested: { $ref: '#/defs/input' } },
    };
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'updateSchedule') {
          return {
            ...existing,
            target: request.patch.target,
            metadata: request.patch.metadata,
            next_fire_at: existing.nextFireAt,
            created_at: existing.createdAt,
            updated_at: existing.updatedAt,
          };
        }
        return undefined;
      }),
    });
    const storage = new SchedulesConvex({ client });

    await expect(
      storage.updateSchedule('schedule-1', {
        target: nextTarget,
        metadata: { $schema: 'https://example.test/schema.json' },
      }),
    ).resolves.toEqual(expect.objectContaining({ target: nextTarget, metadata: { $schema: expect.any(String) } }));

    expect(callStorage).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'updateSchedule',
        patch: expect.objectContaining({
          target: JSON.stringify(nextTarget),
          metadata: JSON.stringify({ $schema: 'https://example.test/schema.json' }),
        }),
      }),
    );
  });

  it('uses scheduler-specific operations for due listing and CAS claims', async () => {
    const schedule = createSchedule();
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'listDueSchedules') {
          return [{ ...schedule, next_fire_at: schedule.nextFireAt, created_at: 100, updated_at: 100 }];
        }
        if (request.op === 'updateScheduleNextFire') return true;
        return undefined;
      }),
    });
    const storage = new SchedulesConvex({ client });

    await expect(storage.listDueSchedules(1_500, 10)).resolves.toEqual([schedule]);
    await expect(storage.updateScheduleNextFire('schedule-1', 1_000, 2_000, 1_500, 'run-1')).resolves.toBe(true);

    expect(callStorage).toHaveBeenNthCalledWith(1, {
      op: 'listDueSchedules',
      tableName: TABLE_SCHEDULES,
      now: 1_500,
      limit: 10,
    });
    expect(callStorage).toHaveBeenNthCalledWith(2, {
      op: 'updateScheduleNextFire',
      tableName: TABLE_SCHEDULES,
      id: 'schedule-1',
      expectedNextFireAt: 1_000,
      newNextFireAt: 2_000,
      lastFireAt: 1_500,
      lastRunId: 'run-1',
    });
  });

  it('treats a missing schedules schema as no due schedules for idle polling', async () => {
    const { client } = createClient({
      callStorage: vi.fn(async () => {
        throw new Error('Table mastra_schedules is not in the schema');
      }),
    });
    const storage = new SchedulesConvex({ client });

    await expect(storage.listDueSchedules(1_500, 10)).resolves.toEqual([]);
  });

  it('records and deletes trigger history with schedule records', async () => {
    const trigger = createTrigger({ runId: null, triggerKind: 'queue-drain', parentTriggerId: 'trigger-parent' });
    const { client, callStorage, callStorageRaw } = createClient({
      callStorage: vi.fn(async () => undefined),
      callStorageRaw: vi.fn(async () => ({ result: undefined, hasMore: false })),
    });
    const storage = new SchedulesConvex({ client });

    await storage.recordTrigger(trigger);
    await storage.deleteSchedule('schedule-1');

    expect(callStorage).toHaveBeenNthCalledWith(1, {
      op: 'recordScheduleTrigger',
      tableName: TABLE_SCHEDULE_TRIGGERS,
      record: {
        id: 'trigger-1',
        schedule_id: 'schedule-1',
        run_id: null,
        scheduled_fire_at: 1_000,
        actual_fire_at: 1_050,
        outcome: 'published',
        error: null,
        trigger_kind: 'queue-drain',
        parent_trigger_id: 'trigger-parent',
        metadata: null,
      },
    });
    expect(callStorageRaw).toHaveBeenCalledWith({
      op: 'deleteScheduleTriggers',
      tableName: TABLE_SCHEDULE_TRIGGERS,
      scheduleId: 'schedule-1',
    });
    expect(callStorage).toHaveBeenNthCalledWith(2, {
      op: 'deleteMany',
      tableName: TABLE_SCHEDULES,
      ids: ['schedule-1'],
    });
  });

  it('lists trigger history through the indexed trigger operation', async () => {
    const trigger = createTrigger({ actualFireAt: 2_000 });
    const { client, callStorage } = createClient({
      callStorage: vi.fn(async (request: StorageRequest) => {
        if (request.op === 'listScheduleTriggers') {
          return [
            {
              id: trigger.id,
              schedule_id: trigger.scheduleId,
              run_id: trigger.runId,
              scheduled_fire_at: trigger.scheduledFireAt,
              actual_fire_at: trigger.actualFireAt,
              outcome: trigger.outcome,
              error: null,
              trigger_kind: trigger.triggerKind,
              parent_trigger_id: null,
              metadata: null,
            },
          ];
        }
        return undefined;
      }),
    });
    const storage = new SchedulesConvex({ client });

    await expect(
      storage.listTriggers('schedule-1', { fromActualFireAt: 1_000, toActualFireAt: 3_000, limit: 10 }),
    ).resolves.toEqual([trigger]);

    expect(callStorage).toHaveBeenCalledWith({
      op: 'listScheduleTriggers',
      tableName: TABLE_SCHEDULE_TRIGGERS,
      scheduleId: 'schedule-1',
      fromActualFireAt: 1_000,
      toActualFireAt: 3_000,
      limit: 10,
    });
  });
});
