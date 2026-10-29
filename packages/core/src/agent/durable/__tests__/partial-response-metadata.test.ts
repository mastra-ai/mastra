/**
 * Providers such as OpenRouter split response metadata across several `response-metadata`
 * chunks (an id-only chunk, then a modelId-only chunk). Later chunks must not erase fields
 * an earlier chunk already supplied (#26584).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

// MockLanguageModelV2: AIMock speaks the OpenAI wire format, whose provider emits a single
// response-metadata chunk, so it cannot express split metadata.
function createSplitMetadataModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'gen-repro', timestamp: new Date(0) },
        { type: 'response-metadata', modelId: 'provider-model' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

// Distributed pubsubs deliver events as JSON, so Dates arrive as ISO strings.
class JsonEventEmitterPubSub extends EventEmitterPubSub {
  override publish(topic: string, event: any) {
    return super.publish(topic, JSON.parse(JSON.stringify(event)));
  }
}

const engines = ['regular', 'durable', 'evented', 'durable (json pubsub)', 'evented (json pubsub)'] as const;

describe('partial response-metadata chunks', () => {
  let pubsub: EventEmitterPubSub;

  afterEach(async () => {
    await pubsub.close();
  });

  for (const engine of engines) {
    it(`${engine}: keeps the response id when a later chunk only carries the modelId`, async () => {
      const agent = new Agent({
        id: `partial-metadata-agent-${engine}`,
        name: 'Partial Metadata Agent',
        instructions: 'Test',
        model: createSplitMetadataModel() as LanguageModelV2,
      });

      const stepResponses: any[] = [];
      const finishResponses: any[] = [];
      const options = {
        onStepFinish: (payload: any) => {
          stepResponses.push(payload.response);
        },
        onFinish: (payload: any) => {
          finishResponses.push(payload.response);
        },
      };

      pubsub = engine.endsWith('(json pubsub)') ? new JsonEventEmitterPubSub() : new EventEmitterPubSub();
      if (engine === 'regular') {
        const result = await agent.stream('hi', options);
        await result.consumeStream();
        const response = await result.response;
        expect(response.id).toBe('gen-repro');
        expect(response.modelId).toBe('provider-model');
        expect(response.timestamp).toEqual(new Date(0));
      } else {
        const wrapped = engine.startsWith('durable')
          ? createDurableAgent({ agent, pubsub })
          : createEventedAgent({ agent, pubsub });
        const { output, cleanup } = await wrapped.stream('hi', options);
        await output.consumeStream();
        cleanup();
      }

      expect(stepResponses.length).toBeGreaterThan(0);
      for (const response of [...stepResponses, ...finishResponses]) {
        expect(response.id).toBe('gen-repro');
        expect(response.modelId).toBe('provider-model');
        expect(response.timestamp).toEqual(new Date(0));
      }
      expect(finishResponses).toHaveLength(1);
    });
  }
});
