/**
 * Abort Signal Tests
 *
 * Tests abort signal propagation at two levels:
 * 1. Baseline: agent.generate() returns empty result on abort (framework behavior)
 * 2. OM-level: withAbortCheck detects the abort and throws AbortError
 */

import { APICallError } from '@internal/ai-sdk-v5';
import type { LanguageModelV2StreamPart } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent, MessageList } from '@mastra/core/agent';
import { InMemoryStore, InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { Memory } from '../../../index';
import { runOMCommit, waitingOMCommits } from '../commit-queue';
import { ObservationalMemoryProcessor } from '../processor';

// =============================================================================
// Slow model that takes a long time to respond (simulates real LLM latency)
// =============================================================================

function createSlowModel(delayMs: number) {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-slow',
    modelId: 'mock-slow-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate({ abortSignal }: { abortSignal?: AbortSignal } = {}) {
      // Simulate slow LLM response, abort-aware
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        if (abortSignal) {
          if (abortSignal.aborted) {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          abortSignal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            },
            { once: true },
          );
        }
      });

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Completed normally.' }],
        warnings: [],
      };
    },

    async doStream({ abortSignal }: { abortSignal?: AbortSignal } = {}) {
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-slow-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });

          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs / 10));
            if (abortSignal?.aborted) {
              controller.error(new DOMException('The operation was aborted.', 'AbortError'));
              return;
            }
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: `chunk-${i} ` });
          }

          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('AbortSignal basics', () => {
  it('agent.generate() returns empty result on abort (framework behavior)', async () => {
    const controller = new AbortController();
    const agent = new Agent({
      id: 'abort-test-generate',
      name: 'Abort Test Generate',
      model: createSlowModel(5000) as any,
      instructions: 'You are a test agent.',
    });

    // Abort after 100ms
    setTimeout(() => controller.abort(), 100);

    const start = Date.now();
    // Framework returns empty result instead of throwing
    const result = await agent.generate('Hello', {
      abortSignal: controller.signal,
    });

    const elapsed = Date.now() - start;
    // Should complete quickly (not wait 5s)
    expect(elapsed).toBeLessThan(2000);
    // Framework returns empty text on abort
    expect(result.text).toBe('');
  }, 10000);

  it('agent.generate() completes normally without abort', async () => {
    const agent = new Agent({
      id: 'abort-test-no-abort',
      name: 'Abort Test No Abort',
      model: createSlowModel(100) as any,
      instructions: 'You are a test agent.',
    });

    const result = await agent.generate('Hello');
    expect(result.text).toBe('Completed normally.');
  }, 10000);

  it('persists an aborted turn through the Observational Memory output processor', async () => {
    const controller = new AbortController();
    const idleObserver = createLatchedModel('<observations>\n- Idle work\n</observations>', false);
    const store = new InMemoryStore();
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          model: idleObserver.model,
          observation: { messageTokens: 100_000, bufferTokens: 1000, bufferOnIdle: true },
          reflection: { observationTokens: 100_000 },
        },
      },
    });
    const agent = new Agent({
      id: 'abort-test-observational-memory',
      name: 'Abort Test Observational Memory',
      model: createSlowModel(1000) as any,
      instructions: 'You are a test agent.',
      memory,
    });
    const threadId = 'abort-test-observational-memory-thread';

    const result = await agent.stream('Remember this aborted request', {
      abortSignal: controller.signal,
      memory: { thread: threadId, resource: 'abort-test-resource' },
      onChunk: chunk => {
        if (chunk.type === 'text-delta') {
          controller.abort();
        }
      },
    });
    try {
      await result.consumeStream();
    } catch {
      // The provider surfaces cancellation as an AbortError.
    }

    await (await memory.omEngine)!.waitForBuffering(threadId, 'abort-test-resource');
    expect(idleObserver.calls).toBe(0);
    const memoryStore = await store.getStore('memory');
    const { messages } = await memoryStore!.listMessages({
      threadId,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      perPage: false,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: { parts: [{ type: 'text', text: 'Remember this aborted request' }] },
    });
    expect(messages[1]).toMatchObject({ role: 'assistant' });
    expect(
      messages[1]?.content.parts
        ?.filter(part => part.type === 'text')
        .map(part => part.text)
        .join('')
        .trim(),
    ).toBe('chunk-0');
    expect(new Set(messages.map(message => message.id)).size).toBe(2);
  }, 10000);
});

