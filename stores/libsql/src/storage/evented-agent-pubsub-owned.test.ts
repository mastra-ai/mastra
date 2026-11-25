/**
 * An EventedAgent run split between an API process and a worker, on a pubsub that redelivers unacked events and
 * LibSQL, which fences run writes and guards steps (COR-1609). The pubsub tracks which worker holds each delivery,
 * so no process renews the run's claim, and deliveries handled long after its expiry still commit.
 *
 * The lease TTL is shortened before core loads, so the run outlasts it in a few seconds.
 */
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeAll, expect, it, vi } from 'vitest';

process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '1000';
const TTL_MS = 1000;

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

/**
 * Connections to one in-process broker, as pods share a Redis that redelivers a dead consumer's messages. Each
 * Mastra closes its own connection on shutdown, which must not close the broker for the others.
 */
function redeliveringBroker() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  class Connection extends core.EventEmitterPubSub {
    override get deliversAcrossProcesses() {
      return true;
    }
    override get redeliversUnacked() {
      return true;
    }
    override async close() {}
  }
  return { connect: () => new Connection(emitter), close: () => emitter.removeAllListeners() };
}

function textModel(onCall: (call: number, abortSignal: AbortSignal | undefined) => Promise<'tool' | 'text'>) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    model: {
      specificationVersion: 'v2' as const,
      provider: 'mock',
      modelId: 'mock-model',
      supportedUrls: {},
      async doGenerate(): Promise<never> {
        throw new Error('doGenerate not used');
      },
      async doStream({ abortSignal }: { abortSignal?: AbortSignal }) {
        const reply = await onCall(++calls, abortSignal);
        const chunks =
          reply === 'tool'
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
                  finishReason: reply === 'tool' ? 'tool-calls' : 'stop',
                  usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
                },
              ])
                controller.enqueue(chunk);
              controller.close();
            },
          }),
        };
      },
    },
  };
}

