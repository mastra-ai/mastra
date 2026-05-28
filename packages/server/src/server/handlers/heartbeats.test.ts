import { Agent, HEARTBEAT_WORKFLOW_ID, HEARTBEAT_SCHEDULE_PREFIX } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';
import { MockStore } from '@mastra/core/storage';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import {
  CREATE_HEARTBEAT_ROUTE,
  DELETE_HEARTBEAT_ROUTE,
  GET_HEARTBEAT_ROUTE,
  LIST_AGENT_HEARTBEATS_ROUTE,
  LIST_HEARTBEATS_ROUTE,
  LIST_HEARTBEAT_TRIGGERS_ROUTE,
  PAUSE_HEARTBEAT_ROUTE,
  RESUME_HEARTBEAT_ROUTE,
  UPDATE_HEARTBEAT_ROUTE,
} from './heartbeats';
import { LIST_WORKFLOWS_ROUTE, GET_WORKFLOW_BY_ID_ROUTE } from './workflows';

const baseCtx = () => ({
  requestContext: new RequestContext(),
  abortSignal: new AbortController().signal,
});

const makeHeartbeatSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? `${HEARTBEAT_SCHEDULE_PREFIX}agent-1_thread-1`,
  ownerType: 'agent',
  ownerId: 'agent-1',
  target: {
    type: 'workflow',
    workflowId: HEARTBEAT_WORKFLOW_ID,
    inputData: {
      agentId: 'agent-1',
      scheduleId: overrides.id ?? `${HEARTBEAT_SCHEDULE_PREFIX}agent-1_thread-1`,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      prompt: 'Check in',
      mode: 'threaded',
      ...((overrides.target as any)?.inputData ?? {}),
    },
  },
  cron: '0 * * * *',
  status: 'active',
  nextFireAt: 1_000_000,
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
});

const makeTrigger = (overrides: Partial<ScheduleTrigger> = {}): ScheduleTrigger => ({
  scheduleId: `${HEARTBEAT_SCHEDULE_PREFIX}agent-1_thread-1`,
  runId: 'run-1',
  scheduledFireAt: 1_000_000,
  actualFireAt: 1_000_001,
  outcome: 'published',
  triggerKind: 'schedule-fire',
  ...overrides,
});

