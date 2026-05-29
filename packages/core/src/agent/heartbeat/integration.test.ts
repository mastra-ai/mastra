import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { Agent } from '../agent';
import { HEARTBEAT_SCHEDULE_PREFIX } from './types';

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
  it('auto-enables the scheduler when setHeartbeat() is called before startWorkers()', async () => {
    const agent = makeAgent('beat');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { beat: agent },
      // Heartbeats are imperative — there is no declarative scheduled
      // workflow here. The scheduler should still come up because
      // setHeartbeat() registers the built-in heartbeat workflow, which
      // signals that the scheduler is needed.
      scheduler: { tickIntervalMs: 50 },
    });

    await agent.setHeartbeat({ cron: '* * * * * *', prompt: 'ping' });
    await mastra.startWorkers();
    await waitForScheduler(mastra);

    const schedulesStore = (await storage.getStore('schedules'))!;
    const scheduleId = `${HEARTBEAT_SCHEDULE_PREFIX}beat`;

    const initial = (await schedulesStore.getSchedule(scheduleId))!;
    await waitUntil(async () => {
      const current = await schedulesStore.getSchedule(scheduleId);
      return !!current && current.nextFireAt !== initial.nextFireAt;
    });
    // HeartbeatWorker records the trigger after the agent dispatch
    // completes, which races with nextFireAt advancement in the scheduler.
    await waitUntil(async () => {
      const t = await schedulesStore.listTriggers(scheduleId);
      return t.length > 0;
    });

    const triggers = await schedulesStore.listTriggers(scheduleId);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0]!.outcome).toBe('published');

    await mastra.shutdown();
  }, 10_000);

  it('lazily injects + starts the scheduler when setHeartbeat() is called after startWorkers()', async () => {
    const agent = makeAgent('beat-late');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-late': agent },
      scheduler: { tickIntervalMs: 50 },
    });

    await mastra.startWorkers();
    // No scheduler should be running yet — no declarative scheduled
    // workflows, no heartbeats, no explicit enabled flag.
    expect(mastra.scheduler).toBeUndefined();

    await agent.setHeartbeat({ cron: '* * * * * *', prompt: 'ping' });

    // setHeartbeat() should have lazily injected + started the scheduler
    // and heartbeat workers via __ensureHeartbeatRuntimeReady().
    await waitForScheduler(mastra);

    const schedulesStore = (await storage.getStore('schedules'))!;
    const scheduleId = `${HEARTBEAT_SCHEDULE_PREFIX}beat-late`;

    const initial = (await schedulesStore.getSchedule(scheduleId))!;
    await waitUntil(async () => {
      const current = await schedulesStore.getSchedule(scheduleId);
      return !!current && current.nextFireAt !== initial.nextFireAt;
    });
    await waitUntil(async () => {
      const t = await schedulesStore.listTriggers(scheduleId);
      return t.length > 0;
    });

    const triggers = await schedulesStore.listTriggers(scheduleId);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0]!.outcome).toBe('published');

    await mastra.shutdown();
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
        scheduler: { tickIntervalMs: 50 },
      });
      await agent.setHeartbeat({ cron: '* * * * * *', prompt: 'ping' });
      await mastra.startWorkers();
      await waitForScheduler(mastra);
      await mastra.shutdown();
    }

    // Boot 2: fresh Mastra instance reusing the same storage. The scheduler
    // and heartbeat worker must start automatically because storage already
    // has a heartbeat row, without anyone calling setHeartbeat() again.
    const agent2 = makeAgent('beat-rehydrate');
    const mastra2 = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-rehydrate': agent2 },
      scheduler: { tickIntervalMs: 50 },
    });

    await mastra2.startWorkers();

    // Scheduler should be running because storage has a heartbeat target.
    await waitForScheduler(mastra2);

    await mastra2.shutdown();
  }, 10_000);

  it('does not start the scheduler when scheduler is explicitly disabled', async () => {
    const agent = makeAgent('beat-off');
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-off': agent },
      scheduler: { enabled: false },
    });

    await mastra.startWorkers();
    await agent.setHeartbeat({ cron: '* * * * * *', prompt: 'ping' });

    // Scheduler stays off because the user explicitly disabled it,
    // even though setHeartbeat() would normally signal "scheduler needed".
    expect(mastra.scheduler).toBeUndefined();

    await mastra.shutdown();
  });
});
