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

    // setHeartbeat() should have lazily injected + started a scheduler
    // worker as part of __ensureHeartbeatWorkflowRegistered().
    await waitForScheduler(mastra);

    const schedulesStore = (await storage.getStore('schedules'))!;
    const scheduleId = `${HEARTBEAT_SCHEDULE_PREFIX}beat-late`;

    const initial = (await schedulesStore.getSchedule(scheduleId))!;
    await waitUntil(async () => {
      const current = await schedulesStore.getSchedule(scheduleId);
      return !!current && current.nextFireAt !== initial.nextFireAt;
    });

    const triggers = await schedulesStore.listTriggers(scheduleId);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0]!.outcome).toBe('published');

    await mastra.shutdown();
  }, 10_000);

  it('rehydrates the built-in heartbeat workflow on boot when heartbeat schedule rows already exist in storage', async () => {
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

    // Boot 2: fresh Mastra instance reusing the same storage. The heartbeat
    // workflow must be re-registered automatically before workers start;
    // otherwise the scheduler would fire ticks against an unregistered
    // workflow and the UI's getWorkflowById would 404.
    const agent2 = makeAgent('beat-rehydrate');
    const mastra2 = new Mastra({
      logger: false,
      storage,
      agents: { 'beat-rehydrate': agent2 },
      scheduler: { tickIntervalMs: 50 },
    });

    await mastra2.startWorkers();

    // The built-in heartbeat workflow should be findable by id without
    // anyone having to call setHeartbeat() again.
    const wf = mastra2.getWorkflowById('__mastra_heartbeat__');
    expect(wf).toBeDefined();
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
