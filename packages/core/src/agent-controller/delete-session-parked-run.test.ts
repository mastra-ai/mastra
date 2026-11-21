import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

vi.setConfig({ testTimeout: 30_000 });
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

async function setup() {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>([
        { type: 'stream-start', warnings: [] },
        { type: 'tool-call', toolCallId: `call-${Math.random()}`, toolName: 'ask', input: '{}' },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ]),
    }),
  });
  const ask = createTool({
    id: 'ask',
    description: 'suspends until answered',
    inputSchema: z.object({}),
    suspendSchema: z.object({ q: z.string() }),
    resumeSchema: z.object({ a: z.string() }),
    execute: async (_input, ctx) => (ctx?.agent?.resumeData ? 'ok' : ctx?.agent?.suspend?.({ q: '?' })),
  });
  const storage = new InMemoryStore();
  const agent = createDurableAgent({
    agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: model as any, tools: { ask } }),
    // Long enough that no cleanup timer frees the run during the test.
    cleanupTimeoutMs: 60_000,
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'c',
    agent: agent as any,
    memory: new MockMemory({ storage: new InMemoryStore() }),
    initialState: { yolo: true } as any,
    modes: [{ id: 'default', name: 'Default', default: true }],
  } as any);
  new Mastra({ storage, logger: false, agents: { a: agent }, agentControllers: { c: controller } } as any);
  await controller.init();
  return { agent, controller, storage };
}

async function park(controller: AgentController, i: number) {
  const session = await controller.createSession({
    id: `s-${i}`,
    ownerId: 'o',
    resourceId: `r-${i}`,
    threadId: `t-${i}`,
  });
  void session.sendMessage({ content: 'go' }).catch(() => {});
  await vi.waitFor(() => expect(session.suspensions.hasPending()).toBe(true), { timeout: 10_000 });
  return session;
}

describe('deleteSession with a parked suspension (#30743)', () => {
  it('releases the parked run from memory', async () => {
    const { agent, controller, storage } = await setup();
    const releaseParkedRun = vi.spyOn(agent, 'releaseParkedRun');
    for (let i = 0; i < 3; i++) {
      await park(controller, i);
      await controller.deleteSession({ sessionId: `s-${i}` });
    }

    // Deleting the session denies the parked calls, then drops each run and its snapshot.
    expect(releaseParkedRun).toHaveBeenCalledTimes(3);
    const runIds = releaseParkedRun.mock.calls.map(([runId]) => runId);
    const { runs } = await (await storage.getStore('workflows'))!.listWorkflowRuns({});
    expect(runs).toHaveLength(0);
    for (const result of releaseParkedRun.mock.results) expect(await result.value).toBe(true);
    expect(agent.runRegistry.size).toBe(0);
    expect(agent.getWorkflow().runs.size).toBe(0);
    for (const runId of runIds) expect(globalRunRegistry.get(runId)).toBeUndefined();
  });

  it('still deletes the snapshot when releasing the run from memory fails', async () => {
    const { agent, controller, storage } = await setup();
    vi.spyOn(agent, 'releaseParkedRun').mockRejectedValue(new Error('release failed'));
    await park(controller, 0);
    await controller.deleteSession({ sessionId: 's-0' });

    const { runs } = await (await storage.getStore('workflows'))!.listWorkflowRuns({});
    expect(runs).toHaveLength(0);
  });

  it('keeps the parked run in memory when the session moves to a new thread', async () => {
    const { agent, controller } = await setup();
    const session = await park(controller, 0);

    await session.thread.create();

    expect(agent.runRegistry.size).toBe(1);
  });
});
