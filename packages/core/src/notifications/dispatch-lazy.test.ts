import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { EventEmitterPubSub } from '../events/event-emitter';
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
  it('does not start the scheduler or create a dispatcher schedule row in an idle worker', async () => {
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

    // Nothing has deferred a notification, so neither the scheduler nor the
    // dispatcher row should exist.
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

  it('wakes the scheduler in a worker process when the API process defers its first notification', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const workerMastra = track(
      new Mastra({
        logger: false,
        storage,
        pubsub,
        agents: { 'remote-defer': makeAgent('remote-defer') },
        scheduler: { tickIntervalMs: 50 },
      }),
    );
    const apiAgent = makeAgent('remote-defer', { deferBy: 60_000 });
    const apiMastra = track(
      new Mastra({
        logger: false,
        storage,
        pubsub,
        workers: false,
        scheduler: { enabled: false },
        agents: { 'remote-defer': apiAgent },
      }),
    );

    await workerMastra.startWorkers();
    await flushAsyncInit();
    expect(workerMastra.scheduler).toBeUndefined();

    const result = await apiAgent.sendNotificationSignal(
      { source: 'calendar', kind: 'event-reminder', summary: 'Planning starts tomorrow' },
      { resourceId: 'user-1', threadId: 'thread-1' },
    );
    expect(result.decision.action).toBe('defer');

    // Local scheduler opt-outs must not prevent a separate worker from waking.
    await waitForScheduler(workerMastra);
    expect(apiMastra.scheduler).toBeUndefined();
  });

  it('starts the scheduler on boot when a dispatcher row was left behind and a deferred notification is pending', async () => {
    const storage = new MockStore();
    const schedulesStore = (await storage.getStore('schedules'))!;
    // Simulate a previous process that lazily created the dispatcher row and
    // deferred a notification that has not been delivered yet.
    await schedulesStore.createSchedule(buildNotificationDispatchSchedule());
    const notifications = (await storage.getStore('notifications'))!;
    await notifications.createNotification({
      source: 'calendar',
      kind: 'event-reminder',
      summary: 'Planning starts tomorrow',
      agentId: 'fresh',
      resourceId: 'user-1',
      threadId: 'thread-1',
      deliverAt: new Date(Date.now() + 60_000),
    });

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

  it('does not start the scheduler on boot for a leftover dispatcher row when nothing is pending', async () => {
    const storage = new MockStore();
    const schedulesStore = (await storage.getStore('schedules'))!;
    // An app that deferred a notification once, on an older version, and
    // delivered it long ago. The row is all that is left.
    await schedulesStore.createSchedule(buildNotificationDispatchSchedule());
    const notifications = (await storage.getStore('notifications'))!;
    const delivered = await notifications.createNotification({
      source: 'calendar',
      kind: 'event-reminder',
      summary: 'Delivered long ago',
      agentId: 'fresh',
      resourceId: 'user-1',
      threadId: 'thread-1',
      deliverAt: new Date(Date.now() - 60_000),
    });
    await notifications.updateNotification({ id: delivered.id, threadId: 'thread-1', status: 'delivered' });
    // Pending, but with no due time: no dispatch pass would ever pick it up.
    await notifications.createNotification({
      source: 'calendar',
      kind: 'event-reminder',
      summary: 'Persisted for the inbox',
      agentId: 'fresh',
      resourceId: 'user-1',
      threadId: 'thread-1',
    });
    const listDueSpy = vi.spyOn(schedulesStore, 'listDueSchedules');

    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { fresh: makeAgent('fresh') },
        scheduler: { tickIntervalMs: 50 },
      }),
    );

    await mastra.startWorkers();
    await flushAsyncInit();
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(mastra.scheduler).toBeUndefined();
    expect(listDueSpy).not.toHaveBeenCalled();
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

describe('notification dispatch — cron stops once nothing is pending', () => {
  async function sendDeferred(agent: Agent, summary: string) {
    const result = await agent.sendNotificationSignal(
      { source: 'calendar', kind: 'event-reminder', summary },
      { resourceId: 'user-1', threadId: 'thread-1' },
    );
    expect(result.decision.action).toBe('defer');
    return result.record;
  }

  async function waitDelivered(storage: MockStore, id: string) {
    const notifications = (await storage.getStore('notifications'))!;
    await waitUntil(async () => {
      const record = await notifications.getNotification({ threadId: 'thread-1', id });
      return record?.status === 'delivered';
    }, 10_000);
  }

  it('deletes the dispatcher row after delivering the last pending notification', async () => {
    const storage = new MockStore();
    const agent = makeAgent('drain-agent', { deferBy: 250 });
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { 'drain-agent': agent },
        notifications: { dispatch: { cron: '* * * * * *' } },
        scheduler: { tickIntervalMs: 50 },
      }),
    );
    const schedulesStore = (await storage.getStore('schedules'))!;

    await mastra.startWorkers();
    const record = await sendDeferred(agent, 'Planning starts tomorrow');
    await waitForScheduler(mastra);
    await waitDelivered(storage, record.id);

    await waitUntil(async () => (await schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)) === null);
  }, 15_000);

  it('re-arms the dispatcher on the next deferral after it stopped', async () => {
    const storage = new MockStore();
    const agent = makeAgent('rearm-agent', { deferBy: 250 });
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { 'rearm-agent': agent },
        notifications: { dispatch: { cron: '* * * * * *' } },
        scheduler: { tickIntervalMs: 50 },
      }),
    );
    const schedulesStore = (await storage.getStore('schedules'))!;

    await mastra.startWorkers();
    const first = await sendDeferred(agent, 'First reminder');
    await waitDelivered(storage, first.id);
    await waitUntil(async () => (await schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)) === null);

    const second = await sendDeferred(agent, 'Second reminder');
    await expect(schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)).resolves.not.toBeNull();
    await waitDelivered(storage, second.id);
  }, 20_000);

  it('keeps the dispatcher row while a deferred notification is still pending', async () => {
    const storage = new MockStore();
    const agent = makeAgent('pending-agent', { deferBy: 60 * 60_000 });
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        agents: { 'pending-agent': agent },
        notifications: { dispatch: { cron: '* * * * * *' } },
        scheduler: { tickIntervalMs: 50 },
      }),
    );
    const schedulesStore = (await storage.getStore('schedules'))!;

    await mastra.startWorkers();
    await sendDeferred(agent, 'Due in an hour');
    const before = (await schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID))!;

    // Let at least one dispatch pass run; the record isn't due, so the row stays.
    await waitUntil(async () => {
      const row = await schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID);
      return row !== null && row.nextFireAt > before.nextFireAt;
    }, 5_000);
    await new Promise(resolve => setTimeout(resolve, 300));
    await expect(schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)).resolves.not.toBeNull();
  }, 10_000);

  it('re-creates the row when a deferral lands while the idle dispatcher is deleting it', async () => {
    const storage = new MockStore();
    const mastra = track(new Mastra({ logger: false, storage }));
    const schedulesStore = (await storage.getStore('schedules'))!;
    const notifications = (await storage.getStore('notifications'))!;
    await schedulesStore.createSchedule(buildNotificationDispatchSchedule());

    // Another process defers a notification after the dispatcher found
    // nothing pending, but before its delete lands. That process saw the row,
    // so it won't re-create it.
    const deleteSchedule = schedulesStore.deleteSchedule.bind(schedulesStore);
    vi.spyOn(schedulesStore, 'deleteSchedule').mockImplementation(async id => {
      await notifications.createNotification({
        source: 'calendar',
        kind: 'event-reminder',
        summary: 'Deferred concurrently',
        agentId: 'elsewhere',
        resourceId: 'user-1',
        threadId: 'thread-1',
        deliverAt: new Date(Date.now() + 60_000),
      });
      await deleteSchedule(id);
    });

    await mastra.__releaseNotificationDispatchIfIdle();

    expect(schedulesStore.deleteSchedule).toHaveBeenCalledOnce();
    await expect(schedulesStore.getSchedule(NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID)).resolves.not.toBeNull();
  });
});
