/**
 * Abort Signal Tests
 *
 * Tests abort signal propagation at two levels:
 * 1. Baseline: agent.generate() returns empty result on abort (framework behavior)
 * 2. OM-level: withAbortCheck detects the abort and throws AbortError
 */

import type { LanguageModelV2StreamPart } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent, MessageList } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { Memory } from '../../../index';

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
      a.abort();
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
