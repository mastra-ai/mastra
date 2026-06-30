/**
 * DurableAgent messageId rotation tests
 *
 * The non-durable agentic loop rotates the per-iteration messageId so each
 * assistant turn's stream chunks carry a distinct messageId. The durable
 * loop must do the same; otherwise downstream consumers cannot tell which
 * chunks belong to which iteration.
 *
 * This test drives a durable agent through two iterations (one tool-call
 * then a final text response) and asserts the emitted chunks across the
 * two iterations carry distinct messageIds.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolThenTextModel(toolName: string, toolArgs: object, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount += 1;
      const stream: ReadableStream<any> =
        callCount === 1
          ? convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: `call-${callCount}`,
                toolName,
                input: JSON.stringify(toolArgs),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ])
          : convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: finalText },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]);
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
}

describe('DurableAgent messageId rotation between iterations', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('emits chunks with distinct messageIds across iterations', async () => {
    const model = createToolThenTextModel('weatherTool', { location: 'Toronto' }, 'It is sunny.');

    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather for a location',
      inputSchema: z.object({ location: z.string() }),
      execute: async () => ({ temperature: 20, conditions: 'sunny' }),
    });

    const baseAgent = new Agent({
      id: 'msgid-rotation-agent',
      name: 'MsgId Rotation Agent',
      instructions: 'Get weather information.',
      model: model as LanguageModelV2,
      tools: { weatherTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.stream('Weather in Toronto?');

    // Collect distinct messageIds attached to any tool-call / text-delta /
    // finish chunks (the chunks that the loop tags with the per-iteration id).
    const messageIds = new Set<string>();
    for await (const chunk of result.fullStream as AsyncIterable<any>) {
      const candidateId =
        chunk?.messageId ??
        chunk?.payload?.messageId ??
        chunk?.payload?.response?.messageId ??
        chunk?.payload?.id;
      if (typeof candidateId === 'string' && candidateId.length > 0) {
        messageIds.add(candidateId);
      }
    }
    await result.output.getFullOutput();
    result.cleanup();

    // Two iterations should produce at least two distinct messageIds on the
    // emitted chunks; with rotation broken, they all share one id.
    expect(messageIds.size).toBeGreaterThanOrEqual(2);
  });
});
