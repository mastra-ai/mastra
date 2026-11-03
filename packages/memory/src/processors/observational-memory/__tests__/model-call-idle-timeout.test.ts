/**
 * OM model calls are bounded by inactivity, not total duration.
 *
 * A provider that accepts the request and then never answers must not stall the
 * Observer, Reflector, or extraction call forever: the call is aborted after
 * `RETRY_CONFIG.modelCallIdleTimeoutMs` without output and retried. A healthy
 * reply that keeps streaming must never be cut off, however long it runs.
 *
 * Uses MockLanguageModelV2 rather than aimock: these tests need a stream whose
 * chunk timing is driven by fake timers (minutes of simulated time, no real
 * sleeps). aimock serves real HTTP, so its latency would be real wall-clock time.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Extractor } from '../extractor';
import { ObserverRunner } from '../observer-runner';
import { ReflectorRunner } from '../reflector-runner';
import { RETRY_CONFIG } from '../retry';

/**
 * - `hang`: the provider accepts the request and never responds. Like a real
 *   fetch, it only settles when the request's abort signal fires.
 * - `stream`: a healthy reply split into `chunks` text deltas, `intervalMs` apart.
 */
type Reply = { kind: 'hang' } | { kind: 'stream'; text: string; chunks: number; intervalMs: number };

function createTimedModel(replies: Reply[]) {
  const calls: { signal?: AbortSignal }[] = [];
  const model = new MockLanguageModelV2({
    provider: 'mock',
    modelId: 'slow-model',
    doStream: async ({ abortSignal }: any) => {
      const reply = replies[Math.min(calls.length, replies.length - 1)]!;
      calls.push({ signal: abortSignal });
      if (reply.kind === 'hang') {
        return new Promise<never>((_, reject) => {
          abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true });
        });
      }
      // Non-empty deltas only: core drops empty text deltas, which would read as silence.
      const count = Math.min(reply.chunks, reply.text.length);
      const pieces = Array.from({ length: count }, (_, i) =>
        reply.text.slice(
          Math.floor((i * reply.text.length) / count),
          Math.floor(((i + 1) * reply.text.length) / count),
        ),
      );
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: new ReadableStream({
          async start(controller) {
            const onAbort = () => controller.error(abortSignal.reason);
            abortSignal?.addEventListener('abort', onAbort, { once: true });
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: '1' });
            for (const delta of pieces) {
              await new Promise(resolve => setTimeout(resolve, reply.intervalMs));
              if (abortSignal?.aborted) return;
              controller.enqueue({ type: 'text-delta', id: '1', delta });
            }
            abortSignal?.removeEventListener('abort', onAbort);
            controller.enqueue({ type: 'text-end', id: '1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        warnings: [],
      };
    },
  });
  return { model, calls };
}

function createMessage(text: string, role: 'user' | 'assistant', threadId = 'thread-1'): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    threadId,
    resourceId: 'resource-1',
    content: { format: 2, parts: [{ type: 'text', text }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  };
}

function createObserverRunner(model: MockLanguageModelV2, extractors: Extractor<any>[] = []) {
  return new ObserverRunner({
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
      observeAttachments: false,
      extractors,
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: model as any }),
    tokenCounter: { countMessages: () => 1 } as any,
  });
}

function createReflectorRunner(model: MockLanguageModelV2) {
  return new ReflectorRunner({
    reflectionConfig: { model: 'mock/model', observationTokens: 1000 } as any,
    observationConfig: { model: 'mock/model', messageTokens: 1000 } as any,
    tokenCounter: { countObservations: (text: string) => text?.length ?? 0 } as any,
    storage: {} as any,
    scope: 'thread',
    buffering: {} as any,
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn(),
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: model as any }),
  });
}

/**
 * Advance fake time in small steps. Agent setup before the provider request does
 * real async work (module loading), which cannot progress inside a single large
 * fake-clock jump, so yield to the real event loop between steps.
 */