// A provider stream that stays open until the test releases it or the caller cancels.
// Only the paid model boundary is replaced; Agent, Memory and storage are real. (#27792)
function createLatchedModel(text: string, held = true) {
  const started = Promise.withResolvers<AbortSignal | undefined>();
  let cancelled = false;
  let calls = 0;
  let finish = () => {};
  const model = new MockLanguageModelV2({
    doStream: async ({ abortSignal }) => {
      calls++;
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        start(controller) {
          let closed = false;
          const abort = () => {
            if (closed) return;
            closed = true;
            cancelled = true;
            controller.error(new DOMException('The operation was aborted.', 'AbortError'));
          };
          finish = () => {
            if (closed) return;
            closed = true;
            abortSignal?.removeEventListener('abort', abort);
            controller.enqueue({ type: 'text-start', id: 'text' });
            controller.enqueue({ type: 'text-delta', id: 'text', delta: text });
            controller.enqueue({ type: 'text-end', id: 'text' });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10 } });
            controller.close();
          };
          controller.enqueue({ type: 'stream-start', warnings: [] });
          if (abortSignal?.aborted) abort();
          else abortSignal?.addEventListener('abort', abort, { once: true });
          started.resolve(abortSignal);
          if (!held) finish();
        },
      });
      return { stream };
    },
  });
  return {
    model,
    started: started.promise,
    release: () => finish(),
    get cancelled() {
      return cancelled;
    },
    get calls() {
      return calls;
    },
  };
}

