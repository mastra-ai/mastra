import { Mastra } from '@mastra/core/mastra';
import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';
import { MockStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { GET_SCHEDULE_ROUTE, LIST_SCHEDULES_ROUTE, LIST_SCHEDULE_TRIGGERS_ROUTE } from './schedules';

const baseCtx = () => ({
  requestContext: {} as any,
  abortSignal: new AbortController().signal,
});

const makeSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? 'wf_test',
  target: { type: 'workflow', workflowId: 'test' },
  cron: '0 * * * *',
  status: 'active',
  nextFireAt: 1_000_000,
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
});

const makeTrigger = (overrides: Partial<ScheduleTrigger> = {}): ScheduleTrigger => ({
  scheduleId: 'wf_test',
  runId: 'run-1',
  scheduledFireAt: 1_000_000,
  actualFireAt: 1_000_001,
  status: 'published',
  ...overrides,
});

describe('Schedules handlers', () => {
  let mastra: Mastra;
  let storage: InstanceType<typeof MockStore>;

  beforeEach(async () => {
    storage = new MockStore();
    mastra = new Mastra({ logger: false, storage });
  });

  describe('LIST_SCHEDULES_ROUTE', () => {
    it('returns empty list when no schedules exist', async () => {
      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        ...baseCtx(),
      } as any);

      expect(result).toEqual({ schedules: [] });
    });

    it('returns schedules after they are created in storage', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_b', target: { type: 'workflow', workflowId: 'b' } }));

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(2);
      expect(result.schedules.map(s => s.id).sort()).toEqual(['wf_a', 'wf_b']);
    });

    it('filters by workflowId', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_b', target: { type: 'workflow', workflowId: 'b' } }));

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        workflowId: 'b',
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(1);
      expect(result.schedules[0].id).toBe('wf_b');
    });

    it('filters by status', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a', status: 'active' }));
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_b', status: 'paused' }));

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        status: 'paused',
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(1);
      expect(result.schedules[0].id).toBe('wf_b');
    });

    it('returns empty list when schedules domain is unavailable', async () => {
      const mastraNoStorage = new Mastra({ logger: false });
      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra: mastraNoStorage,
        ...baseCtx(),
      } as any);

      expect(result).toEqual({ schedules: [] });
    });
  });

  describe('GET_SCHEDULE_ROUTE', () => {
    it('returns the schedule when it exists', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));

      const result = await GET_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.id).toBe('wf_a');
    });

    it('throws 404 when the schedule does not exist', async () => {
      await expect(
        GET_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: 'missing',
          ...baseCtx(),
        } as any),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('throws 404 when schedules domain is unavailable', async () => {
      const mastraNoStorage = new Mastra({ logger: false });
      await expect(
        GET_SCHEDULE_ROUTE.handler({
          mastra: mastraNoStorage,
          scheduleId: 'wf_a',
          ...baseCtx(),
        } as any),
      ).rejects.toBeInstanceOf(HTTPException);
    });
  });

  describe('LIST_SCHEDULE_TRIGGERS_ROUTE', () => {
    it('returns triggers ordered by actualFireAt desc', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'r1', actualFireAt: 1 }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'r2', actualFireAt: 2 }));

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.triggers.map(t => t.runId)).toEqual(['r2', 'r1']);
    });

    it('respects the limit parameter', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'r1', actualFireAt: 1 }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'r2', actualFireAt: 2 }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'r3', actualFireAt: 3 }));

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        limit: 2,
        ...baseCtx(),
      } as any);

      expect(result.triggers.length).toBe(2);
      expect(result.triggers.map(t => t.runId)).toEqual(['r3', 'r2']);
    });

    it('returns empty list when schedules domain is unavailable', async () => {
      const mastraNoStorage = new Mastra({ logger: false });
      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra: mastraNoStorage,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result).toEqual({ triggers: [] });
    });
  });
});