async function advance(ms: number, step = 1_000) {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await vi.advanceTimersByTimeAsync(Math.min(step, ms - elapsed));
    for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve));
  }
}

/** Wait (real time) until the provider has been asked `count` times, without moving the fake clock. */
async function untilCalls(calls: unknown[], count: number) {
  for (let i = 0; i < 500 && calls.length < count; i++) await new Promise(resolve => setImmediate(resolve));
  expect(calls).toHaveLength(count);
}

/** Settle-state probe, so a stalled call fails an assertion instead of hanging the test. */
function track<T>(promise: Promise<T>) {
  const state: { status: 'pending' | 'resolved' | 'rejected'; value?: T; error?: unknown } = { status: 'pending' };
  promise.then(
    value => Object.assign(state, { status: 'resolved', value }),
    error => Object.assign(state, { status: 'rejected', error }),
  );
  return state;
}

const OBSERVATION = '* User uploaded the pile plan. 46 piles confirmed.';
const REPLY = `<observations>\n${OBSERVATION}\n</observations>`;
const MULTI_THREAD_OBSERVATION = '* User asked for the pile count.';
const MULTI_THREAD_REPLY = `<observations>\n<thread id="thread-1">\n${MULTI_THREAD_OBSERVATION}\n</thread>\n</observations>`;
const OBSERVATIONS_TO_REFLECT = `${OBSERVATION}\n* Older detail that can be dropped.`;

const MINUTE = 60_000;
/** A long, healthy reply: one character at a time, spread over 10 minutes. */
const SLOW_REPLY = (text: string): Reply => ({
  kind: 'stream',
  text,
  chunks: text.length,
  intervalMs: Math.ceil((10 * MINUTE) / text.length),
});
const FAST_REPLY = (text: string): Reply => ({ kind: 'stream', text, chunks: 1, intervalMs: 10 });

