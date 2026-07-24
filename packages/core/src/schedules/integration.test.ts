import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { Agent } from '../agent/agent';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { MockStore } from '../storage/mock';
import { executeAgentSchedule } from './worker';

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
  it('wakes an existing thread with the exact scheduled agent in processor context', async () => {
    const memory = new MockMemory();
    await memory.createThread({ threadId: 'scheduled-thread', resourceId: 'scheduled-resource' });
    const observations: Array<{ hook: string; agent: unknown }> = [];
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'scheduled response' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
      }),
    });
    const agent = new Agent({
      id: 'scheduled-agent-context',
      instructions: 'test',
      model,
      memory,
      inputProcessors: [
        {
          id: 'scheduled-agent-observer',
          processInput: async ({ agent, messages }) => {
            observations.push({ hook: 'processInput', agent });
            return messages;
          },
          processInputStep: async ({ agent }) => {
            observations.push({ hook: 'processInputStep', agent });
          },
          processLLMRequest: async ({ agent, prompt }) => {
            observations.push({ hook: 'processLLMRequest', agent });
            return { prompt };
          },
        },
      ],
    });
    const mastra = track(
      new Mastra({
        logger: false,
        storage: new MockStore(),
        agents: { scheduledAgent: agent },
        notifications: { dispatch: { enabled: false } },
      }),
    );

    const result = await executeAgentSchedule(mastra, 'schedule-context-test', {
      type: 'agent',
      agentId: agent.id,
      prompt: 'scheduled check-in',
      threadId: 'scheduled-thread',
      resourceId: 'scheduled-resource',
    });

    expect(result).toMatchObject({ status: 'signal-accepted', outcome: 'succeeded', runId: expect.any(String) });
    await waitUntil(() => new Set(observations.map(observation => observation.hook)).size === 3);
    expect(new Set(observations.map(observation => observation.hook))).toEqual(
      new Set(['processInput', 'processInputStep', 'processLLMRequest']),
    );
    expect(observations.every(observation => observation.agent === agent)).toBe(true);
  });

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
    // No scheduler should be running yet — no declarative scheduled
    // workflows, no agent schedules, no explicit enabled flag.
    expect(mastra.scheduler).toBeUndefined();

    const hb = await mastra.schedules.create({ cron: '* * * * * *', prompt: 'ping', agentId: agent.id });

    // create() should have lazily injected + started the scheduler
    // and agent-schedule workers via __ensureScheduleRuntimeReady().
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
