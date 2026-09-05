/**
 * Regression tests for the timing information on the durable `step-start`
 * stream chunk (#22323).
 *
 * The durable LLM step publishes `step-start` from inside its chunk loop, so
 * the chunk only reaches the consumer after the provider has already produced
 * its first chunk. A consumer computing time to first token from chunk arrival
 * therefore reads ~0 and the entire prefill window is invisible. The payload
 * now carries `startedAt` — epoch milliseconds stamped immediately before the
 * provider call, at the same point that opens the MODEL_INFERENCE span — so
 * TTFT can be computed independently of when the chunk arrived.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { Agent } from '../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from './constants';
import { createDurableAgent } from './create-durable-agent';
import { emitStepStartEvent } from './stream-adapter';

const PREFILL_MS = 150;
// Allow timer slop so the assertion doesn't flake on loaded CI machines.
const PREFILL_ASSERT_MS = 140;

function createSlowPrefillModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => {
      // Stand in for provider prefill: time between the request being sent
      // and the first chunk being produced.
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

describe('durable step-start timing', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('emitStepStartEvent passes startedAt through to the payload verbatim', async () => {
    const runId = 'run-timing-passthrough';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      events.push(event);
    });

    const startedAt = Date.now();
    await emitStepStartEvent(pubsub, runId, { stepId: 'llm-execution', startedAt });
    await new Promise(resolve => setImmediate(resolve));

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe(AgentStreamEventTypes.STEP_START);
    expect((events[0]?.data as any).payload.startedAt).toBe(startedAt);
  });

  it('step-start carries the inference start so prefill time is measurable', async () => {
    const agent = new Agent({
      id: 'step-start-timing',
      name: 'Step Start Timing',
      instructions: 'Respond briefly.',
      model: createSlowPrefillModel('Hello!'),
    });
    const durable = createDurableAgent({ agent, pubsub });

    const { output, cleanup } = await durable.stream('Say hello');

    const seen: { chunk: any; arrivedAt: number }[] = [];
    for await (const chunk of output.fullStream) {
      seen.push({ chunk, arrivedAt: Date.now() });
    }
    cleanup();

    const stepStart = seen.find(({ chunk }) => chunk.type === 'step-start');
    const firstText = seen.find(({ chunk }) => chunk.type === 'text-delta');
    expect(stepStart).toBeDefined();
    expect(firstText).toBeDefined();

    const startedAt = stepStart!.chunk.payload.startedAt;
    expect(startedAt).toEqual(expect.any(Number));
    expect(startedAt).toBeLessThanOrEqual(Date.now());

    // The consumer-side TTFT computed from the stamped start must include the
    // provider's prefill window. Computed from chunk arrival instead, this is
    // single-digit milliseconds because the durable engine publishes
    // `step-start` only after the provider's first chunk.
    expect(firstText!.arrivedAt - startedAt).toBeGreaterThanOrEqual(PREFILL_ASSERT_MS);
  });
});
