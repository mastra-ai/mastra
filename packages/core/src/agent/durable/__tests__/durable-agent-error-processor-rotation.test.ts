import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function makeFailThenAnswerModel(failures = 1) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls <= failures) {
        throw new APICallError({
          message: 'upstream failed',
          url: 'https://model.example.com/v1/messages',
          requestBodyValues: {},
          statusCode: 500,
          isRetryable: false,
        });
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'the retried answer' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('durable agent API-error retry', () => {
  it('lets an error processor rotate the response id before the retry', async () => {
    const rotations: Array<{ before: string | undefined; after: string | undefined }> = [];
    const agent = new Agent({
      id: 'durable-api-error-rotation',
      name: 'durable-api-error-rotation',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel() as LanguageModelV2, maxRetries: 0 }],
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'rotate-on-api-error',
          processAPIError: async ({ messageId, rotateResponseMessageId }) => {
            rotations.push({ before: messageId, after: rotateResponseMessageId?.() });
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { fullStream, cleanup } = await durableAgent.stream('hello');

    const chunks: any[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }
    await cleanup?.();

    const text = chunks
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.payload?.text ?? '')
      .join('');
    expect(text).toBe('the retried answer');

    expect(rotations).toHaveLength(1);
    expect(rotations[0]!.before).toBeTruthy();
    expect(rotations[0]!.after).toBeTruthy();
    expect(rotations[0]!.after).not.toBe(rotations[0]!.before);
  });
  it('carries a rotated id into the next retry instead of falling back', async () => {
    const rotations: Array<{ before: string | undefined; after: string | undefined }> = [];
    const agent = new Agent({
      id: 'durable-api-error-rotation-chain',
      name: 'durable-api-error-rotation-chain',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(2) as LanguageModelV2, maxRetries: 0 }],
      maxProcessorRetries: 2,
      errorProcessors: [
        {
          id: 'rotate-on-api-error',
          processAPIError: async ({ messageId, rotateResponseMessageId }) => {
            rotations.push({ before: messageId, after: rotateResponseMessageId?.() });
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { fullStream, cleanup } = await durableAgent.stream('hello');
    for await (const _chunk of fullStream) {
    }
    await cleanup?.();

    expect(rotations).toHaveLength(2);
    expect(rotations[1]!.before).toBe(rotations[0]!.after);
  });
});
