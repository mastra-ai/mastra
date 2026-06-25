import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { Agent } from '../agent';

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

describe('Agent heartbeats — scheduler integration', () => {
  it('auto-enables the scheduler when create() is called before startWorkers()', async () => {
    const agent = makeAgent('beat');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { beat: agent },
      // Heartbeats are imperative — there is no declarative scheduled
      // workflow here. The scheduler should still come up because
      // creating a heartbeat signals that the scheduler is needed.
      // Disable the built-in notification dispatcher so the scheduler is
      // not enabled by an unrelated internal scheduled workflow.
      notifications: { dispatch: { enabled: false } },
      scheduler: { tickIntervalMs: 50 },
    });
    track(mastra);

    const hb = await mastra.heartbeats.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });
    await mastra.startWorkers();
    await waitForScheduler(mastra);

    const schedulesStore = (await storage.getStore('schedules'))!;

    const initial = (await schedulesStore.getSchedule(hb.id))!;
    await waitUntil(async () => {
      const current = await schedulesStore.getSchedule(hb.id);
      return !!current && current.nextFireAt !== initial.nextFireAt;
    });
    // HeartbeatWorker records the trigger after the agent dispatch
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
    // No scheduler should be running yet — no declarative scheduled
    // workflows, no heartbeats, no explicit enabled flag.
    expect(mastra.scheduler).toBeUndefined();

    const hb = await mastra.heartbeats.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

    // create() should have lazily injected + started the scheduler
    // and heartbeat workers via __ensureHeartbeatRuntimeReady().
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

  it('auto-starts the scheduler and heartbeat worker on boot when heartbeat schedule rows already exist in storage', async () => {
    const storage = new MockStore();

    // Boot 1: create a heartbeat, then shut down without clearing it. This
    // simulates a previous process that left a heartbeat row in storage.
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
      await mastra.heartbeats.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });
      await mastra.startWorkers();
      await waitForScheduler(mastra);
      await mastra.shutdown();
    }

    // Boot 2: fresh Mastra instance reusing the same storage. The scheduler
    // and heartbeat worker must start automatically because storage already
    // has a heartbeat row, without anyone calling create() again.
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

    // Scheduler should be running because storage has a heartbeat target.
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
    await mastra.heartbeats.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

    // Scheduler stays off because the user explicitly disabled it,
    // even though create() would normally signal "scheduler needed".
    expect(mastra.scheduler).toBeUndefined();
  });

  it('does not inject heartbeat/scheduler workers when workers are explicitly disabled', async () => {
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
    // create() still persists the heartbeat row so a standalone worker
    // can pick it up, but it must not lazily resurrect the scheduler here.
    await mastra.heartbeats.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

    expect(mastra.scheduler).toBeUndefined();
  });
});
