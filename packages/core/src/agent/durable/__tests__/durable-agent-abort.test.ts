/**
 * DurableAgent abort-signal tests
 *
 * Exercises the runtime abort path added by the `abort_signal_durable` slice:
 *   - `result.abort()` mid-stream flips the registry-installed AbortController,
 *     the LLM step surfaces an AbortError, and the pubsub bridge dispatches
 *     `onAbort`.
 *   - An externally-supplied pre-aborted `abortSignal` short-circuits the run.
 *
 * The model mock honours `options.abortSignal` by rejecting `doStream` with an
 * AbortError once the signal fires, mirroring real AI SDK provider behaviour.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createAbortableModel() {
  return new MockLanguageModelV2({
    doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
      // If the caller already aborted before the call landed, fail fast with
      // the canonical AbortError name so the durable abort heuristic fires.
      if (abortSignal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            // Hold the stream open and resolve with an AbortError as soon as
            // the signal fires — the durable step then catches AbortError and
            // emits the abort event to the bridge.
            if (abortSignal) {
              abortSignal.addEventListener(
                'abort',
                () => {
                  const err = new Error('Aborted');
                  err.name = 'AbortError';
                  controller.error(err);
                },
                { once: true },
              );
            }
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

/** A model that streams a short reply and finishes normally. */
function createFinishingModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'hello' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

describe('DurableAgent abort signal', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('result.abort() cancels the run and invokes onAbort', async () => {
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-runtime-agent',
      name: 'Abort Runtime Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let abortPayload: unknown;
    const { output, runId, abort, cleanup } = await durableAgent.stream('Go', {
      onAbort: data => {
        abortPayload = data;
      },
    });

    // Give the workflow a tick to subscribe + call doStream before we abort.
    await new Promise(r => setTimeout(r, 10));
    abort();

    try {
      await output.consumeStream();
    } catch {
      // The bridge errors the stream after firing onAbort; expected.
    }

    expect(runId).toBeDefined();
    expect(abortPayload).toBeDefined();

    cleanup();
  });

  it('onAbort receives the text streamed before the abort', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Hello' });
            abortSignal?.addEventListener(
              'abort',
              () => {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                controller.error(err);
              },
              { once: true },
            );
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const baseAgent = new Agent({
      id: 'abort-partial-text-agent',
      name: 'Abort Partial Text Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let abortPayload: { steps: unknown[]; text?: string } | undefined;
    const { output, abort, cleanup } = await durableAgent.stream('Go', {
      onAbort: data => {
        abortPayload = data;
      },
    });

    await new Promise(r => setTimeout(r, 10));
    abort();

    try {
      await output.consumeStream();
    } catch {
      // The bridge errors the stream after firing onAbort; expected.
    }

    expect(abortPayload?.text).toBe('Hello');

    cleanup();
  });

  it('observe().abort() still completes when cleanup is called immediately', async () => {
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-observed-agent',
      name: 'Abort Observed Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const source = await durableAgent.stream('Go');
    await new Promise(r => setTimeout(r, 10));

    let finishReason: string | undefined;
    const observed = await durableAgent.observe(source.runId, {
      onFinish: result => {
        finishReason = result.finishReason;
      },
    });

    const sourceConsumption = source.output.consumeStream().catch(() => undefined);
    const observedConsumption = observed.output.consumeStream().catch(() => undefined);

    void observed.abort();
    observed.cleanup();

    await Promise.all([sourceConsumption, observedConsumption]);

    expect(finishReason).toBe('abort');

    source.cleanup();
  });

  it('an abort requested before the run starts short-circuits it', async () => {
    // `abortRunStream()` on a run that has not started yet has no controller
    // to flip, so it records the intent. The durable path has to honor that
    // intent when the run finally starts, or a run cancelled while it was
    // queued executes to completion.
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-preabort-intent-agent',
      name: 'Abort Preabort Intent Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const runId = 'queued-run-1';
    durableAgent.abortRunStream(runId);

    let abortPayload: unknown;
    const { output, cleanup } = await durableAgent.stream('Go', {
      runId,
      onAbort: data => {
        abortPayload = data;
      },
    });

    try {
      await output.consumeStream();
    } catch {
      // expected — the run never produced a normal finish
    }

    expect(abortPayload).toBeDefined();

    cleanup();
  });

  it('a run whose id was never aborted still runs', async () => {
    const baseAgent = new Agent({
      id: 'abort-preabort-negative-agent',
      name: 'Abort Preabort Negative Agent',
      instructions: 'Test',
      model: createFinishingModel() as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Another run's recorded intent must not bleed onto this one.
    durableAgent.abortRunStream('some-other-run');

    let abortPayload: unknown;
    const { output, cleanup } = await durableAgent.stream('Go', {
      runId: 'unaffected-run',
      onAbort: data => {
        abortPayload = data;
      },
    });

    expect(await output.text).toBe('hello');
    expect(abortPayload).toBeUndefined();

    cleanup();
  });

  it('abortThreadStream stops a durable run that is already executing', async () => {
    // A durable run keeps its controller on the durable run registry, not in
    // the thread runtime's prepared-run map, so the base implementation reaches
    // neither: without the durable abort request the run streams on.
    const baseAgent = new Agent({
      id: 'abort-thread-stream-agent',
      name: 'Abort Thread Stream Agent',
      instructions: 'Test',
      model: createAbortableModel() as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const threadId = 'abort-thread-stream-thread';
    const resourceId = 'abort-thread-stream-resource';

    let abortPayload: unknown;
    const { output, cleanup } = await durableAgent.stream('Go', {
      memory: { thread: threadId, resource: resourceId },
      onAbort: data => {
        abortPayload = data;
      },
    });

    // Give the workflow a tick to subscribe + call doStream before we abort.
    await new Promise(r => setTimeout(r, 10));
    expect(durableAgent.abortThreadStream({ threadId, resourceId })).toBe(true);

    try {
      await output.consumeStream();
    } catch {
      // expected - the run never produced a normal finish
    }

    expect(abortPayload).toBeDefined();

    cleanup();
  });

  it('abortRunStream stops a durable run that is already executing', async () => {
    const baseAgent = new Agent({
      id: 'abort-run-stream-agent',
      name: 'Abort Run Stream Agent',
      instructions: 'Test',
      model: createAbortableModel() as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let abortPayload: unknown;
    const { output, runId, cleanup } = await durableAgent.stream('Go', {
      memory: { thread: 'abort-run-stream-thread', resource: 'abort-run-stream-resource' },
      onAbort: data => {
        abortPayload = data;
      },
    });

    await new Promise(r => setTimeout(r, 10));
    expect(durableAgent.abortRunStream(runId)).toBe(true);

    try {
      await output.consumeStream();
    } catch {
      // expected - the run never produced a normal finish
    }

    expect(abortPayload).toBeDefined();

    cleanup();
  });

  it('pre-aborted external abortSignal short-circuits the run', async () => {
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-preaborted-agent',
      name: 'Abort Preaborted Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const controller = new AbortController();
    controller.abort();

    let abortPayload: unknown;
    const { output, cleanup } = await durableAgent.stream('Go', {
      abortSignal: controller.signal,
      onAbort: data => {
        abortPayload = data;
      },
    });

    try {
      await output.consumeStream();
    } catch {
      // expected — the run never produced a normal finish
    }

    expect(abortPayload).toBeDefined();

    cleanup();
  });
});
