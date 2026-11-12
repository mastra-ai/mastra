/**
 * A second message on a thread that already has a live run must wait for that
 * run to finish instead of racing it.
 *
 * Both `DurableAgent` and `EventedAgent` used to persist the new user message
 * and start a second run *before either run registered on the thread*, so the
 * thread's saved order became `user, user, assistant, assistant` and the two
 * replies could be attributed to the wrong prompt.
 *
 * An evented run that loses the thread lease had the mirror problem: the lease
 * was claimed inside `executeWorkflow()`, which runs *after* the initial input
 * is persisted, so a rejected run still left its user message on the thread
 * ("rejects it but saves it").
 *
 * The model here blocks its first call on a gate the test controls, so the
 * first run is provably still live when the second message arrives — no
 * timing-based flakiness.
 *
 * The last two tests cover how the thread reservation and the thread lease
 * behave around the initial input write: a failure to take the thread-control
 * subscription must not orphan the run's execution claim, and a lease claimed
 * before the input is persisted must keep being renewed until registration
 * adopts it.
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { LeaseProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import { storeRunsInV2 } from './storage-version';

const THREAD_KEY_SEPARATOR = '\u0000';

/**
 * A text model whose first call parks on a gate the test releases, so the first
 * run stays live until the test says otherwise. Later calls answer immediately.
 */
function createGatedModel() {
  let calls = 0;
  let releaseFirst: (() => void) | undefined;
  const firstCallGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });

  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      calls += 1;
      if (calls === 1) await firstCallGate;
      const parts = [
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'done' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${calls}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });

  return { model, calls: () => calls, releaseFirst: () => releaseFirst?.() };
}

/**
 * A model that asks for the suspending tool on its first call instead of
 * answering, so the first run parks, and answers on later calls. Used to
 * observe what a suspended run does with its thread lease.
 */