async function readStream(fullStream: unknown) {
  let text = '';
  const types: string[] = [];
  for await (const chunk of fullStream as AsyncIterable<any>) {
    types.push(chunk.type);
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return { text, types };
}

async function libsqlFile() {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-pubsub-owned-'));
  return {
    url: `file:${join(dir, 'mastra.db')}`,
    // Windows can keep the database file locked briefly after close.
    remove: () => rm(dir, { recursive: true, force: true }).catch(() => {}),
  };
}

it('finishes a multi-delivery EventedAgent run on a worker without anyone renewing its claim', async () => {
  const { Agent, createEventedAgent, EventEmitterPubSub, Mastra, MockMemory, createTool, LibSQLStore } = core;
  // One connection both instances share, so the thread lease they read and write is the same.
  class RedeliveringBroker extends EventEmitterPubSub {
    override get deliversAcrossProcesses() {
      return true;
    }
    override get redeliversUnacked() {
      return true;
    }
  }
  const file = await libsqlFile();
  const apiStorage = new LibSQLStore({ id: 'api', url: file.url });
  const workerStorage = new LibSQLStore({ id: 'worker', url: file.url });
  await apiStorage.init();
  await workerStorage.init();
  const pubsub = new RedeliveringBroker();
  const renewals = [
    vi.spyOn((await apiStorage.getStore('workflows'))!, 'renewRunOwnership'),
    vi.spyOn((await workerStorage.getStore('workflows'))!, 'renewRunOwnership'),
  ];
  const workflows = (await apiStorage.getStore('workflows'))!;
  expect(workflows.supportsWorkflowStepGuards()).toBe(true);

  // Each model call outlasts the claim's TTL.
  const mock = textModel(async call => {
    await sleep(TTL_MS * 1.5);
    return call === 1 ? 'tool' : 'text';
  });
  const threadKey = 'resource\u0000thread';
  const threadOwners: Array<string | undefined> = [];
  const lookup = createTool({
    id: 'lookup',
    description: 'Look something up',
    execute: async () => {
      await sleep(TTL_MS * 1.5);
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
        model: mock.model as any,
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
    await file.remove();
  });
  await worker.startWorkers();

  const agent = api.getAgentById('agent');
  const { runId, fullStream } = await agent.stream('Look it up', {
    memory: { resource: 'resource', thread: 'thread' },
  });
  const { text, types } = await readStream(fullStream);

  expect(types).toContain('finish');
  expect(types).not.toContain('error');
  expect(text).toBe('found it');
  expect(mock.calls).toBe(2);
  // The thread stayed busy through a tool call longer than the TTL.
  expect(threadOwners).toEqual([expect.stringContaining(runId)]);
  for (const renewal of renewals) expect(renewal).not.toHaveBeenCalled();
  await vi.waitFor(
    async () => expect(await workflows.getRunOwnership({ runId })).toMatchObject({ leaseExpiresAt: null }),
    { timeout: 5_000 },
  );
  await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined(), { timeout: 5_000 });
}, 30_000);

// The API process that started the run restarted while a worker was in the middle of a model call, and an operator
// calls recover(runId). The worker's call is aborted as superseded, and the recovered run finishes on the worker.
it('recovers a run through recover() while a worker is mid-delivery, aborting the old model call', async () => {
  const { Agent, createEventedAgent, Mastra, LibSQLStore } = core;
  const broker = redeliveringBroker();
  const file = await libsqlFile();
  const stores = ['api', 'worker', 'operator'].map(id => new LibSQLStore({ id, url: file.url }));
  for (const store of stores) await store.init();
  const [apiStorage, workerStorage, operatorStorage] = stores as [
    InstanceType<typeof LibSQLStore>,
    InstanceType<typeof LibSQLStore>,
    InstanceType<typeof LibSQLStore>,
  ];
  const workflows = (await operatorStorage.getStore('workflows'))!;

  const firstCall = Promise.withResolvers<void>();
  let aborted: unknown;
  const mock = textModel(async (call, abortSignal) => {
    if (call === 1) {
      firstCall.resolve();
      await new Promise((_, reject) =>
        abortSignal?.addEventListener(
          'abort',
          () => {
            aborted = abortSignal.reason;
            reject(abortSignal.reason);
          },
          { once: true },
        ),
      );
    }
    return 'text';
  });
  const build = () =>
    createEventedAgent({
      agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Answer.', model: mock.model as any }),
    });
  const api = new Mastra({
    agents: { agent: build() },
    storage: apiStorage,
    pubsub: broker.connect(),
    workers: false,
    logger: false,
  });
  const worker = new Mastra({
    agents: { agent: build() },
    storage: workerStorage,
    pubsub: broker.connect(),
    logger: false,
  });
  const operator = new Mastra({
    agents: { agent: build() },
    storage: operatorStorage,
    pubsub: broker.connect(),
    workers: false,
    logger: false,
  });
  cleanups.push(async () => {
    await operator.shutdown();
    await worker.shutdown();
    await api.shutdown();
    broker.close();
    await file.remove();
  });
  await worker.startWorkers();

  const { runId } = await api.getAgentById('agent').stream('Answer.');
  await firstCall.promise;
  const claimed = (await workflows.getRunOwnership({ runId }))!;
  // The API process goes away. Shutdown leaves the run to the worker.
  await api.shutdown();
  await sleep(TTL_MS * 1.5);
  expect(await workflows.getRunOwnership({ runId })).toEqual({ ...claimed, live: false });

  const recovered = await operator.getAgentById('agent').recover(runId);
  const { text, types } = await readStream(recovered.fullStream);

  // The old call stops at the worker's next ownership poll, which can come after the recovered run finished.
  await vi.waitFor(() => expect(aborted).toMatchObject({ id: 'DURABLE_AGENT_EXECUTION_SUPERSEDED' }), {
    timeout: 5_000,
  });
  expect(types).toContain('finish');
  expect(text).toBe('found it');
  expect(mock.calls).toBe(2);
  expect((await workflows.getRunOwnership({ runId }))?.generation).toBeGreaterThan(claimed.generation);
}, 30_000);
