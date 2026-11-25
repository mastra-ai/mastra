/**
 * An EventedAgent run split between an API process and a worker, on a pubsub that redelivers unacked events and
 * LibSQL, which fences run writes and guards steps (COR-1609). The pubsub tracks which worker holds each delivery,
 * so no process renews the run's claim, and deliveries handled long after its expiry still commit.
 *
 * The lease TTL is shortened before core loads, so the run outlasts it several times in a few seconds.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeAll, expect, it, vi } from 'vitest';

process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
const TTL_MS = 300;

let core: {
  Agent: typeof import('@mastra/core/agent').Agent;
  createEventedAgent: typeof import('@mastra/core/agent/durable').createEventedAgent;
  EventEmitterPubSub: typeof import('@mastra/core/events').EventEmitterPubSub;
  Mastra: typeof import('@mastra/core/mastra').Mastra;
  MockMemory: typeof import('@mastra/core/memory').MockMemory;
  createTool: typeof import('@mastra/core/tools').createTool;
  LibSQLStore: typeof import('../index').LibSQLStore;
};

beforeAll(async () => {
  core = {
    ...(await import('@mastra/core/agent')),
    ...(await import('@mastra/core/agent/durable')),
    ...(await import('@mastra/core/events')),
    ...(await import('@mastra/core/mastra')),
    ...(await import('@mastra/core/memory')),
    ...(await import('@mastra/core/tools')),
    ...(await import('../index')),
  };
});

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

it('finishes a multi-delivery EventedAgent run on a worker without anyone renewing its claim', async () => {
  const { Agent, createEventedAgent, EventEmitterPubSub, Mastra, MockMemory, createTool, LibSQLStore } = core;
  // One broker connection both instances share, as pods share a Redis that redelivers a dead consumer's messages.
  class RedeliveringBroker extends EventEmitterPubSub {
    override get deliversAcrossProcesses() {
      return true;
    }
    override get redeliversUnacked() {
      return true;
    }
  }
  const dir = await mkdtemp(join(tmpdir(), 'mastra-pubsub-owned-'));
  const url = `file:${join(dir, 'mastra.db')}`;
  const apiStorage = new LibSQLStore({ id: 'api', url });
  const workerStorage = new LibSQLStore({ id: 'worker', url });
  await apiStorage.init();
  await workerStorage.init();
  const pubsub = new RedeliveringBroker();
  const renewals = [
    vi.spyOn((await apiStorage.getStore('workflows'))!, 'renewRunOwnership'),
    vi.spyOn((await workerStorage.getStore('workflows'))!, 'renewRunOwnership'),
  ];
  const workflows = (await apiStorage.getStore('workflows'))!;
  expect(workflows.supportsWorkflowStepGuards()).toBe(true);

  let calls = 0;
  const model = {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doGenerate(): Promise<never> {
      throw new Error('doGenerate not used');
    },
    async doStream() {
      const call = ++calls;
      // Each model call outlasts the claim's TTL several times.
      await sleep(TTL_MS * 3);
      const chunks =
        call === 1
          ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' }]
          : [
              { type: 'text-start', id: 'text' },
              { type: 'text-delta', id: 'text', delta: 'found it' },
              { type: 'text-end', id: 'text' },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of [
              { type: 'stream-start', warnings: [] },
              ...chunks,
              {
                type: 'finish',
                finishReason: call === 1 ? 'tool-calls' : 'stop',
                usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              },
            ])
              controller.enqueue(chunk);
            controller.close();
          },
        }),
      };
    },
  };
  const threadKey = 'resource\u0000thread';
  const threadOwners: Array<string | undefined> = [];
  const lookup = createTool({
    id: 'lookup',
    description: 'Look something up',
    execute: async () => {
      await sleep(TTL_MS * 3);
      threadOwners.push(await pubsub.getLeaseOwner(threadKey));
      return { found: true };
    },
  });
  const build = (storage: InstanceType<typeof LibSQLStore>) =>
    createEventedAgent({
      agent: new Agent({
        id: 'agent',
        name: 'agent',
        instructions: 'Use tools.',
        model: model as any,
        tools: { lookup },
        memory: new MockMemory({ storage }),
      }),
    });
  const api = new Mastra({
    agents: { agent: build(apiStorage) },
    storage: apiStorage,
    pubsub,
    workers: false,
    logger: false,
  });
  const worker = new Mastra({ agents: { agent: build(workerStorage) }, storage: workerStorage, pubsub, logger: false });
  cleanups.push(async () => {
    await api.shutdown();
    await worker.shutdown();
    await pubsub.close();
    await apiStorage.close();
    await workerStorage.close();
    // Windows can keep the database file locked briefly after close.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
  await worker.startWorkers();

  const agent = api.getAgentById('agent');
  const { runId, fullStream } = await agent.stream('Look it up', {
    memory: { resource: 'resource', thread: 'thread' },
  });
  let text = '';
  const types: string[] = [];
  for await (const chunk of fullStream as AsyncIterable<any>) {
    types.push(chunk.type);
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }

  expect(types).toContain('finish');
  expect(types).not.toContain('error');
  expect(text).toBe('found it');
  expect(calls).toBe(2);
  // The thread stayed busy through a tool call three TTLs long.
  expect(threadOwners).toEqual([expect.stringContaining(runId)]);
  for (const renewal of renewals) expect(renewal).not.toHaveBeenCalled();
  await vi.waitFor(async () =>
    expect(await workflows.getRunOwnership({ runId })).toMatchObject({ leaseExpiresAt: null }),
  );
  await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined());
}, 30_000);
