import { Agent, AGENT_SCHEDULE_PREFIX } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';
import { MockStore } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import {
  CREATE_SCHEDULE_ROUTE,
  DELETE_SCHEDULE_ROUTE,
  GET_SCHEDULE_ROUTE,
  LIST_SCHEDULES_ROUTE,
  LIST_SCHEDULE_TRIGGERS_ROUTE,
  PAUSE_SCHEDULE_ROUTE,
  RESUME_SCHEDULE_ROUTE,
  RUN_SCHEDULE_ROUTE,
  UPDATE_SCHEDULE_ROUTE,
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
  requestContext: new RequestContext(),
  abortSignal: new AbortController().signal,
});

const makeWorkflowSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? 'wf_test',
  target: { type: 'workflow', workflowId: 'test' },
  cron: '0 * * * *',
  status: 'active',
  nextFireAt: 1_000_000,
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
});

const makeAgentSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? `${AGENT_SCHEDULE_PREFIX}agent-1_thread-1`,
  ownerType: 'agent',
  ownerId: 'agent-1',
  target: {
    type: 'agent',
    agentId: 'agent-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    prompt: 'Check in',
    ...((overrides.target as any) ?? {}),
  },
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
  outcome: 'published',
  triggerKind: 'schedule-fire',
  ...overrides,
});