describe('Cancellation of in-flight Observational Memory (#27792)', () => {
  it.each([
    ['sync observation', 'thread', 'model'],
    ['async observation', 'thread', 'model'],
    ['sync reflection', 'thread', 'model'],
    ['async reflection', 'thread', 'model'],
    ['sync observation', 'resource', 'model'],
    ['sync reflection', 'resource', 'model'],
    ['sync observation', 'thread', 'hook'],
    ['async observation', 'thread', 'hook'],
    ['sync reflection', 'thread', 'hook'],
    ['async reflection', 'thread', 'hook'],
  ] as const)('cancels %s in %s scope during %s without late writes', async (mode, scope, phase) => {
    const controller = new AbortController();
    const observer = createLatchedModel(
      '<observations>\n- Late observation\n</observations>\n<thread-title>Late title</thread-title>',
      phase === 'model',
    );
    const reflector = createLatchedModel('<observations>\n- Late reflection\n</observations>', phase === 'model');
    const hookStarted = Promise.withResolvers<void>();
    const releaseHook = Promise.withResolvers<void>();
    const afterModel = async () => {
      if (phase === 'hook') {
        hookStarted.resolve();
        await releaseHook.promise;
      }
    };
    const actor = createLatchedModel('Actor finished', phase === 'hook');
    const store = new InMemoryStore();
    const isReflection = mode.includes('reflection');
    const isAsync = mode.startsWith('async');
    const memory = new Memory({
      storage: store,
      options: {
        generateTitle: false,
        observationalMemory: {
          enabled: true,
          hooks: { afterObservation: afterModel, afterReflection: afterModel },
          scope,
          observation: {
            model: observer.model,
            messageTokens: isReflection ? 100_000 : isAsync ? 1000 : 1,
            bufferTokens: isAsync ? (isReflection ? 10_000 : 1) : false,
            bufferOnIdle: false,
          },
          reflection: {
            model: reflector.model,
            observationTokens: isAsync ? 2000 : isReflection ? 100 : 100_000,
            bufferActivation: isAsync && isReflection ? 0.2 : undefined,
          },
        },
      },
    });
    const threadId = `cancel-${mode}-${scope}-${phase}`;
    const resourceId = `resource-${mode}-${scope}-${phase}`;
    const engine = await memory.omEngine;
    const storage = (await store.getStore('memory'))!;
    if (isReflection) {
      const record = await engine!.getOrCreateRecord(threadId, resourceId);
      await storage.updateActiveObservations({
        id: record.id,
        observations: 'Existing observations that must survive cancellation.\n'.repeat(30),
        tokenCount: 1000,
      });
    }
    const before = { ...(await engine!.getRecord(threadId, resourceId)) };
    const agent = new Agent({
      id: threadId,
      name: threadId,
      instructions: 'Help the user.',
      model: actor.model,
      memory,
    });
    const request = 'Remember the accepted user request. '.repeat(isReflection ? 1 : 20);
    const run = agent
      .stream(request, { abortSignal: controller.signal, memory: { thread: threadId, resource: resourceId } })
      .then(result => result.consumeStream())
      .catch(() => undefined);
    const provider = isReflection ? reflector : observer;
    try {
      const providerSignal = await provider.started;
      if (phase === 'hook') await hookStarted.promise;
      controller.abort();
      // Abort listeners run synchronously: cancellation must reach the provider without
      // releasing its response latch, rather than waiting for a successful model reply.
      if (phase === 'model') {
        expect(providerSignal?.aborted).toBe(true);
        expect(provider.cancelled).toBe(true);
      }
      releaseHook.resolve();
      await run;
      await engine!.waitForBuffering(threadId, resourceId);
      const after = await engine!.getRecord(threadId, resourceId);
      expect(after?.activeObservations ?? '').toBe(before?.activeObservations ?? '');
      expect(after?.generationCount ?? 0).toBe(before?.generationCount ?? 0);
      expect(after?.bufferedObservationChunks ?? []).toEqual([]);
      expect(after?.bufferedReflection).toBeFalsy();
      if (mode === 'async observation') expect(after?.lastBufferedAtTokens).toBe(0);
      expect((await storage.getThreadById({ threadId }))?.title).not.toBe('Late title');
      const { messages } = await storage.listMessages({ threadId, perPage: false });
      expect(
        messages.some(
          message =>
            message.role === 'user' &&
            message.content.parts?.some(part => part.type === 'text' && part.text === request),
        ),
      ).toBe(true);
      expect(provider.calls).toBe(1);
    } finally {
      controller.abort();
      releaseHook.resolve();
      observer.release();
      reflector.release();
      actor.release();
      await run;
      await engine!.waitForBuffering(threadId, resourceId);
    }
  });
});

