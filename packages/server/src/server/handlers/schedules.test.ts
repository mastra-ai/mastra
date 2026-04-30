import { Mastra } from '@mastra/core/mastra';
import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';
import { MockStore } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  GET_SCHEDULE_ROUTE,
  LIST_SCHEDULES_ROUTE,
  LIST_SCHEDULE_TRIGGERS_ROUTE,
  PAUSE_SCHEDULE_ROUTE,
  RESUME_SCHEDULE_ROUTE,
} from './schedules';

const makeSnapshot = (overrides: Partial<WorkflowRunState> = {}): WorkflowRunState => ({
  runId: overrides.runId ?? 'run-1',
  status: overrides.status ?? 'success',
  value: {},
  context: {},
  serializedStepGraph: [],
  activePaths: [],
  activeStepsPath: {},
  suspendedPaths: {},
  resumeLabels: {},
  waitingPaths: {},
  timestamp: 0,
  ...overrides,
});

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

    it('hydrates published triggers with run summary from workflows storage', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const workflowsStore = (await storage.getStore('workflows'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'run-success', actualFireAt: 1 }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'run-failed', actualFireAt: 2 }));
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: 'test',
        runId: 'run-success',
        snapshot: makeSnapshot({ runId: 'run-success', status: 'success' }),
        createdAt: new Date(1_000),
        updatedAt: new Date(1_500),
      });
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: 'test',
        runId: 'run-failed',
        snapshot: makeSnapshot({ runId: 'run-failed', status: 'failed', error: { message: 'kaboom' } as any }),
        createdAt: new Date(2_000),
        updatedAt: new Date(2_750),
      });

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      const successTrigger = result.triggers.find(t => t.runId === 'run-success')!;
      expect(successTrigger.run?.status).toBe('success');
      expect(successTrigger.run?.durationMs).toBe(500);

      const failedTrigger = result.triggers.find(t => t.runId === 'run-failed')!;
      expect(failedTrigger.run?.status).toBe('failed');
      expect(failedTrigger.run?.error).toBe('kaboom');
    });

    it('omits run summary for failed publish triggers', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(
        makeTrigger({ scheduleId: 'wf_a', runId: 'run-x', status: 'failed', error: 'publish failed' }),
      );

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.triggers[0].run).toBeUndefined();
      expect(result.triggers[0].error).toBe('publish failed');
    });

    it('tolerates missing run records', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'run-missing' }));

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.triggers).toHaveLength(1);
      expect(result.triggers[0].run).toBeUndefined();
    });
  });

  describe('lastRun hydration', () => {
    it('hydrates lastRun on list response when lastRunId points at a run', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const workflowsStore = (await storage.getStore('workflows'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a', lastRunId: 'last-run' }));
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: 'test',
        runId: 'last-run',
        snapshot: makeSnapshot({ runId: 'last-run', status: 'success' }),
        createdAt: new Date(1_000),
        updatedAt: new Date(2_000),
      });

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        ...baseCtx(),
      } as any);

      expect(result.schedules[0].lastRun?.status).toBe('success');
      expect(result.schedules[0].lastRun?.durationMs).toBe(1_000);
    });

    it('hydrates lastRun on get response', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const workflowsStore = (await storage.getStore('workflows'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a', lastRunId: 'last-run' }));
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: 'test',
        runId: 'last-run',
        snapshot: makeSnapshot({ runId: 'last-run', status: 'failed' }),
        createdAt: new Date(1_000),
        updatedAt: new Date(2_000),
      });

      const result = await GET_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.lastRun?.status).toBe('failed');
    });
  });

  describe('PAUSE_SCHEDULE_ROUTE', () => {
    it('flips an active schedule to paused', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a', status: 'active' }));

      const result = await PAUSE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('paused');
      const persisted = await schedulesStore.getSchedule('wf_a');
      expect(persisted?.status).toBe('paused');
    });

    it('is idempotent on an already-paused schedule', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a', status: 'paused', updatedAt: 100 }));

      const result = await PAUSE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('paused');
      // updatedAt is unchanged because no write occurred.
      const persisted = await schedulesStore.getSchedule('wf_a');
      expect(persisted?.updatedAt).toBe(100);
    });

    it('returns 404 for missing scheduleId', async () => {
      await expect(
        PAUSE_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: 'does-not-exist',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });

    it('after pause, listDueSchedules excludes the row even if nextFireAt <= now', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeSchedule({ id: 'wf_a', status: 'active', nextFireAt: 1 }));

      await PAUSE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      const due = await schedulesStore.listDueSchedules(Date.now());
      expect(due.find(s => s.id === 'wf_a')).toBeUndefined();
    });
  });

  describe('RESUME_SCHEDULE_ROUTE', () => {
    it('flips a paused schedule to active and recomputes nextFireAt from now', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const oldNext = 1_000_000;
      await schedulesStore.createSchedule(
        makeSchedule({
          id: 'wf_a',
          status: 'paused',
          // Cron that fires every minute — recomputed next must be > now and finite.
          cron: '* * * * *',
          nextFireAt: oldNext,
        }),
      );

      const before = Date.now();
      const result = await RESUME_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('active');
      // Recomputed from "now" — must be in the future, not the stale value.
      expect(result.nextFireAt).toBeGreaterThan(before);
      expect(result.nextFireAt).not.toBe(oldNext);
    });

    it('is idempotent on an already-active schedule', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const oldNext = 1_000_000;
      await schedulesStore.createSchedule(
        makeSchedule({ id: 'wf_a', status: 'active', nextFireAt: oldNext, updatedAt: 100 }),
      );

      const result = await RESUME_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('active');
      // No-op: nextFireAt is not recomputed.
      expect(result.nextFireAt).toBe(oldNext);
      const persisted = await schedulesStore.getSchedule('wf_a');
      expect(persisted?.updatedAt).toBe(100);
    });

    it('returns 404 for missing scheduleId', async () => {
      await expect(
        RESUME_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: 'does-not-exist',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });
});
