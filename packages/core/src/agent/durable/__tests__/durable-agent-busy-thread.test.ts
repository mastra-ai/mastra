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
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

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

type StartOptions = { engine: 'durable' | 'evented'; holdThreadLease?: boolean };

async function startProcess({ engine, holdThreadLease = false }: StartOptions) {
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
  ] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../../memory/mock'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../create-evented-agent'),
    import('../../../events/event-emitter'),
    import('../../../events/pubsub'),
  ]);

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
  const threadId = `busy-thread-${engine}`;
  const resourceId = `busy-resource-${engine}`;
  await memory.createThread({ threadId, resourceId });

  const gated = createGatedModel();
  const agent = new Agent({
    id: `busy-agent-${engine}`,
    name: `busy-agent-${engine}`,
    instructions: 'Answer with a single word.',
    model: gated.model,
    memory,
  });

  // A lease-capable pubsub that is not an EventEmitterPubSub, so the evented
  // engine treats it as a shared transport and claims the thread lease. The
  // lease for this thread is pre-held by another owner so the claim is denied.
  class LeaseHoldingPubSub extends PubSub implements LeaseProvider {
    owners = new Map<string, string>();
    #subscribers = new Map<string, Set<EventCallback>>();

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
      const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
      subscribers.add(cb);
      this.#subscribers.set(topic, subscribers);
    }

    async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
      this.#subscribers.get(topic)?.delete(cb);
    }

    async flush(): Promise<void> {}

    async close(): Promise<void> {}

    async acquireLease(key: string, owner: string): Promise<{ acquired: boolean; owner?: string }> {
      const current = this.owners.get(key);
      if (current && current !== owner) return { acquired: false, owner: current };
      this.owners.set(key, owner);
      return { acquired: true, owner };
    }

    async getLeaseOwner(key: string): Promise<string | undefined> {
      return this.owners.get(key);
    }

    async releaseLease(key: string, owner: string): Promise<void> {
      if (this.owners.get(key) === owner) this.owners.delete(key);
    }

    async renewLease(key: string, owner: string): Promise<boolean> {
      return this.owners.get(key) === owner;
    }

    async transferLease(key: string, fromOwner: string, toOwner: string): Promise<boolean> {
      if (this.owners.get(key) !== fromOwner) return false;
      this.owners.set(key, toOwner);
      return true;
    }
  }

  let pubsub: LeaseHoldingPubSub | InstanceType<typeof EventEmitterPubSub> | undefined;
  if (engine === 'evented') {
    if (holdThreadLease) {
      const denied = new LeaseHoldingPubSub();
      denied.owners.set([resourceId, threadId].join(THREAD_KEY_SEPARATOR), 'another-replica-run');
      pubsub = denied;
    } else {
      pubsub = new EventEmitterPubSub();
    }
  }

  const durableAgent = storeRunsInV2(
    pubsub ? createEventedAgent({ agent, pubsub }) : createDurableAgent({ agent }),
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

      const secondPromise = durableAgent.stream('second message', options);
      // The second run must not have written anything to the thread yet.
      await sleep(200);
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

      const secondPromise = durableAgent.generate('second message', options);
      await sleep(200);
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

      const secondPromise = durableAgent.stream('second message', options);
      await sleep(200);
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
