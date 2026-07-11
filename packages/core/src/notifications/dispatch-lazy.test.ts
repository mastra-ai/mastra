import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows/evented';
import { NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID, buildNotificationDispatchSchedule } from './workflow';

// Track every Mastra instance created in a test so it is always shut down,
// even if an assertion throws before the test reaches its own shutdown call.
const activeInstances: Mastra[] = [];
function track(mastra: Mastra): Mastra {
  activeInstances.push(mastra);
  return mastra;
}
afterEach(async () => {
  const instances = activeInstances.splice(0, activeInstances.length);
  await Promise.all(instances.map(m => m.shutdown().catch(() => {})));
});

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 25,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitUntil predicate did not become true within ${timeoutMs}ms`);
}

async function waitForScheduler(mastra: Mastra): Promise<void> {
  await waitUntil(() => mastra.scheduler?.isRunning === true);
}

/** Drain a few macrotask turns so pending async init settles (negative asserts). */
async function flushAsyncInit(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
}

function makeAgent(id: string, options?: { deferBy?: number }): Agent {
  return new Agent({
    id,
    name: id,
    instructions: 'test',
    model: new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'ok' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      }),
    }),
    ...(options?.deferBy !== undefined
      ? {
          notifications: {
            deliveryPolicy: {
              decide: () => ({
                action: 'defer' as const,
                deliverAt: new Date(Date.now() + options.deferBy!),
                reason: 'test-defer',
              }),
            },
          },
        }
      : {}),
  });
}

describe('notification dispatch — lazy scheduler activation (#18864)', () => {
  it('does not start the scheduler or create a dispatcher schedule row in an idle app', async () => {
    const storage = new MockStore();
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { idle: makeAgent('idle') },
        scheduler: { tickIntervalMs: 50 },
      }),
    );

    const schedulesStore = (await storage.getStore('schedules'))!;
    const listDueSpy = vi.spyOn(schedulesStore, 'listDueSchedules');

    await mastra.startWorkers();
    await flushAsyncInit();

    // No notifications were used, so nothing may request the scheduler —
    // this is the scale-to-zero guarantee for serverless apps.
    expect(mastra.scheduler).toBeUndefined();
    await expect(schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)).resolves.toBeNull();

    // The reported symptom: constant `listDueSchedules` polling. Give a poll
    // window a chance to elapse and assert storage was never polled.
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(listDueSpy).not.toHaveBeenCalled();
  });

  it('lazily creates the dispatcher schedule row and starts the scheduler on the first deferred notification', async () => {
    const storage = new MockStore();
    const agent = makeAgent('defer-agent', { deferBy: 250 });
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { 'defer-agent': agent },
        notifications: { dispatch: { cron: '* * * * * *' } },
        scheduler: { tickIntervalMs: 50 },
      }),
    );

    await mastra.startWorkers();
    await flushAsyncInit();
    expect(mastra.scheduler).toBeUndefined();

    const result = await agent.sendNotificationSignal(
      { source: 'calendar', kind: 'event-reminder', summary: 'Planning starts tomorrow' },
      { resourceId: 'user-1', threadId: 'thread-1' },
    );
    expect(result.decision.action).toBe('defer');

    // The deferred notification must have activated the scheduler and
    // upserted the imperative dispatcher schedule row.
    await waitForScheduler(mastra);
    const schedulesStore = (await storage.getStore('schedules'))!;
    const row = (await schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID))!;
    expect(row).toMatchObject({
      cron: '* * * * * *',
      target: { type: 'workflow', workflowId: '__mastra_notification_dispatcher' },
      metadata: { internal: true, feature: 'notifications' },
    });

    // Once due, the dispatcher workflow delivers the deferred notification.
    const notifications = (await storage.getStore('notifications'))!;
    await waitUntil(async () => {
      const record = await notifications.getNotification({ threadId: 'thread-1', id: result.record.id });
      return record?.status === 'delivered';
    }, 10_000);
  }, 15_000);

  it('starts the scheduler on boot when a dispatcher schedule row was persisted by a previous process', async () => {
    const storage = new MockStore();
    const schedulesStore = (await storage.getStore('schedules'))!;
    // Simulate a previous process that lazily created the dispatcher row.
    await schedulesStore.createSchedule(buildNotificationDispatchSchedule());

    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { fresh: makeAgent('fresh') },
        scheduler: { tickIntervalMs: 50 },
      }),
    );

    await mastra.startWorkers();
    await waitForScheduler(mastra);
  });

  it('does not create the row or start the scheduler when dispatch is disabled, even after a deferred notification', async () => {
    const storage = new MockStore();
    const agent = makeAgent('opt-out-agent', { deferBy: 60_000 });
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { 'opt-out-agent': agent },
        notifications: { dispatch: { enabled: false } },
        scheduler: { tickIntervalMs: 50 },
      }),
    );

    await mastra.startWorkers();
    const result = await agent.sendNotificationSignal(
      { source: 'calendar', kind: 'event-reminder', summary: 'Planning starts tomorrow' },
      { resourceId: 'user-1', threadId: 'thread-1' },
    );
    expect(result.decision.action).toBe('defer');
    await flushAsyncInit();

    expect(mastra.scheduler).toBeUndefined();
    const schedulesStore = (await storage.getStore('schedules'))!;
    await expect(schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)).resolves.toBeNull();
  });

  it('orphan-deletes the stale declarative dispatcher row from core 1.39–1.41 when a scheduler runs', async () => {
    const storage = new MockStore();
    const schedulesStore = (await storage.getStore('schedules'))!;
    // Row shape left behind by the old eager declarative registration.
    const now = Date.now();
    await schedulesStore.createSchedule({
      id: 'wf___mastra_notification_dispatcher__dispatch',
      target: { type: 'workflow', workflowId: '__mastra_notification_dispatcher', inputData: { limit: 100 } },
      cron: '*/1 * * * *',
      status: 'active',
      nextFireAt: now + 60_000,
      createdAt: now,
      updatedAt: now,
      metadata: { internal: true, feature: 'notifications' },
    });

    // A user workflow with a declarative schedule makes the scheduler run,
    // which triggers declarative-schedule sync + orphan cleanup.
    const wf = createWorkflow({
      id: 'user-scheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: { cron: '*/5 * * * *' },
    });
    wf.then(
      createStep({
        id: 'noop',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      }) as any,
    ).commit();

    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        workflows: { wf } as any,
        scheduler: { tickIntervalMs: 50 },
      }),
    );

    await mastra.startWorkers();
    await waitForScheduler(mastra);

    await waitUntil(
      async () => (await schedulesStore.getSchedule('wf___mastra_notification_dispatcher__dispatch')) === null,
    );
    // The user's own declarative row must survive.
    await expect(schedulesStore.getSchedule('wf_user-scheduled-wf')).resolves.not.toBeNull();
  });
});