describe('Heartbeats handlers', () => {
  let storage: InstanceType<typeof MockStore>;
  let mastra: Mastra;
  let agent: Agent;

  beforeEach(async () => {
    storage = new MockStore();
    agent = new Agent({
      id: 'agent-1',
      name: 'agent-1',
      instructions: 'test',
      model: {} as any,
    });
    mastra = new Mastra({
      agents: { 'agent-1': agent },
      storage,
      logger: false,
    });
  });

  describe('LIST_HEARTBEATS_ROUTE', () => {
    it('returns empty list when no heartbeats exist', async () => {
      const result = await LIST_HEARTBEATS_ROUTE.handler({ mastra, ...baseCtx() } as any);
      expect(result).toEqual({ heartbeats: [] });
    });

    it('returns heartbeats across agents', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeHeartbeatSchedule());
      await schedulesStore.createSchedule(
        makeHeartbeatSchedule({
          id: `${HEARTBEAT_SCHEDULE_PREFIX}agent-2_t`,
          ownerId: 'agent-2',
          target: {
            type: 'workflow',
            workflowId: HEARTBEAT_WORKFLOW_ID,
            inputData: {
              agentId: 'agent-2',
              scheduleId: `${HEARTBEAT_SCHEDULE_PREFIX}agent-2_t`,
              prompt: 'Hi',
              mode: 'threadless',
            },
          },
        }),
      );

      const result = await LIST_HEARTBEATS_ROUTE.handler({ mastra, ...baseCtx() } as any);
      expect(result.heartbeats).toHaveLength(2);
      expect(result.heartbeats.map(h => h.agentId).sort()).toEqual(['agent-1', 'agent-2']);
    });

    it('filters by agentId', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeHeartbeatSchedule());
      await schedulesStore.createSchedule(
        makeHeartbeatSchedule({
          id: `${HEARTBEAT_SCHEDULE_PREFIX}agent-2_t`,
          ownerId: 'agent-2',
          target: {
            type: 'workflow',
            workflowId: HEARTBEAT_WORKFLOW_ID,
            inputData: {
              agentId: 'agent-2',
              scheduleId: `${HEARTBEAT_SCHEDULE_PREFIX}agent-2_t`,
              prompt: 'Hi',
              mode: 'threadless',
            },
          },
        }),
      );

      const result = await LIST_HEARTBEATS_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        ...baseCtx(),
      } as any);
      expect(result.heartbeats).toHaveLength(1);
      expect(result.heartbeats[0].agentId).toBe('agent-1');
    });

    it('excludes schedules that are not heartbeats', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeHeartbeatSchedule());
      await schedulesStore.createSchedule({
        id: 'wf_other',
        ownerType: 'agent',
        ownerId: 'agent-1',
        target: { type: 'workflow', workflowId: 'something-else' },
        cron: '0 * * * *',
        status: 'active',
        nextFireAt: 1_000_000,
        createdAt: 100,
        updatedAt: 100,
      });

      const result = await LIST_HEARTBEATS_ROUTE.handler({ mastra, ...baseCtx() } as any);
      expect(result.heartbeats).toHaveLength(1);
      expect(result.heartbeats[0].id).toMatch(/^hb_/);
    });
  });

  describe('LIST_AGENT_HEARTBEATS_ROUTE', () => {
    it('returns only the requested agent heartbeats', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule(makeHeartbeatSchedule());
      await schedulesStore.createSchedule(
        makeHeartbeatSchedule({
          id: `${HEARTBEAT_SCHEDULE_PREFIX}other`,
          ownerId: 'other',
          target: {
            type: 'workflow',
            workflowId: HEARTBEAT_WORKFLOW_ID,
            inputData: {
              agentId: 'other',
              scheduleId: `${HEARTBEAT_SCHEDULE_PREFIX}other`,
              prompt: 'x',
              mode: 'threadless',
            },
          },
        }),
      );

      const result = await LIST_AGENT_HEARTBEATS_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        ...baseCtx(),
      } as any);
      expect(result.heartbeats).toHaveLength(1);
      expect(result.heartbeats[0].agentId).toBe('agent-1');
    });
  });

  describe('GET_HEARTBEAT_ROUTE', () => {
    it('returns the heartbeat owned by the agent', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await GET_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        ...baseCtx(),
      } as any);
      expect(result.id).toBe(schedule.id);
      expect(result.agentId).toBe('agent-1');
      expect(result.threadId).toBe('thread-1');
      expect(result.prompt).toBe('Check in');
    });

    it('404s when the heartbeat does not exist', async () => {
      await expect(
        GET_HEARTBEAT_ROUTE.handler({
          mastra,
          agentId: 'agent-1',
          heartbeatId: `${HEARTBEAT_SCHEDULE_PREFIX}missing`,
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });

    it('404s when the heartbeat belongs to a different agent', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule({
        id: `${HEARTBEAT_SCHEDULE_PREFIX}foreign`,
        ownerId: 'someone-else',
        target: {
          type: 'workflow',
          workflowId: HEARTBEAT_WORKFLOW_ID,
          inputData: {
            agentId: 'someone-else',
            scheduleId: `${HEARTBEAT_SCHEDULE_PREFIX}foreign`,
            prompt: 'x',
            mode: 'threadless',
          },
        },
      });
      await schedulesStore.createSchedule(schedule);

      await expect(
        GET_HEARTBEAT_ROUTE.handler({
          mastra,
          agentId: 'agent-1',
          heartbeatId: schedule.id,
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('DELETE_HEARTBEAT_ROUTE', () => {
    it('deletes the heartbeat and removes the schedule row', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await DELETE_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        ...baseCtx(),
      } as any);

      expect(result).toEqual({ message: 'Heartbeat deleted' });
      expect(await schedulesStore.getSchedule(schedule.id)).toBeFalsy();
    });

    it('404s when the heartbeat does not exist', async () => {
      await expect(
        DELETE_HEARTBEAT_ROUTE.handler({
          mastra,
          agentId: 'agent-1',
          heartbeatId: `${HEARTBEAT_SCHEDULE_PREFIX}missing`,
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });

    it('404s when the heartbeat belongs to a different agent', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule({
        id: `${HEARTBEAT_SCHEDULE_PREFIX}foreign`,
        ownerId: 'someone-else',
        target: {
          type: 'workflow',
          workflowId: HEARTBEAT_WORKFLOW_ID,
          inputData: {
            agentId: 'someone-else',
            scheduleId: `${HEARTBEAT_SCHEDULE_PREFIX}foreign`,
            prompt: 'x',
            mode: 'threadless',
          },
        },
      });
      await schedulesStore.createSchedule(schedule);

      await expect(
        DELETE_HEARTBEAT_ROUTE.handler({
          mastra,
          agentId: 'agent-1',
          heartbeatId: schedule.id,
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);

      // schedule row still exists - foreign delete must not remove it
      expect(await schedulesStore.getSchedule(schedule.id)).toBeDefined();
    });
  });

  describe('PAUSE_HEARTBEAT_ROUTE / RESUME_HEARTBEAT_ROUTE', () => {
    it('pauses an active heartbeat and resume sets it back to active', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);

      const paused = await PAUSE_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        ...baseCtx(),
      } as any);
      expect(paused.status).toBe('paused');

      const resumed = await RESUME_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        ...baseCtx(),
      } as any);
      expect(resumed.status).toBe('active');
      // resume recomputes nextFireAt from "now" so it must move forward
      expect(resumed.nextFireAt).toBeGreaterThan(schedule.nextFireAt);
    });

    it('pause is idempotent on already-paused heartbeats', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule({ status: 'paused' });
      await schedulesStore.createSchedule(schedule);

      const result = await PAUSE_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        ...baseCtx(),
      } as any);
      expect(result.status).toBe('paused');
      expect(result.nextFireAt).toBe(schedule.nextFireAt);
    });
  });

  describe('UPDATE_HEARTBEAT_ROUTE', () => {
    it('updates prompt without touching cron/nextFireAt', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await UPDATE_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        prompt: 'New prompt',
        ...baseCtx(),
      } as any);
      expect(result.prompt).toBe('New prompt');
      expect(result.cron).toBe(schedule.cron);
      expect(result.nextFireAt).toBe(schedule.nextFireAt);
    });

    it('updates cron and recomputes nextFireAt', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);

      const result = await UPDATE_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        cron: '*/5 * * * *',
        ...baseCtx(),
      } as any);
      expect(result.cron).toBe('*/5 * * * *');
      expect(result.nextFireAt).toBeGreaterThan(schedule.nextFireAt);
    });

    it('rejects invalid cron', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);

      await expect(
        UPDATE_HEARTBEAT_ROUTE.handler({
          mastra,
          agentId: 'agent-1',
          heartbeatId: schedule.id,
          cron: 'not-a-cron',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow();
    });
  });

  describe('CREATE_HEARTBEAT_ROUTE', () => {
    it('creates a heartbeat via agent.setHeartbeat', async () => {
      const result = await CREATE_HEARTBEAT_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        cron: '0 * * * *',
        prompt: 'Hello',
        threadId: 'thread-2',
        resourceId: 'resource-2',
        ...baseCtx(),
      } as any);

      expect(result.agentId).toBe('agent-1');
      expect(result.threadId).toBe('thread-2');
      expect(result.prompt).toBe('Hello');

      const schedulesStore = (await storage.getStore('schedules'))!;
      const created = await schedulesStore.getSchedule(result.id);
      expect(created).toBeDefined();
      expect(created!.ownerId).toBe('agent-1');
    });

    it('404s when the agent does not exist', async () => {
      await expect(
        CREATE_HEARTBEAT_ROUTE.handler({
          mastra,
          agentId: 'unknown-agent',
          cron: '0 * * * *',
          prompt: 'Hello',
          ...baseCtx(),
        } as any),
      ).rejects.toThrow();
    });
  });

  describe('LIST_HEARTBEAT_TRIGGERS_ROUTE', () => {
    it('returns triggers for the heartbeat', async () => {
      const schedulesStore = (await storage.getStore('schedules'))!;
      const schedule = makeHeartbeatSchedule();
      await schedulesStore.createSchedule(schedule);
      await schedulesStore.recordTrigger(makeTrigger({ scheduleId: schedule.id }));

      const result = await LIST_HEARTBEAT_TRIGGERS_ROUTE.handler({
        mastra,
        agentId: 'agent-1',
        heartbeatId: schedule.id,
        ...baseCtx(),
      } as any);
      expect(result.triggers).toHaveLength(1);
      expect(result.triggers[0].scheduleId).toBe(schedule.id);
    });

    it('404s when the heartbeat does not exist', async () => {
      await expect(
        LIST_HEARTBEAT_TRIGGERS_ROUTE.handler({
          mastra,
          agentId: 'agent-1',
          heartbeatId: `${HEARTBEAT_SCHEDULE_PREFIX}missing`,
          ...baseCtx(),
        } as any),
      ).rejects.toThrow(HTTPException);
    });
  });
});