describe('Shared background operation ownership (#27792)', () => {
  it.each(['finish', 'abort'] as const)('keeps shared work alive until the second turn can %s', async outcome => {
    const observer = createLatchedModel('<observations>\n- Shared observations\n</observations>');
    const actor = createLatchedModel('Cancelled actor');
    const a = new AbortController();
    const b = new AbortController();
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        generateTitle: false,
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: { model: observer.model, messageTokens: 1000, bufferTokens: 1, bufferOnIdle: false },
          reflection: { model: observer.model, observationTokens: 100_000 },
        },
      },
    });
    const engine = (await memory.omEngine)!;
    const resourceId = `shared-${outcome}`;
    const threadId = `shared-thread-${outcome}`;
    const agent = new Agent({ id: 'shared', name: 'shared', instructions: 'Help.', model: actor.model, memory });
    const run = agent
      .stream('Remember this request. '.repeat(20), {
        abortSignal: a.signal,
        memory: { thread: threadId, resource: resourceId },
      })
      .then(result => result.consumeStream())
      .catch(() => undefined);
    // The public turn API can consume the same background operation concurrently even
    // when Agent's thread runtime serializes two agent invocations on the same thread.
    const turn = engine.beginTurn({
      threadId,
      resourceId,
      messageList: new MessageList({ threadId, resourceId }),
      abortSignal: b.signal,
    });
    try {
      await observer.started;
      await actor.started;
      await turn.start();
      const step = await turn.step(0).prepare();
      expect(step.observed).toBe(false);
      const waiter = engine.waitForBuffering(threadId, resourceId, 5000, a.signal);
      const cancelledWaiter = expect(waiter).rejects.toHaveProperty('name', 'AbortError');
      a.abort();
      await cancelledWaiter;
      expect(observer.cancelled).toBe(false);
      await run;
      if (outcome === 'abort') {
        b.abort();
        expect(observer.cancelled).toBe(true);
      } else {
        await turn.end();
        observer.release();
        expect(observer.cancelled).toBe(false);
      }
      await engine.waitForBuffering(threadId, resourceId);
      const record = await engine.getRecord(threadId, resourceId);
      if (outcome === 'abort') expect(record?.bufferedObservationChunks ?? []).toEqual([]);
      else expect(record?.bufferedObservationChunks?.length).toBe(1);
    } finally {
      a.abort();
      b.abort();
      observer.release();
      actor.release();
      if (!turn.ended) await turn.end();
      await run;
      await engine.waitForBuffering(threadId, resourceId);
    }
  });
});

describe('Cancellation while waiting for other OM work (#27792)', () => {
  it.each(['activation', 'observation lock', 'buffer predecessor'] as const)(
    'settles a cancelled %s while its predecessor stays live',
    async mode => {
      const provider = createLatchedModel('<observations>\n- Accepted observation\n</observations>');
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            enabled: true,
            observation: {
              model: provider.model,
              messageTokens: 1000,
              bufferTokens: mode === 'observation lock' ? false : 10,
            },
            reflection: { model: provider.model, observationTokens: 100_000 },
          },
        },
      });
      const engine = (await memory.omEngine)!;
      const threadId = `waiting-${mode}`;
      const resourceId = 'waiting-resource';
      const message: MastraDBMessage = {
        id: `message-${mode}`,
        threadId,
        resourceId,
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'Remember this request. '.repeat(20) }] },
      };
      await engine.persistMessages([message], threadId, resourceId);
      const record = { ...(await engine.getOrCreateRecord(threadId, resourceId)) };
      if (mode === 'activation') {
        const storage = (await memory.storage.getStore('memory'))!;
        await storage.updateBufferedObservations({
          id: record.id,
          chunk: {
            cycleId: 'prior-buffer',
            observations: '- Prior observation',
            tokenCount: 3,
            messageTokens: 10,
            messageIds: ['prior-message'],
            lastObservedAt: new Date(0),
          },
        });
      }
      const owner = new AbortController();
      const cancelled = new AbortController();
      const first =
        mode === 'observation lock'
          ? engine.observe({ threadId, resourceId, messages: [message], force: true, abortSignal: owner.signal })
          : engine.buffer({
              threadId,
              resourceId,
              messages: [message],
              record: { ...record },
              abortSignal: owner.signal,
              skipMinimumTokenCheck: true,
            });
      let waiter: Promise<unknown> | undefined;
      try {
        await provider.started;
        waiter =
          mode === 'observation lock'
            ? engine.observe({ threadId, resourceId, messages: [message], force: true, abortSignal: cancelled.signal })
            : mode === 'activation'
              ? engine.activate({ threadId, resourceId, pendingTokens: 2000, abortSignal: cancelled.signal })
              : engine.buffer({
                  threadId,
                  resourceId,
                  messages: [message],
                  record: { ...record },
                  abortSignal: cancelled.signal,
                });
        let settled = false;
        const settlement = waiter.then(
          () => {
            settled = true;
          },
          () => {
            settled = true;
          },
        );
        cancelled.abort();
        // Advance one event-loop turn, without releasing the provider's event latch.
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(settled).toBe(true);
        expect(provider.cancelled).toBe(false);
        expect(provider.calls).toBe(1);
        await settlement;
      } finally {
        owner.abort();
        provider.release();
        await Promise.allSettled([first, ...(waiter ? [waiter] : [])]);
        await engine.waitForBuffering(threadId, resourceId);
      }
    },
  );
});

