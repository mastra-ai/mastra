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
