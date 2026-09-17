import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent/agent';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { SchedulerWorker } from '../worker/workers/scheduler-worker';

const SCHEDULER_WAKE_TOPIC = 'scheduler';
const SCHEDULER_WAKE_EVENT = 'scheduler.wake';

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

function makeAgent(id: string): Agent {
  return new Agent({
    id,
    name: id,
    instructions: 'test',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        text: 'ok',
        content: [{ type: 'text', text: 'ok' }],
        warnings: [],
      }),
    }),
  });
}

describe('Agent schedules — scheduler integration', () => {
  it('auto-enables the scheduler when create() is called before startWorkers()', async () => {
    const agent = makeAgent('beat');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { beat: agent },
      // Schedules are imperative — there is no declarative scheduled
      // workflow here. The scheduler should still come up because
      // creating a schedule signals that the scheduler is needed.
      // Disable the built-in notification dispatcher so the scheduler is
      // not enabled by an unrelated internal scheduled workflow.
      notifications: { dispatch: { enabled: false } },
      scheduler: { tickIntervalMs: 50 },
    });
    track(mastra);

    const hb = await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });
    await mastra.startWorkers();
    await waitForScheduler(mastra);

    const schedulesStore = (await storage.getStore('schedules'))!;

    const initial = (await schedulesStore.getSchedule(hb.id))!;
    await waitUntil(async () => {
      const current = await schedulesStore.getSchedule(hb.id);
      return !!current && current.nextFireAt !== initial.nextFireAt;
    });
    // AgentScheduleWorker records the trigger after the agent dispatch
    // completes, which races with nextFireAt advancement in the scheduler.
    await waitUntil(async () => {
      const t = await schedulesStore.listTriggers(hb.id);
      return t.length > 0;
    });

    const triggers = await schedulesStore.listTriggers(hb.id);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0]!.outcome).toBe('succeeded');
  }, 10_000);

  it('lazily injects + starts the scheduler when create() is called after startWorkers()', async () => {
    const agent = makeAgent('beat-late');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-late': agent },
      notifications: { dispatch: { enabled: false } },
      scheduler: { tickIntervalMs: 50 },
    });
    track(mastra);

    await mastra.startWorkers();
    expect(mastra.scheduler).toBeUndefined();

    const hb = await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });
    await waitForScheduler(mastra);

    const schedulesStore = (await storage.getStore('schedules'))!;

    const initial = (await schedulesStore.getSchedule(hb.id))!;
    await waitUntil(async () => {
      const current = await schedulesStore.getSchedule(hb.id);
      return !!current && current.nextFireAt !== initial.nextFireAt;
    });
    await waitUntil(async () => {
      const t = await schedulesStore.listTriggers(hb.id);
      return t.length > 0;
    });

    const triggers = await schedulesStore.listTriggers(hb.id);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0]!.outcome).toBe('succeeded');
  }, 10_000);

  describe('standalone worker in another process', () => {
    // Models a split deployment: an API process with `workers: false` and a
    // worker process, sharing storage. The worker boots with an empty
    // schedules table, so it must not poll; it learns about the schedule the
    // API creates later through the wake event on the shared pubsub.
    function makeSplitDeployment(options: { sharedPubSub: boolean; workerSchedulerEnabled?: boolean }) {
      const storage = new MockStore();
      const pubsub = options.sharedPubSub ? new EventEmitterPubSub() : undefined;
      const workerMastra = track(
        new Mastra({
          logger: false,
          storage,
          pubsub,
          agents: { 'beat-remote': makeAgent('beat-remote') },
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 50, enabled: options.workerSchedulerEnabled },
        }),
      );
      const apiAgent = makeAgent('beat-remote');
      const apiMastra = track(
        new Mastra({
          logger: false,
          storage,
          pubsub,
          agents: { 'beat-remote': apiAgent },
          workers: false,
          notifications: { dispatch: { enabled: false } },
        }),
      );
      return { storage, workerMastra, apiMastra, apiAgent };
    }

    it('wakes the worker scheduler through the shared pubsub and fires the schedule', async () => {
      const { storage, workerMastra, apiMastra, apiAgent } = makeSplitDeployment({ sharedPubSub: true });
      const schedulesStore = (await storage.getStore('schedules'))!;
      const listDueSpy = vi.spyOn(schedulesStore, 'listDueSchedules');

      await workerMastra.startWorkers();
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(workerMastra.scheduler).toBeUndefined();
      expect(listDueSpy).not.toHaveBeenCalled();

      const schedule = await apiMastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: apiAgent.id });
      expect(apiMastra.scheduler).toBeUndefined();
      await waitForScheduler(workerMastra);

      await waitUntil(async () => (await schedulesStore.listTriggers(schedule.id)).length > 0);
      const triggers = await schedulesStore.listTriggers(schedule.id);
      expect(triggers[0]!.outcome).toBe('succeeded');
    }, 10_000);

    it('does not discover the schedule without a shared pubsub', async () => {
      const { workerMastra, apiMastra, apiAgent } = makeSplitDeployment({ sharedPubSub: false });

      await workerMastra.startWorkers();
      await apiMastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: apiAgent.id });
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(workerMastra.scheduler).toBeUndefined();
    });

    it('fires the schedule without a shared pubsub when the worker opts in with scheduler.enabled', async () => {
      const { storage, workerMastra, apiMastra, apiAgent } = makeSplitDeployment({
        sharedPubSub: false,
        workerSchedulerEnabled: true,
      });

      await workerMastra.startWorkers();
      await waitForScheduler(workerMastra);

      const schedule = await apiMastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: apiAgent.id });
      const schedulesStore = (await storage.getStore('schedules'))!;
      await waitUntil(async () => (await schedulesStore.listTriggers(schedule.id)).length > 0);
      const triggers = await schedulesStore.listTriggers(schedule.id);
      expect(triggers[0]!.outcome).toBe('succeeded');
    }, 10_000);

    it('drops the wake subscription once the scheduler is running and on stopWorkers()', async () => {
      const pubsub = new EventEmitterPubSub();
      const subscribe = vi.spyOn(pubsub, 'subscribe');
      const unsubscribe = vi.spyOn(pubsub, 'unsubscribe');
      const agent = makeAgent('beat-unsub');
      const mastra = track(
        new Mastra({
          logger: false,
          storage: new MockStore(),
          pubsub,
          agents: { 'beat-unsub': agent },
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 50 },
        }),
      );

      await mastra.startWorkers();
      expect(subscribe).toHaveBeenCalledWith(SCHEDULER_WAKE_TOPIC, expect.any(Function), {
        startFrom: 'latest',
      });
      const wakeCb = subscribe.mock.calls.find(([topic]) => topic === SCHEDULER_WAKE_TOPIC)![1];

      const ack = vi.fn(async () => {});
      await wakeCb(
        {
          id: 'wake-1',
          type: SCHEDULER_WAKE_EVENT,
          runId: 'remote-schedule',
          data: {},
          createdAt: new Date(),
        },
        ack,
      );
      await waitForScheduler(mastra);
      expect(ack).toHaveBeenCalledOnce();
      expect(unsubscribe).toHaveBeenCalledWith(SCHEDULER_WAKE_TOPIC, wakeCb);

      const wakeCalls = (spy: typeof subscribe) => spy.mock.calls.filter(([topic]) => topic === SCHEDULER_WAKE_TOPIC);

      // A second startWorkers() with the scheduler already running must not
      // re-subscribe, and stopWorkers() must not unsubscribe twice.
      await mastra.startWorkers();
      expect(wakeCalls(subscribe)).toHaveLength(1);
      await mastra.stopWorkers();
      expect(wakeCalls(unsubscribe)).toHaveLength(1);

      // stop → start: the scheduler worker object survives and is restarted by
      // the regular start loop. Boot re-subscribes (scheduler not running yet)
      // and must unwire again once it is, leaving no dangling subscription.
      await mastra.startWorkers();
      await waitForScheduler(mastra);
      expect(mastra.workers.filter(w => w.name === 'scheduler')).toHaveLength(1);
      expect(wakeCalls(subscribe)).toHaveLength(2);
      expect(wakeCalls(unsubscribe)).toHaveLength(2);
    }, 10_000);

    it('still boots the other workers and the boot probe when the wake subscribe fails', async () => {
      const pubsub = new EventEmitterPubSub();
      const originalSubscribe = pubsub.subscribe.bind(pubsub);
      vi.spyOn(pubsub, 'subscribe').mockImplementation(async (topic, cb, options) => {
        if (topic === SCHEDULER_WAKE_TOPIC) throw new Error('broker unavailable');
        return originalSubscribe(topic, cb, options);
      });
      const storage = new MockStore();
      const schedulesStore = (await storage.getStore('schedules'))!;
      await schedulesStore.createSchedule({
        id: 'schedule_pre-existing',
        target: { type: 'workflow', workflowId: 'some-wf' },
        cron: '0 0 1 1 *',
        status: 'active',
        nextFireAt: Date.now() + 3_600_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const mastra = track(
        new Mastra({
          logger: false,
          storage,
          pubsub,
          agents: { 'beat-nosub': makeAgent('beat-nosub') },
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 50 },
        }),
      );

      // The wake subscription is a hint, not a dependency: a failure must not
      // keep orchestration (or anything else) from starting.
      await expect(mastra.startWorkers()).resolves.toBeUndefined();
      expect(mastra.workers.find(w => w.name === 'orchestration')?.isRunning).toBe(true);

      // The durable path still works: the boot probe found the row.
      await waitForScheduler(mastra);
      expect(mastra.scheduler).toBeDefined();
    });

    it('does not leave a scheduler running when wake-triggered startup races stopWorkers()', async () => {
      const pubsub = new EventEmitterPubSub();
      const mastra = track(
        new Mastra({
          logger: false,
          storage: new MockStore(),
          pubsub,
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 50 },
        }),
      );
      await mastra.startWorkers();

      let startEntered!: () => void;
      let releaseStart!: () => void;
      const entered = new Promise<void>(resolve => (startEntered = resolve));
      const blocked = new Promise<void>(resolve => (releaseStart = resolve));
      const originalStart = SchedulerWorker.prototype.start;
      const startSpy = vi.spyOn(SchedulerWorker.prototype, 'start').mockImplementation(async function () {
        startEntered();
        await blocked;
        return originalStart.call(this);
      });

      try {
        await pubsub.publish(SCHEDULER_WAKE_TOPIC, { type: SCHEDULER_WAKE_EVENT, runId: 'remote', data: {} });
        await entered;
        const stopping = mastra.stopWorkers();
        releaseStart();
        await stopping;

        expect(mastra.scheduler?.isRunning).toBe(false);
      } finally {
        releaseStart();
        startSpy.mockRestore();
      }
    });

    it('nacks a failed wake startup and retries the existing stopped worker', async () => {
      const pubsub = new EventEmitterPubSub();
      const subscribe = vi.spyOn(pubsub, 'subscribe');
      const mastra = track(
        new Mastra({
          logger: false,
          storage: new MockStore(),
          pubsub,
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 50 },
        }),
      );
      await mastra.startWorkers();
      const wakeCb = subscribe.mock.calls.find(([topic]) => topic === SCHEDULER_WAKE_TOPIC)![1];
      const startSpy = vi.spyOn(SchedulerWorker.prototype, 'start').mockRejectedValueOnce(new Error('transient start'));
      const ack = vi.fn(async () => {});
      const nack = vi.fn(async () => {});
      const event = {
        id: 'wake-retry',
        type: SCHEDULER_WAKE_EVENT,
        runId: 'remote-schedule',
        data: {},
        createdAt: new Date(),
      };

      try {
        await wakeCb(event, ack, nack);
        expect(nack).toHaveBeenCalledOnce();
        expect(ack).not.toHaveBeenCalled();
        expect(mastra.scheduler?.isRunning).toBe(false);

        await wakeCb(event, ack, nack);
        await waitForScheduler(mastra);
        expect(ack).toHaveBeenCalledOnce();
        expect(mastra.workers.filter(w => w.name === 'scheduler')).toHaveLength(1);
      } finally {
        startSpy.mockRestore();
      }
    });

    it('honors a wake event that arrives while startWorkers() is still booting', async () => {
      const { storage, workerMastra, apiMastra, apiAgent } = makeSplitDeployment({ sharedPubSub: true });
      const schedulesStore = (await storage.getStore('schedules'))!;

      // Stall the worker's boot probe so the API's create() lands after the
      // probe started (and saw an empty table) but before boot finished.
      let releaseProbe!: () => void;
      const probeStalled = new Promise<void>(resolve => (releaseProbe = resolve));
      const realList = schedulesStore.listSchedules.bind(schedulesStore);
      vi.spyOn(schedulesStore, 'listSchedules').mockImplementationOnce(async (...args) => {
        const rows = await realList(...args);
        await probeStalled;
        return rows;
      });

      const booting = workerMastra.startWorkers();
      // Wait until the probe is in flight (it runs after the subscription).
      await waitUntil(() => vi.mocked(schedulesStore.listSchedules).mock.calls.length > 0);
      const schedule = await apiMastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: apiAgent.id });
      releaseProbe();
      await booting;

      // The end-of-boot re-check must have started the scheduler exactly once.
      await waitForScheduler(workerMastra);
      expect(workerMastra.workers.filter(w => w.name === 'scheduler')).toHaveLength(1);
      expect(workerMastra.workers.filter(w => w.name === 'agent-schedule')).toHaveLength(1);
      await waitUntil(async () => (await schedulesStore.listTriggers(schedule.id)).length > 0);
    }, 10_000);

    it('publishes the wake only after the row is written, and survives a pubsub failure', async () => {
      const pubsub = new EventEmitterPubSub();
      const storage = new MockStore();
      const schedulesStore = (await storage.getStore('schedules'))!;
      const order: string[] = [];
      const createSchedule = schedulesStore.createSchedule.bind(schedulesStore);
      vi.spyOn(schedulesStore, 'createSchedule').mockImplementation(async schedule => {
        order.push('createSchedule');
        return createSchedule(schedule);
      });
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic: string) => {
        if (topic === SCHEDULER_WAKE_TOPIC) {
          order.push('publish');
          throw new Error('pubsub down');
        }
      });
      const agent = makeAgent('beat-order');
      const mastra = track(
        new Mastra({
          logger: false,
          storage,
          pubsub,
          workers: false,
          agents: { 'beat-order': agent },
          notifications: { dispatch: { enabled: false } },
        }),
      );

      const created = await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

      expect(order).toEqual(['createSchedule', 'publish']);
      expect(pubsub.publish).toHaveBeenCalledWith(
        SCHEDULER_WAKE_TOPIC,
        expect.objectContaining({ type: SCHEDULER_WAKE_EVENT, runId: created.id }),
      );
      await expect(schedulesStore.getSchedule(created.id)).resolves.not.toBeNull();
    });

    it('does not start polling when persisting a schedule fails', async () => {
      const storage = new MockStore();
      const schedulesStore = (await storage.getStore('schedules'))!;
      vi.spyOn(schedulesStore, 'createSchedule').mockRejectedValueOnce(new Error('storage unavailable'));
      const agent = makeAgent('beat-create-failure');
      const mastra = track(
        new Mastra({
          logger: false,
          storage,
          agents: { 'beat-create-failure': agent },
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 20 },
        }),
      );
      await mastra.startWorkers();

      await expect(mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id })).rejects.toThrow(
        'storage unavailable',
      );
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mastra.scheduler).toBeUndefined();
    });

    it('starts a single scheduler when a wake event races a local create()', async () => {
      const pubsub = new EventEmitterPubSub();
      const agent = makeAgent('beat-race');
      const mastra = track(
        new Mastra({
          logger: false,
          storage: new MockStore(),
          pubsub,
          agents: { 'beat-race': agent },
          notifications: { dispatch: { enabled: false } },
          scheduler: { tickIntervalMs: 50 },
        }),
      );

      await mastra.startWorkers();
      expect(mastra.scheduler).toBeUndefined();

      await Promise.all([
        pubsub.publish(SCHEDULER_WAKE_TOPIC, { type: SCHEDULER_WAKE_EVENT, runId: 'remote', data: {} }),
        mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id }),
      ]);
      await waitForScheduler(mastra);

      expect(mastra.workers.filter(w => w.name === 'scheduler')).toHaveLength(1);
      expect(mastra.workers.filter(w => w.name === 'agent-schedule')).toHaveLength(1);
    }, 10_000);
  });

  it('does not start duplicate scheduling workers when create() is called concurrently after startWorkers()', async () => {
    const agent = makeAgent('beat-concurrent');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-concurrent': agent },
      notifications: { dispatch: { enabled: false } },
      scheduler: { tickIntervalMs: 50 },
    });
    track(mastra);

    await mastra.startWorkers();
    expect(mastra.scheduler).toBeUndefined();

    // Both create() calls race through __ensureScheduleRuntimeReady(); the
    // in-flight startup promise must serialize them so only one scheduler
    // and one agent-schedule worker are ever injected.
    await Promise.all([
      mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id }),
      mastra.schedules.create({ cron: '* * * * * *', prompt: 'pong', agentId: agent.id }),
    ]);

    await waitForScheduler(mastra);

    expect(mastra.workers.filter(w => w.name === 'scheduler')).toHaveLength(1);
    expect(mastra.workers.filter(w => w.name === 'agent-schedule')).toHaveLength(1);
  }, 10_000);

  it('auto-starts the scheduler and agent-schedule worker on boot when agent-schedule rows already exist in storage', async () => {
    const storage = new MockStore();

    // Boot 1: create a schedule, then shut down without clearing it. This
    // simulates a previous process that left a schedule row in storage.
    {
      const agent = makeAgent('beat-rehydrate');
      const mastra = new Mastra({
        logger: false,
        storage,
        agents: { 'beat-rehydrate': agent },
        notifications: { dispatch: { enabled: false } },
        scheduler: { tickIntervalMs: 50 },
      });
      track(mastra);
      await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });
      await mastra.startWorkers();
      await waitForScheduler(mastra);
      await mastra.shutdown();
    }

    // Boot 2: fresh Mastra instance reusing the same storage. The scheduler
    // and agent-schedule worker must start automatically because storage already
    // has a schedule row, without anyone calling create() again.
    const agent2 = makeAgent('beat-rehydrate');
    const mastra2 = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-rehydrate': agent2 },
      notifications: { dispatch: { enabled: false } },
      scheduler: { tickIntervalMs: 50 },
    });
    track(mastra2);

    await mastra2.startWorkers();

    // Scheduler should be running because storage has an agent-schedule target.
    await waitForScheduler(mastra2);
  }, 10_000);

  it('does not start the scheduler when scheduler is explicitly disabled', async () => {
    const agent = makeAgent('beat-off');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-off': agent },
      notifications: { dispatch: { enabled: false } },
      scheduler: { enabled: false },
    });
    track(mastra);

    await mastra.startWorkers();
    await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

    // Scheduler stays off because the user explicitly disabled it,
    // even though create() would normally signal "scheduler needed".
    expect(mastra.scheduler).toBeUndefined();
  });

  it('does not inject agent-schedule/scheduler workers when workers are explicitly disabled', async () => {
    const agent = makeAgent('beat-no-workers');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-no-workers': agent },
      notifications: { dispatch: { enabled: false } },
      // The user opted out of all event processing in this instance.
      // A separate standalone worker is expected to run the scheduler.
      workers: false,
    });
    track(mastra);

    await mastra.startWorkers();
    // create() still persists the schedule row so a standalone worker
    // can pick it up, but it must not lazily resurrect the scheduler here.
    await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

    expect(mastra.scheduler).toBeUndefined();
  });
});