// Keep the real in-memory adapter, but return a held snapshot as a remote DB would.
class PausedMarkerStorage extends InMemoryMemory {
  pause = false;
  readonly readStarted = Promise.withResolvers<void>();
  readonly releaseRead = Promise.withResolvers<void>();

  private async snapshot<T>(value: T): Promise<T> {
    if (!this.pause) return value;
    this.pause = false;
    const snapshot = structuredClone(value);
    this.readStarted.resolve();
    await this.releaseRead.promise;
    return snapshot;
  }

  override async listMessages(args: Parameters<InMemoryMemory['listMessages']>[0]) {
    const result = await super.listMessages(args);
    return args.perPage === 20 ? this.snapshot(result) : result;
  }

  override async listMessagesById(args: Parameters<InMemoryMemory['listMessagesById']>[0]) {
    return this.snapshot(await super.listMessagesById(args));
  }
}

describe('Cancellation during marker reads (#27792)', () => {
  it.each(['buffer', 'sync reflection', 'async reflection'] as const)(
    'does not let %s overwrite application abort metadata',
    async mode => {
      const storage = new PausedMarkerStorage({ db: new InMemoryDB() });
      const store = new InMemoryStore();
      store.stores.memory = storage;
      const provider = createLatchedModel('<observations>\n- Too late\n</observations>');
      const actor = createLatchedModel('Actor');
      const memory = new Memory({
        storage: store,
        options: {
          generateTitle: false,
          observationalMemory: {
            enabled: true,
            observation: {
              model: provider.model,
              messageTokens: mode === 'buffer' ? 1000 : 100_000,
              bufferTokens: mode === 'buffer' ? 1 : mode === 'async reflection' ? 10_000 : false,
            },
            reflection: {
              model: provider.model,
              observationTokens: mode === 'sync reflection' ? 100 : mode === 'async reflection' ? 2000 : 100_000,
              bufferActivation: mode === 'async reflection' ? 0.2 : undefined,
            },
          },
        },
      });
      const engine = (await memory.omEngine)!;
      const threadId = `marker-read-${mode}`;
      const resourceId = 'marker-resource';
      const target: MastraDBMessage = {
        id: `prior-${mode}`,
        threadId,
        resourceId,
        role: mode === 'buffer' ? 'assistant' : 'user',
        createdAt: new Date('2020-01-01'),
        content: { format: 2, parts: [{ type: 'text', text: 'Previously accepted content.' }] },
      };
      await engine.persistMessages([target], threadId, resourceId);
      if (mode !== 'buffer') {
        const record = await engine.getOrCreateRecord(threadId, resourceId);
        await storage.updateActiveObservations({
          id: record.id,
          observations: '- Existing observation.\n'.repeat(30),
          tokenCount: 1000,
        });
      }
      const controller = new AbortController();
      const agent = new Agent({ id: threadId, name: threadId, model: actor.model, instructions: 'Help.', memory });
      storage.pause = true;
      const run = agent
        .stream('Remember this request. '.repeat(20), {
          abortSignal: controller.signal,
          memory: { thread: threadId, resource: resourceId },
        })
        .then(result => result.consumeStream())
        .catch(() => undefined);
      try {
        await storage.readStarted.promise;
        controller.abort();
        const {
          messages: [saved],
        } = await storage.listMessagesById({ messageIds: [target.id] });
        if (!saved) throw new Error('Expected the accepted message in storage');
        await storage.saveMessages({
          messages: [{ ...saved, content: { ...saved.content, metadata: { abortedByApplication: true } } }],
        });
        storage.releaseRead.resolve();
        await run;
        await engine.waitForBuffering(threadId, resourceId);
        const {
          messages: [after],
        } = await storage.listMessagesById({ messageIds: [target.id] });
        expect(after?.content.metadata).toMatchObject({ abortedByApplication: true });
        expect(provider.calls).toBe(0);
      } finally {
        controller.abort();
        storage.releaseRead.resolve();
        provider.release();
        actor.release();
        await run;
        await engine.waitForBuffering(threadId, resourceId);
      }
    },
  );
});

