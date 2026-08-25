/**
 * Regression tests for `step-start.payload.startedAt`.
 *
 * `step-start` carried no timestamp, so a consumer measuring time to first
 * token had to use the chunk's arrival time. On the durable engine that is not
 * a usable start instant: `step-start` is published from inside the chunk loop
 * in `workflows/steps/llm-execution.ts`, which only runs once the provider has
 * already produced its first chunk. The gap between `step-start` and the first
 * content chunk is then microseconds, and the entire prefill window lands in no
 * bucket at all.
 *
 * `startedAt` is stamped where the MODEL_INFERENCE span opens, immediately
 * before the provider call, on both the durable and the regular engine.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Agent } from '../agent';
import { createDurableAgent } from './create-durable-agent';

/** Milliseconds the mock provider spends before yielding its first chunk. */
const PREFILL_MS = 150;
/** Slack for timer coarseness so the assertions do not flake under load. */
const PREFILL_LOWER_BOUND_MS = 80;

function createSlowModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => {
      // Stand in for provider prefill: the model is reached, and takes this
      // long to produce anything.
      await new Promise(resolve => setTimeout(resolve, PREFILL_MS));
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

/** Reads a stream, recording when each chunk was observed. */
async function collectWithArrival(stream: ReadableStream<any>) {
  const chunks: { chunk: any; arrivedAt: number }[] = [];
  for await (const chunk of stream) {
    chunks.push({ chunk, arrivedAt: Date.now() });
  }
  return chunks;
}

describe('step-start startedAt', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('durable step-start carries the inference start, not the emit time', async () => {
    const agent = new Agent({
      id: 'step-start-timing-durable',
      name: 'Step Start Timing Durable',
      instructions: 'Respond briefly.',
      model: createSlowModel('Hello!'),
    });
    const durable = createDurableAgent({ agent, pubsub });

    const startedStreaming = Date.now();
    const { output, cleanup } = await durable.stream('Say hello');
    const observed = await collectWithArrival(output.fullStream);
    cleanup();

    const stepStart = observed.find(entry => entry.chunk.type === 'step-start');
    expect(stepStart).toBeDefined();

    const startedAt = stepStart!.chunk.payload.startedAt;
    expect(typeof startedAt).toBe('number');

    // The stamp predates the chunk that carries it by roughly the prefill.
    // This is the whole point: arrival time cannot recover this window,
    // because the emit happens after the provider's first chunk.
    expect(stepStart!.arrivedAt - startedAt).toBeGreaterThanOrEqual(PREFILL_LOWER_BOUND_MS);

    // And it is a real instant from this run, not a stale or future value.
    expect(startedAt).toBeGreaterThanOrEqual(startedStreaming);
    expect(startedAt).toBeLessThanOrEqual(stepStart!.arrivedAt);
  });

  it('durable time to first token computed from startedAt is non-zero', async () => {
    const agent = new Agent({
      id: 'step-start-timing-ttft',
      name: 'Step Start Timing TTFT',
      instructions: 'Respond briefly.',
      model: createSlowModel('Hello!'),
    });
    const durable = createDurableAgent({ agent, pubsub });

    const { output, cleanup } = await durable.stream('Say hello');
    const observed = await collectWithArrival(output.fullStream);
    cleanup();

    const stepStart = observed.find(entry => entry.chunk.type === 'step-start');
    const firstText = observed.find(entry => entry.chunk.type === 'text-delta');
    expect(stepStart).toBeDefined();
    expect(firstText).toBeDefined();

    const ttftFromStamp = firstText!.arrivedAt - stepStart!.chunk.payload.startedAt;
    expect(ttftFromStamp).toBeGreaterThanOrEqual(PREFILL_LOWER_BOUND_MS);

    // The value the same consumer would have computed before this change,
    // kept as the contrast that motivates the field.
    const ttftFromArrival = firstText!.arrivedAt - stepStart!.arrivedAt;
    expect(ttftFromArrival).toBeLessThan(ttftFromStamp);
  });

  it('the regular engine stamps startedAt on step-start too', async () => {
    const agent = new Agent({
      id: 'step-start-timing-regular',
      name: 'Step Start Timing Regular',
      instructions: 'Respond briefly.',
      model: createSlowModel('Hello!'),
    });

    const startedStreaming = Date.now();
    const stream = await agent.stream('Say hello');
    const observed = await collectWithArrival(stream.fullStream);

    const stepStart = observed.find(entry => entry.chunk.type === 'step-start');
    expect(stepStart).toBeDefined();

    const startedAt = stepStart!.chunk.payload.startedAt;
    expect(typeof startedAt).toBe('number');
    expect(startedAt).toBeGreaterThanOrEqual(startedStreaming);
    expect(startedAt).toBeLessThanOrEqual(stepStart!.arrivedAt);

    // The regular engine emits step-start at stream open rather than after the
    // first chunk, so the recoverable prefill is smaller than on the durable
    // path, but the stamp still predates the provider's first output.
    const firstText = observed.find(entry => entry.chunk.type === 'text-delta');
    expect(firstText).toBeDefined();
    expect(firstText!.arrivedAt - startedAt).toBeGreaterThanOrEqual(PREFILL_LOWER_BOUND_MS);
  });
});