describe('Schedules handlers', () => {
  let mastra: Mastra;
  let storage: InstanceType<typeof MockStore>;

  beforeEach(async () => {
    storage = new MockStore();
    const agent = new Agent({
      id: 'agent-1',
      name: 'agent-1',
      instructions: 'test',
      model: {} as any,
    });
    const step = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    const workflow = createWorkflow({
      id: 'test',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(step)
      .commit();
    mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'agent-1': agent },
      workflows: { test: workflow },
    });
  });

  describe('LIST_SCHEDULES_ROUTE', () => {
    it('returns empty list when no schedules exist', async () => {
      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        ...baseCtx(),
      } as any);

      expect(result).toEqual({ schedules: [] });
    });

    it('returns both agent and workflow schedules', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
      await schedulesStore.createSchedule(makeAgentSchedule());

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(2);
      const agentSchedule = result.schedules.find(s => s.agentId !== undefined)!;
      const workflowSchedule = result.schedules.find(s => s.workflowId !== undefined)!;
      expect(agentSchedule.agentId).toBe('agent-1');
      expect(workflowSchedule.workflowId).toBe('test');
    });

    it('filters by workflowId and excludes agent schedules', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
      await schedulesStore.createSchedule(
        makeWorkflowSchedule({ id: 'wf_b', target: { type: 'workflow', workflowId: 'b' } }),
      );
      await schedulesStore.createSchedule(makeAgentSchedule());

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        workflowId: 'b',
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(1);
      expect(result.schedules[0].id).toBe('wf_b');
    });

    it('filters by agentId and excludes workflow schedules', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', ownerType: 'agent', ownerId: 'agent-1' }));
      await schedulesStore.createSchedule(makeAgentSchedule());
      await schedulesStore.createSchedule(
        makeAgentSchedule({
          id: `${AGENT_SCHEDULE_PREFIX}agent-2_t`,
          ownerId: 'agent-2',
          target: { type: 'agent', agentId: 'agent-2', prompt: 'Hi' },
        }),
      );

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(1);
      expect(result.schedules[0].agentId).toBe('agent-1');
    });

    it('filters by status', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', status: 'active' }));
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_b', status: 'paused' }));

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        status: 'paused',
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(1);
      expect(result.schedules[0].id).toBe('wf_b');
    });

    it('surfaces legacy heartbeat rows as agent schedules via the read-shim', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(
        makeAgentSchedule({
          id: 'hb_legacy',
          target: { type: 'heartbeat', agentId: 'agent-1', prompt: 'Legacy' } as any,
        }),
      );

      const result = await LIST_SCHEDULES_ROUTE.handler({
        mastra,
        ...baseCtx(),
      } as any);

      expect(result.schedules.length).toBe(1);
      expect(result.schedules[0].id).toBe('hb_legacy');
      expect(result.schedules[0].agentId).toBe('agent-1');
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
    it('returns a workflow schedule when it exists', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));

      const result = await GET_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.id).toBe('wf_a');
      expect(result.workflowId).toBe('test');
    });

    it('returns an agent schedule with flattened target fields', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await GET_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result.id).toBe(schedule.id);
      expect(result.agentId).toBe('agent-1');
      expect(result.threadId).toBe('thread-1');
      expect(result.prompt).toBe('Check in');
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

  describe('CREATE_SCHEDULE_ROUTE', () => {
    it('creates an agent schedule when agentId is provided', async () => {
      const result = await CREATE_SCHEDULE_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        cron: '0 * * * *',
        prompt: 'Hello',
        threadId: 'thread-2',
        resourceId: 'resource-2',
        ...baseCtx(),
      } as any);

      expect(result.agentId).toBe('agent-1');
      expect((result as any).threadId).toBe('thread-2');
      expect((result as any).prompt).toBe('Hello');

      const schedulesStore = (await storage.getStore('schedules'))!;
      const created = await schedulesStore.getSchedule(result.id);
      expect(created).toBeDefined();
      expect(created!.ownerId).toBe('agent-1');
      expect(created!.target.type).toBe('agent');
    });

    it('creates a workflow schedule when workflowId is provided', async () => {
      const result = await CREATE_SCHEDULE_ROUTE.handler({
        mastra,
        workflowId: 'test',
        cron: '0 * * * *',
        inputData: { foo: 'bar' },
        ...baseCtx(),
      } as any);

      expect(result.workflowId).toBe('test');
      expect(result.id).not.toMatch(/^wf_/);

      const schedulesStore = (await storage.getStore('schedules'))!;
      const created = await schedulesStore.getSchedule(result.id);
      expect(created).toBeDefined();
      expect(created!.target.type).toBe('workflow');
    });

    it('404s when the agent does not exist', async () => {
      await expect(
        CREATE_SCHEDULE_ROUTE.handler({
          mastra,
          agentId: 'unknown-agent',
          cron: '0 * * * *',
          prompt: 'Hello',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });

    it('404s when the workflow does not exist', async () => {
      await expect(
        CREATE_SCHEDULE_ROUTE.handler({
          mastra,
          workflowId: 'unknown-workflow',
          cron: '0 * * * *',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });

    it('rejects ambiguous bodies carrying both agentId and workflowId', () => {
      const result = CREATE_SCHEDULE_ROUTE.bodySchema!.safeParse({
        agentId: 'agent-1',
        workflowId: 'test',
        cron: '0 * * * *',
        prompt: 'Hello',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty-string target ids', () => {
      expect(
        CREATE_SCHEDULE_ROUTE.bodySchema!.safeParse({ agentId: '', cron: '0 * * * *', prompt: 'Hi' }).success,
      ).toBe(false);
      expect(CREATE_SCHEDULE_ROUTE.bodySchema!.safeParse({ workflowId: '', cron: '0 * * * *' }).success).toBe(false);
    });

    it('rejects unknown keys on the create body', () => {
      const result = CREATE_SCHEDULE_ROUTE.bodySchema!.safeParse({
        agentId: 'agent-1',
        cron: '0 * * * *',
        prompt: 'Hello',
        bogus: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UPDATE_SCHEDULE_ROUTE', () => {
    it('updates an agent schedule prompt without touching cron/nextFireAt', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await UPDATE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        prompt: 'New prompt',
        ...baseCtx(),
      } as any);

      expect((result as any).prompt).toBe('New prompt');
      expect(result.cron).toBe(schedule.cron);
      expect(result.nextFireAt).toBe(schedule.nextFireAt);
    });

    it('updates cron and recomputes nextFireAt', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await UPDATE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        cron: '*/5 * * * *',
        ...baseCtx(),
      } as any);

      expect(result.cron).toBe('*/5 * * * *');
      expect(result.nextFireAt).toBeGreaterThan(schedule.nextFireAt);
    });

    it('updates workflow schedule inputData', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));

      const result = await UPDATE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        inputData: { hello: 'world' },
        ...baseCtx(),
      } as any);

      expect((result as any).inputData).toEqual({ hello: 'world' });
    });

    it('rejects invalid cron', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      await expect(
        UPDATE_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: schedule.id,
          cron: 'not-a-cron',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow();
    });

    it('404s when the schedule does not exist', async () => {
      await expect(
        UPDATE_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: 'missing',
          prompt: 'nope',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('DELETE_SCHEDULE_ROUTE', () => {
    it('deletes the schedule and removes the row', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await DELETE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result).toEqual({ message: 'Schedule deleted' });
      expect(await schedulesStore.getSchedule(schedule.id)).toBeFalsy();
    });

    it('404s when the schedule does not exist', async () => {
      await expect(
        DELETE_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: 'missing',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('RUN_SCHEDULE_ROUTE', () => {
    it('fires an agent schedule manually and returns claim info', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await RUN_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result.scheduleId).toBe(schedule.id);
      expect(result.claimId).toBeTruthy();
      expect(result.scheduledFireAt).toBeGreaterThan(0);
    });

    it('404s when the schedule does not exist', async () => {
      await expect(
        RUN_SCHEDULE_ROUTE.handler({
          mastra,
          scheduleId: 'missing',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('LIST_SCHEDULE_TRIGGERS_ROUTE', () => {
    it('returns triggers ordered by actualFireAt desc', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(
        makeTrigger({ scheduleId: 'wf_a', runId: 'run-x', outcome: 'failed', error: 'publish failed' }),
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a' }));
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: 'wf_a', runId: 'run-missing' }));

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.triggers).toHaveLength(1);
      expect(result.triggers[0].run).toBeUndefined();
    });

    it('skips workflow-run hydration for agent schedule triggers', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);
      await schedulesStore.recordTrigger(
        makeTrigger({ scheduleId: schedule.id, runId: 'agent-run-1', outcome: 'succeeded' }),
      );

      const result = await LIST_SCHEDULE_TRIGGERS_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', lastRunId: 'last-run' }));
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', lastRunId: 'last-run' }));
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

    it('does not hydrate lastRun for agent schedules', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule({ lastRunId: 'agent-run-1' });
      await schedulesStore.createSchedule(schedule);

      const result = await GET_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result.lastRun).toBeUndefined();
      expect(result.lastRunId).toBe('agent-run-1');
    });
  });

  describe('PAUSE_SCHEDULE_ROUTE', () => {
    it('flips an active schedule to paused', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', status: 'active' }));

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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', status: 'paused', updatedAt: 100 }));

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

    it('pauses an agent schedule', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await PAUSE_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('paused');
      expect(result.agentId).toBe('agent-1');
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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', status: 'active', nextFireAt: 1 }));

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
      await schedulesStore.createSchedule(makeWorkflowSchedule({ id: 'wf_a', status: 'paused', nextFireAt: oldNext }));

      const result = await RESUME_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('active');
      expect(result.nextFireAt).toBeGreaterThan(oldNext);
    });

    it('is idempotent on an already-active schedule', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(
        makeWorkflowSchedule({ id: 'wf_a', status: 'active', nextFireAt: 1_000_000 }),
      );

      const result = await RESUME_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: 'wf_a',
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('active');
      expect(result.nextFireAt).toBe(1_000_000);
    });

    it('resumes a paused agent schedule', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeAgentSchedule({ status: 'paused' });
      await schedulesStore.createSchedule(schedule);

      const result = await RESUME_SCHEDULE_ROUTE.handler({
        mastra,
        scheduleId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result.status).toBe('active');
      expect(result.nextFireAt).toBeGreaterThan(schedule.nextFireAt);
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