describe('Cancellation in the commit queue (#27792)', () => {
  it.each(['activation', 'observation', 'buffer', 'reflection'] as const)(
    'settles cancelled %s without overtaking a held commit',
    async mode => {
      const provider = createLatchedModel('<observations>\n- Accepted observation\n</observations>');
      const store = new InMemoryStore();
      const memory = new Memory({
        storage: store,
        options: {
          observationalMemory: {
            enabled: true,
            observation: {
              model: provider.model,
              messageTokens: 1000,
              bufferTokens: mode === 'observation' || mode === 'reflection' ? false : 10,
            },
            reflection: { model: provider.model, observationTokens: mode === 'reflection' ? 100 : 100_000 },
          },
        },
      });
      const engine = (await memory.omEngine)!;
      const storage = (await store.getStore('memory'))!;
      const threadId = `commit-wait-${mode}`;
      const resourceId = 'commit-resource';
      const record = await engine.getOrCreateRecord(threadId, resourceId);
      const message: MastraDBMessage = {
        id: `request-${mode}`,
        threadId,
        resourceId,
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'Keep this request.' }] },
      };
      await engine.persistMessages([message], threadId, resourceId);
      if (mode === 'activation')
        await storage.updateBufferedObservations({
          id: record.id,
          chunk: {
            cycleId: 'queued-activation',
            observations: '- Existing buffer',
            tokenCount: 3,
            messageTokens: 10,
            messageIds: ['prior-message'],
            lastObservedAt: new Date(0),
          },
        });
      if (mode === 'reflection')
        await storage.updateActiveObservations({
          id: record.id,
          observations: '- Existing observation.\n'.repeat(30),
          tokenCount: 1000,
        });
      const controller = new AbortController();
      const turn = engine.beginTurn({
        threadId,
        resourceId,
        messageList: new MessageList({ threadId, resourceId }),
        abortSignal: controller.signal,
      });
      if (mode === 'reflection') await turn.start();
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const key = engine.buffering.getLockKey(threadId, resourceId);
      const blocker = runOMCommit(key, async () => {
        entered.resolve();
        await release.promise;
      });
      await entered.promise;
      const operation =
        mode === 'activation'
          ? engine.activate({ threadId, resourceId, abortSignal: controller.signal })
          : mode === 'observation'
            ? engine.observe({ threadId, resourceId, messages: [message], force: true, abortSignal: controller.signal })
            : mode === 'reflection'
              ? turn.step(0).prepare()
              : engine.buffer({
                  threadId,
                  resourceId,
                  messages: [message],
                  skipMinimumTokenCheck: true,
                  abortSignal: controller.signal,
                });
      let settled = false;
      const result = operation.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      try {
        if (mode !== 'activation') {
          await provider.started;
          provider.release();
        }
        await new Promise<void>(resolve => setImmediate(resolve));
        const waiting = waitingOMCommits(key);
        expect(waiting.normal + waiting.reflection).toBeGreaterThan(0);
        controller.abort();
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(settled).toBe(true);
        expect((await engine.getRecord(threadId, resourceId))?.activeObservations ?? '').toBe(
          mode === 'reflection' ? '- Existing observation.\n'.repeat(30) : '',
        );
      } finally {
        controller.abort();
        release.resolve();
        provider.release();
        await Promise.all([blocker, result]);
        if (mode === 'reflection' && !turn.ended) await turn.end();
        await engine.settled();
      }
    },
  );
});