describe('Internal workflow filter', () => {
  // Workflows whose id starts with `__mastra_` are internal Mastra plumbing
  // (e.g. the heartbeat workflow). They must not appear on the public /workflows
  // HTTP surface — Studio surfaces them through dedicated routes instead.

  let mastra: Mastra;

  beforeEach(() => {
    const userStep = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    const userWorkflow = createWorkflow({
      id: 'user-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(userStep)
      .commit();

    const internalStep = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    const internalWorkflow = createWorkflow({
      id: '__mastra_internal__',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(internalStep)
      .commit();

    mastra = new Mastra({
      workflows: { 'user-workflow': userWorkflow, __mastra_internal__: internalWorkflow },
      logger: false,
    });
  });

  it('LIST_WORKFLOWS_ROUTE excludes internal workflow ids', async () => {
    const result = await LIST_WORKFLOWS_ROUTE.handler({ mastra, ...baseCtx() } as any);
    const ids = Object.keys(result);
    expect(ids).toContain('user-workflow');
    expect(ids).not.toContain('__mastra_internal__');
  });

  it('GET_WORKFLOW_BY_ID_ROUTE 404s for internal workflow ids', async () => {
    await expect(
      GET_WORKFLOW_BY_ID_ROUTE.handler({ mastra, workflowId: '__mastra_internal__', ...baseCtx() } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('GET_WORKFLOW_BY_ID_ROUTE still resolves user workflow ids', async () => {
    const result = await GET_WORKFLOW_BY_ID_ROUTE.handler({
      mastra,
      workflowId: 'user-workflow',
      ...baseCtx(),
    } as any);
    expect(result).toBeDefined();
  });
});