function createSuspendingToolCallModel() {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls += 1;
      const parts =
        calls === 1
          ? [
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'request_approval',
                input: JSON.stringify({ question: 'Proceed?' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-delta', id: `text-${calls}`, delta: 'done' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${calls}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });

  return { model, calls: () => calls, releaseFirst: () => {} };
}

type StartOptions = {
  engine: 'durable' | 'evented';
  holdThreadLease?: boolean;
  sharedTransport?: boolean;
  failThreadControlSubscribe?: boolean;
  suspendingTool?: boolean;
};

async function startProcess({
  engine,
  holdThreadLease = false,
  sharedTransport = false,
  failThreadControlSubscribe = false,
  suspendingTool = false,
}: StartOptions) {
  vi.resetModules();
  const [
    { Mastra },
    { InMemoryStore },
    { MockMemory },
    { Agent },
    { createDurableAgent },
    { createEventedAgent },
    { EventEmitterPubSub },
    { PubSub },
    { agentThreadStreamTopic },
    { agentThreadStreamRuntime },
    { ExtendedRunRegistry },
    { createTool },
  ] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../../memory/mock'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../create-evented-agent'),
    import('../../../events/event-emitter'),
    import('../../../events/pubsub'),
    import('../../thread-stream-topic'),
    import('../../thread-stream-runtime'),
    import('../run-registry'),
    import('../../../tools'),
  ]);

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
  const threadId = `busy-thread-${engine}`;
  const resourceId = `busy-resource-${engine}`;
  await memory.createThread({ threadId, resourceId });

  const threadKey = [resourceId, threadId].join(THREAD_KEY_SEPARATOR);
  const threadControlTopic = agentThreadStreamTopic(resourceId, threadId);

  const gated = suspendingTool ? createSuspendingToolCallModel() : createGatedModel();
  const approvalTool = suspendingTool
    ? createTool({
        id: 'request_approval',
        description: 'Ask the user to approve before continuing',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async (input: any, context: any) => {
          const agentCtx = context?.agent ?? context ?? {};
          if (agentCtx.resumeData != null) return { approved: agentCtx.resumeData.approved };
          await agentCtx.suspend?.({ question: input.question });
          return { approved: false };
        },
      })
    : undefined;
  const agent = new Agent({
    id: `busy-agent-${engine}`,
    name: `busy-agent-${engine}`,
    instructions: 'Answer with a single word.',
    model: gated.model,
    memory,
    ...(approvalTool ? { tools: { request_approval: approvalTool } } : {}),
  });

  // A lease-capable pubsub that is not an EventEmitterPubSub, so the evented
  // engine treats it as a shared transport and claims the thread lease. Leases
  // carry the TTL the runtime asks for, so a test can watch renewal actually
  // extend them. `failThreadControlSubscribesOnce` makes the first subscribe on
  // this thread's control topic reject, standing in for a transport outage
  // during run setup.
  class LeaseHoldingPubSub extends PubSub implements LeaseProvider {
    owners = new Map<string, string>();
    expiresAt = new Map<string, number>();
    failThreadControlSubscribesOnce = false;
    #subscribers = new Map<string, Set<EventCallback>>();

    #lapsed(key: string): boolean {
      const expiresAt = this.expiresAt.get(key);
      return expiresAt !== undefined && expiresAt <= Date.now();
    }

    async publish(topic: string, event: any): Promise<void> {
      const subscribers = [...(this.#subscribers.get(topic) ?? [])];
      await new Promise<void>(resolve => {
        setTimeout(() => {
          for (const subscriber of subscribers) subscriber(event);
          resolve();
        }, 0);
      });
    }

    async subscribe(topic: string, cb: EventCallback): Promise<void> {
      if (topic === threadControlTopic && this.failThreadControlSubscribesOnce) {
        this.failThreadControlSubscribesOnce = false;
        throw new Error('thread control subscribe failed');
      }
      const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
      subscribers.add(cb);
      this.#subscribers.set(topic, subscribers);
    }

    async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
      this.#subscribers.get(topic)?.delete(cb);
    }

    async flush(): Promise<void> {}

    async close(): Promise<void> {}

    async acquireLease(
      key: string,
      owner: string,
      ttlMs: number = Number.MAX_SAFE_INTEGER,
    ): Promise<{ acquired: boolean; owner?: string }> {
      if (this.#lapsed(key)) {
        this.owners.delete(key);
        this.expiresAt.delete(key);
      }
      const current = this.owners.get(key);
      if (current && current !== owner) return { acquired: false, owner: current };
      this.owners.set(key, owner);
      this.expiresAt.set(key, Date.now() + ttlMs);
      return { acquired: true, owner };
    }

    async getLeaseOwner(key: string): Promise<string | undefined> {
      if (this.#lapsed(key)) return undefined;
      return this.owners.get(key);
    }

    async releaseLease(key: string, owner: string): Promise<void> {
      if (this.owners.get(key) !== owner) return;
      this.owners.delete(key);
      this.expiresAt.delete(key);
    }

    async renewLease(key: string, owner: string, ttlMs: number = Number.MAX_SAFE_INTEGER): Promise<boolean> {
      if (this.#lapsed(key)) return false;
      if (this.owners.get(key) !== owner) return false;
      this.expiresAt.set(key, Date.now() + ttlMs);
      return true;
    }

    async transferLease(
      key: string,
      fromOwner: string,
      toOwner: string,
      ttlMs: number = Number.MAX_SAFE_INTEGER,
    ): Promise<boolean> {
      if (this.owners.get(key) !== fromOwner) return false;
      this.owners.set(key, toOwner);
      this.expiresAt.set(key, Date.now() + ttlMs);
      return true;
    }
  }

  let pubsub: LeaseHoldingPubSub | InstanceType<typeof EventEmitterPubSub> | undefined;
  if (holdThreadLease || sharedTransport || failThreadControlSubscribe) {
    const leasePubSub = new LeaseHoldingPubSub();
    // Pre-held by another owner with no expiry, so the claim is always denied.
    if (holdThreadLease) leasePubSub.owners.set(threadKey, 'another-replica-run');
    if (failThreadControlSubscribe) leasePubSub.failThreadControlSubscribesOnce = true;
    pubsub = leasePubSub;
  } else if (engine === 'evented') {
    pubsub = new EventEmitterPubSub();
  }

  const durableAgent = storeRunsInV2(
    engine === 'evented'
      ? createEventedAgent({ agent, ...(pubsub ? { pubsub } : {}) })
      : createDurableAgent({ agent, ...(pubsub ? { pubsub } : {}) }),
    false,
  );
  const mastra = new Mastra({
    agents: { durableAgent },
    storage,
    ...(pubsub ? { pubsub } : {}),
    logger: false,
    recovery: { durableAgents: 'auto' as const },
  });

  return {
    durableAgent,
    memory,
    threadId,
    resourceId,
    threadKey,
    pubsub,
    agentThreadStreamRuntime,
    ExtendedRunRegistry,
    options: { memory: { thread: threadId, resource: resourceId } },
    modelCalls: () => gated.calls(),
    releaseFirstModelCall: () => gated.releaseFirst(),
    stop: async () => {
      if (pubsub) {
        await mastra.stopWorkers();
        await pubsub.close();
      }
    },
  };
}

/**
 * Records whether a specific run reached the cross-agent thread wait, so an
 * ordering test can assert the thread is untouched at that exact moment instead
 * of after a fixed sleep that could elapse before the second run even tried to
 * write.
 */
function watchRunEnteringThreadWait(
  runtime: { waitForCrossAgentThreadRun: (...args: any[]) => Promise<any> },
  runId: string,
) {
  const state = { entered: false };
  const original = runtime.waitForCrossAgentThreadRun.bind(runtime);
  vi.spyOn(runtime, 'waitForCrossAgentThreadRun').mockImplementation(async (...args: any[]) => {
    if ((args[1] as { runId?: string } | undefined)?.runId === runId) state.entered = true;
    return await original(...args);
  });
  return state;
}

async function collectText(stream: { fullStream: AsyncIterable<any> }) {
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return text;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('second message on a busy thread', () => {
  it('waits for the live run and saves the pair in order (durable stream)', async () => {
    const proc = await startProcess({ engine: 'durable' });
    try {
      const { durableAgent, memory, options } = proc;

      const first = await durableAgent.stream('first message', options);
      const firstText = collectText(first);
      await vi.waitFor(() => expect(proc.modelCalls()).toBeGreaterThanOrEqual(1));

      const secondRunId = 'second-run';
      const waitedOnThread = watchRunEnteringThreadWait(proc.agentThreadStreamRuntime, secondRunId);
      const secondPromise = durableAgent.stream('second message', { ...options, runId: secondRunId });
      // Wait until the second run has actually reached the thread, so this cannot
      // pass just because it had not started writing yet. It must not have
      // written anything to the thread.
      await vi.waitFor(() => expect(waitedOnThread.entered).toBe(true));
      expect(
        (await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId })).messages.map(m => m.role),
      ).toEqual(['user']);

      proc.releaseFirstModelCall();
      const second = await secondPromise;
      expect(await firstText).toBe('done');
      expect(await collectText(second)).toBe('done');

      await vi.waitFor(async () => {
        const recalled = await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId });
        expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
      });
    } finally {
      await proc.stop();
    }
  }, 30_000);

  it('waits for the live run and saves the pair in order (durable generate)', async () => {
    const proc = await startProcess({ engine: 'durable' });
    try {
      const { durableAgent, memory, options } = proc;

      const firstPromise = durableAgent.generate('first message', options);
      await vi.waitFor(() => expect(proc.modelCalls()).toBeGreaterThanOrEqual(1));

      const secondRunId = 'second-run';
      const waitedOnThread = watchRunEnteringThreadWait(proc.agentThreadStreamRuntime, secondRunId);
      const secondPromise = durableAgent.generate('second message', { ...options, runId: secondRunId });
      await vi.waitFor(() => expect(waitedOnThread.entered).toBe(true));
      expect(
        (await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId })).messages.map(m => m.role),
      ).toEqual(['user']);

      proc.releaseFirstModelCall();
      await firstPromise;
      await secondPromise;

      await vi.waitFor(async () => {
        const recalled = await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId });
        expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
      });
    } finally {
      await proc.stop();
    }
  }, 30_000);

  it('waits for the live run and saves the pair in order (evented stream)', async () => {
    const proc = await startProcess({ engine: 'evented' });
    try {
      const { durableAgent, memory, options } = proc;

      const first = await durableAgent.stream('first message', options);
      const firstText = collectText(first);
      await vi.waitFor(() => expect(proc.modelCalls()).toBeGreaterThanOrEqual(1));

      const secondRunId = 'second-run';
      const waitedOnThread = watchRunEnteringThreadWait(proc.agentThreadStreamRuntime, secondRunId);
      const secondPromise = durableAgent.stream('second message', { ...options, runId: secondRunId });
      await vi.waitFor(() => expect(waitedOnThread.entered).toBe(true));
      expect(
        (await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId })).messages.map(m => m.role),
      ).toEqual(['user']);

      proc.releaseFirstModelCall();
      const second = await secondPromise;
      expect(await firstText).toBe('done');
      expect(await collectText(second)).toBe('done');

      await vi.waitFor(async () => {
        const recalled = await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId });
        expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
      });
    } finally {
      await proc.stop();
    }
  }, 30_000);

  it('does not persist the user message of an evented run that loses the thread lease', async () => {
    const proc = await startProcess({ engine: 'evented', holdThreadLease: true });
    try {
      const { durableAgent, memory, options } = proc;

      const result = await durableAgent.stream('rejected message', options);
      const errors: unknown[] = [];
      try {
        for await (const chunk of result.fullStream as AsyncIterable<any>) {
          if (chunk.type === 'error') errors.push(chunk.payload?.error ?? chunk.error ?? chunk.payload);
        }
      } catch (error) {
        errors.push(error);
      }

      // The run loses the lease before it can write to the thread.
      expect(errors.length).toBeGreaterThan(0);
      expect(String((errors[0] as Error)?.message ?? errors[0])).toContain('thread lease is held');
      expect(proc.modelCalls()).toBe(0);
      expect((await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId })).messages).toEqual([]);
    } finally {
      await proc.stop();
    }
  }, 30_000);
});