class PausedThreadStorage extends InMemoryMemory {
  pause = false;
  readonly readStarted = Promise.withResolvers<void>();
  readonly releaseRead = Promise.withResolvers<void>();
  override async getThreadById(args: Parameters<InMemoryMemory['getThreadById']>[0]) {
    const result = await super.getThreadById(args);
    if (!this.pause) return result;
    this.pause = false;
    const snapshot = structuredClone(result);
    this.readStarted.resolve();
    await this.releaseRead.promise;
    return snapshot;
  }
}

it('does not apply activation hints after an aborted thread read (#27792)', async () => {
  const storage = new PausedThreadStorage({ db: new InMemoryDB() });
  const store = new InMemoryStore();
  store.stores.memory = storage;
  const model = createLatchedModel('Unused', false);
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        model: model.model,
        observation: { messageTokens: 1000, bufferTokens: 10 },
        reflection: { observationTokens: 100_000 },
      },
    },
  });
  const engine = (await memory.omEngine)!;
  const threadId = 'activation-metadata';
  const resourceId = 'activation-resource';
  await storage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'Original title',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const record = await engine.getOrCreateRecord(threadId, resourceId);
  await storage.updateBufferedObservations({
    id: record.id,
    chunk: {
      cycleId: 'activation-metadata',
      observations: '- Prior observation',
      tokenCount: 5,
      messageTokens: 100,
      messageIds: ['prior'],
      lastObservedAt: new Date(),
      suggestedContinuation: 'Late continuation',
      threadTitle: 'Late title',
    },
  });
  const controller = new AbortController();
  storage.pause = true;
  const activation = engine.activate({ threadId, resourceId, abortSignal: controller.signal }).catch(() => undefined);
  try {
    await storage.readStarted.promise;
    controller.abort();
    await storage.patchThread({ id: threadId, metadata: { abortedByApplication: true } });
    storage.releaseRead.resolve();
    await activation;
    const thread = await storage.getThreadById({ threadId });
    expect(thread?.title).toBe('Original title');
    expect(thread?.metadata).toEqual({ abortedByApplication: true });
  } finally {
    storage.releaseRead.resolve();
    await activation;
  }
});

it('settles cancellation during stale buffer flag recovery', async () => {
  const provider = createLatchedModel('<observations>\n- Seen\n</observations>');
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: provider.model, messageTokens: 1000, bufferTokens: 10 },
        reflection: { model: provider.model, observationTokens: 100000 },
      },
    },
  });
  const engine = (await memory.omEngine)!;
  const storage = (await store.getStore('memory'))!;
  const threadId = 'review-stale-flag';
  const record = await engine.getOrCreateRecord(threadId, 'resource');
  await storage.setBufferingObservationFlag(record.id, true);
  const staleRecord = (await engine.getRecord(threadId, 'resource'))!;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const blocker = runOMCommit(engine.buffering.getLockKey(threadId, 'resource'), async () => {
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const controller = new AbortController();
  let settled = false;
  const operation = engine
    .buffer({ threadId, resourceId: 'resource', record: staleRecord, messages: [], abortSignal: controller.signal })
    .finally(() => {
      settled = true;
    });
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    controller.abort();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(true);
  } finally {
    release.resolve();
    provider.release();
    await Promise.all([blocker, operation]);
    await engine.settled();
  }
});