describe('OM model call idle timeout', () => {
  const originalConfig = { ...RETRY_CONFIG };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    RETRY_CONFIG.initialDelayMs = 1;
    RETRY_CONFIG.maxDelayMs = 4;
    RETRY_CONFIG.jitter = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.assign(RETRY_CONFIG, originalConfig);
  });

  describe('a healthy reply that streams for longer than any whole-call cap completes', () => {
    it('observer', async () => {
      const { model, calls } = createTimedModel([SLOW_REPLY(REPLY)]);
      const runner = createObserverRunner(model);

      const state = track(runner.call(undefined, [createMessage('Add the pile plan.', 'user')]));
      await untilCalls(calls, 1);
      await advance(11 * MINUTE);

      expect(state.status).toBe('resolved');
      expect(state.value?.observations.trim()).toBe(OBSERVATION);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.signal?.aborted).toBe(false);
    });

    it('multi-thread observer', async () => {
      const { model, calls } = createTimedModel([SLOW_REPLY(MULTI_THREAD_REPLY)]);
      const runner = createObserverRunner(model);

      const state = track(
        runner.callMultiThread(undefined, new Map([['thread-1', [createMessage('How many piles?', 'user')]]]), [
          'thread-1',
        ]),
      );
      await untilCalls(calls, 1);
      await advance(11 * MINUTE);

      expect(state.status).toBe('resolved');
      expect(state.value?.results.get('thread-1')?.observations.trim()).toBe(MULTI_THREAD_OBSERVATION);
      expect(calls).toHaveLength(1);
    });

    it('reflector', async () => {
      const { model, calls } = createTimedModel([SLOW_REPLY(REPLY)]);
      const runner = createReflectorRunner(model);

      const state = track(runner.call(OBSERVATIONS_TO_REFLECT));
      await untilCalls(calls, 1);
      await advance(11 * MINUTE);

      expect(state.status).toBe('resolved');
      expect(state.value?.observations.trim()).toBe(OBSERVATION);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.signal?.aborted).toBe(false);
    });

    it('structured extraction', async () => {
      const extraction = JSON.stringify({ mood: { mood: 'calm' } });
      const { model, calls } = createTimedModel([FAST_REPLY(REPLY), SLOW_REPLY(extraction)]);
      const runner = createObserverRunner(model, [moodExtractor()]);

      const state = track(runner.call(undefined, [createMessage('Add the pile plan.', 'user')]));
      await untilCalls(calls, 1);
      await advance(1_000);
      await untilCalls(calls, 2);
      await advance(11 * MINUTE);

      expect(state.status).toBe('resolved');
      expect(state.value?.extractedValues).toMatchObject({ mood: { mood: 'calm' } });
      expect(calls).toHaveLength(2);
    });
  });

  describe('a provider that never answers is aborted and retried', () => {
    const idle = () => RETRY_CONFIG.modelCallIdleTimeoutMs;

    it('observer', async () => {
      const { model, calls } = createTimedModel([{ kind: 'hang' }, FAST_REPLY(REPLY)]);
      const runner = createObserverRunner(model);

      const state = track(runner.call(undefined, [createMessage('Add the pile plan.', 'user')]));
      await untilCalls(calls, 1);
      await advance(idle() - 1_000);
      expect(state.status).toBe('pending');
      expect(calls).toHaveLength(1);

      await advance(2_000);
      expect(state.status).toBe('resolved');
      expect(state.value?.observations.trim()).toBe(OBSERVATION);
      expect(calls).toHaveLength(2);
      expect(calls[0]!.signal?.aborted).toBe(true);
    });

    it('multi-thread observer', async () => {
      const { model, calls } = createTimedModel([{ kind: 'hang' }, FAST_REPLY(MULTI_THREAD_REPLY)]);
      const runner = createObserverRunner(model);

      const state = track(
        runner.callMultiThread(undefined, new Map([['thread-1', [createMessage('How many piles?', 'user')]]]), [
          'thread-1',
        ]),
      );
      await untilCalls(calls, 1);
      await advance(idle() + 1_000);

      expect(state.status).toBe('resolved');
      expect(state.value?.results.get('thread-1')?.observations.trim()).toBe(MULTI_THREAD_OBSERVATION);
      expect(calls).toHaveLength(2);
    });

    it('reflector', async () => {
      const { model, calls } = createTimedModel([{ kind: 'hang' }, FAST_REPLY(REPLY)]);
      const runner = createReflectorRunner(model);

      const state = track(runner.call(OBSERVATIONS_TO_REFLECT));
      await untilCalls(calls, 1);
      await advance(idle() - 1_000);
      expect(state.status).toBe('pending');

      await advance(2_000);
      expect(state.status).toBe('resolved');
      expect(state.value?.observations.trim()).toBe(OBSERVATION);
      expect(calls).toHaveLength(2);
      expect(calls[0]!.signal?.aborted).toBe(true);
    });

    it('structured extraction', async () => {
      const extraction = JSON.stringify({ mood: { mood: 'calm' } });
      const { model, calls } = createTimedModel([FAST_REPLY(REPLY), { kind: 'hang' }, FAST_REPLY(extraction)]);
      const runner = createObserverRunner(model, [moodExtractor()]);

      const state = track(runner.call(undefined, [createMessage('Add the pile plan.', 'user')]));
      await untilCalls(calls, 1);
      await advance(1_000);
      await untilCalls(calls, 2);
      await advance(idle() + 1_000);

      expect(state.status).toBe('resolved');
      expect(state.value?.extractedValues).toMatchObject({ mood: { mood: 'calm' } });
      expect(calls).toHaveLength(3);
      expect(calls[1]!.signal?.aborted).toBe(true);
    });
  });
});

function moodExtractor() {
  return new Extractor({
    name: 'mood',
    instructions: 'The user mood.',
    schema: z.object({ mood: z.string() }),
    metadataKeyPath: false,
  });
}