type LeaseDouble = {
  getLeaseOwner(key: string): Promise<string | undefined>;
  acquireLease(key: string, owner: string, ttlMs?: number): Promise<{ acquired: boolean; owner?: string }>;
};

describe('run ownership around the initial input write', () => {
  it('settles the execution claim when the thread wait cannot take its subscription', async () => {
    const proc = await startProcess({ engine: 'durable', failThreadControlSubscribe: true });
    try {
      const { durableAgent, memory, options } = proc;
      const runId = 'retry-after-subscribe-failure';

      await expect(durableAgent.stream('first attempt', { ...options, runId })).rejects.toThrow(
        /thread control subscribe failed/,
      );
      expect((await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId })).messages).toEqual([]);

      // The failed attempt left no execution claim behind, so this run id is
      // usable again: the retry would reject with an execution conflict if the
      // claim had been orphaned.
      const retry = await durableAgent.stream('retry attempt', { ...options, runId });
      // The failed attempt never reached the model, so the retry's call is the
      // gated first call.
      proc.releaseFirstModelCall();
      expect(await collectText(retry)).toBe('done');

      await vi.waitFor(async () => {
        const recalled = await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId });
        expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
      });
    } finally {
      await proc.stop();
    }
  }, 30_000);

  it('gives the thread lease back when a run fails before the engine takes it', async () => {
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '300');
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS', '50');
    const proc = await startProcess({ engine: 'evented', sharedTransport: true });
    try {
      const { durableAgent, options } = proc;
      const lease = proc.pubsub as unknown as LeaseDouble;
      const ensureWorkers = vi
        .spyOn(Object.getPrototypeOf(durableAgent) as any, 'ensureEngineWorkersStarted')
        .mockRejectedValueOnce(new Error('engine workers unavailable'));

      // The run writes its input, then fails before the engine owns it, so the
      // lease held since before the input write has no successor.
      await expect(durableAgent.generate('first message', options)).rejects.toThrow('engine workers unavailable');
      ensureWorkers.mockRestore();

      await vi.waitFor(async () => {
        expect(await lease.getLeaseOwner(proc.threadKey)).toBeUndefined();
      });

      // The thread is usable again rather than being held by a run that never
      // started.
      proc.releaseFirstModelCall();
      expect((await durableAgent.generate('second message', options)).text).toBe('done');
    } finally {
      vi.unstubAllEnvs();
      await proc.stop();
    }
  }, 30_000);

  it('releases the thread reservation when run setup fails before the workflow starts', async () => {
    const proc = await startProcess({ engine: 'durable' });
    try {
      const { durableAgent, memory, options, ExtendedRunRegistry } = proc;
      const register = vi.spyOn(ExtendedRunRegistry.prototype, 'registerWithMessageList').mockImplementationOnce(() => {
        throw new Error('run registry unavailable');
      });

      // Setup fails after the thread reservation is taken and before the
      // workflow starts.
      await expect(durableAgent.stream('first message', options)).rejects.toThrow('run registry unavailable');
      register.mockRestore();
      expect((await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId })).messages).toEqual([]);

      // A later run on the same thread must start instead of waiting forever on a
      // reservation no run is behind.
      const second = await durableAgent.stream('second message', options);
      proc.releaseFirstModelCall();
      expect(await collectText(second)).toBe('done');

      await vi.waitFor(async () => {
        const recalled = await memory.recall({ threadId: proc.threadId, resourceId: proc.resourceId });
        expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
      });
    } finally {
      await proc.stop();
    }
  }, 30_000);

  it('gives the thread lease back when the input write fails', async () => {
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '300');
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS', '50');
    const proc = await startProcess({ engine: 'evented', sharedTransport: true });
    try {
      const { durableAgent, memory, options } = proc;
      const lease = proc.pubsub as unknown as LeaseDouble;
      vi.spyOn(memory, 'saveMessages').mockRejectedValue(new Error('storage unavailable'));

      const result = durableAgent.generate('unsaveable message', options);
      await expect(result).rejects.toThrow();

      // The run never started, so nothing renews its claim: the lease must be
      // given back instead of being held for the process lifetime.
      expect(proc.modelCalls()).toBe(0);
      await vi.waitFor(async () => {
        expect(await lease.getLeaseOwner(proc.threadKey)).toBeUndefined();
      });
      expect(await lease.acquireLease(proc.threadKey, 'rival-replica', 300)).toMatchObject({ acquired: true });
    } finally {
      vi.unstubAllEnvs();
      await proc.stop();
    }
  }, 30_000);

  it('keeps renewing the thread lease it claimed before the input is persisted', async () => {
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '300');
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS', '50');
    const proc = await startProcess({ engine: 'evented', sharedTransport: true });
    try {
      const { durableAgent, memory, options } = proc;
      const lease = proc.pubsub as unknown as LeaseDouble;

      let enterPersist: (() => void) | undefined;
      const persistEntered = new Promise<void>(resolve => {
        enterPersist = resolve;
      });
      let releasePersist: (() => void) | undefined;
      const persistGate = new Promise<void>(resolve => {
        releasePersist = resolve;
      });

      const realSaveMessages = memory.saveMessages.bind(memory);
      vi.spyOn(memory, 'saveMessages').mockImplementation(async (...args: Parameters<typeof realSaveMessages>) => {
        enterPersist?.();
        await persistGate;
        return await realSaveMessages(...args);
      });

      const resultPromise = durableAgent.generate('held message', options);

      const reachedPersist = await Promise.race([persistEntered.then(() => true), sleep(5000).then(() => false)]);
      expect(reachedPersist).toBe(true);

      // The run holds the lease while it writes its input. No workflow worker has
      // started yet, so only its own renewal can keep the lease alive across a TTL.
      // generate() never registers a thread run, so nothing else renews it.
      expect(await lease.getLeaseOwner(proc.threadKey)).toBeDefined();
      await sleep(900);
      expect(await lease.getLeaseOwner(proc.threadKey)).toBeDefined();
      expect(await lease.acquireLease(proc.threadKey, 'rival-replica', 300)).toMatchObject({ acquired: false });

      releasePersist?.();
      // The run reaches the model only after the input write completes.
      proc.releaseFirstModelCall();
      expect((await resultPromise).text).toBe('done');
    } finally {
      vi.unstubAllEnvs();
      await proc.stop();
    }
  }, 30_000);
});