it('does not suppress future buffering after cancelling a queued buffer', async () => {
  const provider = createLatchedModel('<observations>\n- Seen\n</observations>');
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: provider.model, messageTokens: 1000, bufferTokens: 10 },
        reflection: { model: provider.model, observationTokens: 100000 },
      },
    },
  });
  const engine = (await memory.omEngine)!;
  const threadId = 'review-cancelled-boundary';
  const resourceId = 'resource';
  const record = { ...(await engine.getOrCreateRecord(threadId, resourceId)) };
  const message: MastraDBMessage = {
    id: 'request',
    threadId,
    resourceId,
    role: 'user',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Remember this request. '.repeat(20) }] },
  };
  await engine.persistMessages([message], threadId, resourceId);
  const owner = new AbortController();
  const cancelled = new AbortController();
  const first = engine.buffer({
    threadId,
    resourceId,
    messages: [message],
    record: { ...record },
    pendingTokens: 100,
    abortSignal: owner.signal,
    skipMinimumTokenCheck: true,
  });
  let second: Promise<unknown> | undefined;
  try {
    await provider.started;
    second = Promise.all(
      [500, 600].map(pendingTokens =>
        engine.buffer({
          threadId,
          resourceId,
          messages: [message],
          record: { ...record },
          pendingTokens,
          abortSignal: cancelled.signal,
        }),
      ),
    );
    cancelled.abort();
    await second;
    owner.abort();
    await first;
    await engine.settled();
    const status = await engine.getStatus({ threadId, resourceId, messages: [message] });
    expect(status.bufferedChunkCount).toBe(0);
    expect(status.pendingTokens).toBeGreaterThan(10);
    expect(status.shouldBuffer).toBe(true);
  } finally {
    owner.abort();
    cancelled.abort();
    provider.release();
    await Promise.allSettled([first, ...(second ? [second] : [])]);
    await engine.settled();
  }
});

it.each(['shared buffer', 'queued activation'] as const)('cancels context-overflow recovery during %s', async mode => {
  const provider = createLatchedModel('<observations>\n- Prior observation\n</observations>');
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: provider.model, messageTokens: 1000, bufferTokens: 10 },
        reflection: { model: provider.model, observationTokens: 100_000 },
      },
    },
  });
  const engine = (await memory.omEngine)!;
  const storage = (await store.getStore('memory'))!;
  const threadId = `overflow-abort-${mode}`;
  const resourceId = 'overflow-resource';
  const message: MastraDBMessage = {
    id: `request-${mode}`,
    threadId,
    resourceId,
    role: 'user',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Keep the accepted request.' }] },
  };
  await engine.persistMessages([message], threadId, resourceId);
  const record = await engine.getOrCreateRecord(threadId, resourceId);
  if (mode === 'queued activation')
    await storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId: 'overflow-buffer',
        observations: '- Prior observation',
        tokenCount: 5,
        messageTokens: 100,
        messageIds: ['prior'],
        lastObservedAt: new Date(0),
        threadTitle: 'Late title',
      },
    });
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const background =
    mode === 'shared buffer'
      ? engine.buffer({ threadId, resourceId, messages: [message], skipMinimumTokenCheck: true })
      : runOMCommit(engine.buffering.getLockKey(threadId, resourceId), async () => {
          entered.resolve();
          await release.promise;
        });
  if (mode === 'shared buffer') await provider.started;
  else await entered.promise;
  const controller = new AbortController();
  const processor = new ObservationalMemoryProcessor(engine, memory);
  const messageList = new MessageList({ threadId, resourceId });
  messageList.add([message], 'input');
  let settled = false;
  const recovery = processor
    .processAPIError({
      error: new APICallError({
        message: 'prompt is too long: 210345 tokens > 200000 maximum',
        url: 'https://api.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 400,
      }),
      messageList,
      messages: [message],
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
      abortSignal: controller.signal,
      abort: reason => {
        throw new Error(reason);
      },
    })
    .then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    controller.abort();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(true);
    expect(provider.cancelled).toBe(false);
  } finally {
    controller.abort();
    release.resolve();
    provider.release();
    await Promise.allSettled([background, recovery]);
    await engine.settled();
  }
  const after = await engine.getRecord(threadId, resourceId);
  expect(after?.activeObservations ?? '').toBe('');
  expect((await storage.listMessagesById({ messageIds: [message.id] })).messages).toHaveLength(1);
});