describe('thread lease of a suspended run', () => {
  it('stops renewing a parked run once the suspended-run window passes', async () => {
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '300');
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS', '50');
    vi.stubEnv('MASTRA_SUSPENDED_RUN_TTL_MS', '1500');
    const proc = await startProcess({ engine: 'evented', sharedTransport: true, suspendingTool: true });
    try {
      const { durableAgent, options } = proc;
      const lease = proc.pubsub as unknown as LeaseDouble;

      const parked = await durableAgent.generate('please approve', options);
      expect(parked.finishReason).toBe('suspended');

      // The parked run never registers a thread run, so the suspended-run sweep
      // cannot reach it. Its own renewal keeps the lease alive through the window
      // that sweep gives a parked run, so a resume arriving right after the
      // suspension still finds the thread.
      await sleep(900);
      expect(await lease.getLeaseOwner(proc.threadKey)).toBeDefined();
      expect(await lease.acquireLease(proc.threadKey, 'rival-replica', 900)).toMatchObject({ acquired: false });

      // Once that window passes the lease is let go instead of pinning the thread
      // for the lifetime of the process.
      await vi.waitFor(
        async () => {
          expect(await lease.getLeaseOwner(proc.threadKey)).toBeUndefined();
        },
        { timeout: 5000 },
      );

      // The thread is free again, so a later message runs on it.
      expect((await durableAgent.generate('second message', options)).text).toBe('done');
    } finally {
      vi.unstubAllEnvs();
      await proc.stop();
    }
  }, 30_000);
});
