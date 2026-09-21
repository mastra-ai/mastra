import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function makeFailThenAnswerModel(failures = 1, recordPrompt?: (prompt: unknown) => void) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      calls++;
      recordPrompt?.(prompt);
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
    const memory = new MockMemory();
    const threadId = 'thread-recovered-rotation';
    const resourceId = 'resource-recovered-rotation';
    const agent = new Agent({
      id: 'durable-api-error-rotation',
      name: 'durable-api-error-rotation',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel() as LanguageModelV2, maxRetries: 0 }],
      memory,
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
    const { fullStream, cleanup } = await durableAgent.stream('hello', {
      memory: { thread: threadId, resource: resourceId },
      maxProcessorRetries: 1,
    });

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
    await vi.waitFor(async () => {
      const recalled = await memory.recall({ threadId, resourceId });
      expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    });
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.flatMap(message => message.content.parts ?? []).some(part => part.type === 'error')).toBe(false);
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
    expect(rotations[0]!.after).toBeTruthy();
    expect(rotations[1]!.before).toBe(rotations[0]!.after);
  });
  it('keeps the final partial response and error together after retry-budget rotation', async () => {
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `response-${attempts}`, modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: `text-${attempts}` },
            { type: 'text-delta', id: `text-${attempts}`, delta: `partial ${attempts}` },
            { type: 'text-end', id: `text-${attempts}` },
            { type: 'error', error: new Error('retry budget exhausted') },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'durable-api-error-terminal-rotation',
      name: 'durable-api-error-terminal-rotation',
      instructions: 'You are helpful.',
      model: [{ model: model as LanguageModelV2, maxRetries: 0 }],
      memory,
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'rotate-on-api-error',
          processAPIError: async ({ rotateResponseMessageId }) => {
            rotateResponseMessageId?.();
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const threadId = 'thread-terminal-rotation';
    const resourceId = 'resource-terminal-rotation';
    const { fullStream, cleanup } = await durableAgent.stream('hello', {
      memory: { thread: threadId, resource: resourceId },
      maxProcessorRetries: 1,
    });
    try {
      for await (const _chunk of fullStream) {
      }
    } catch {
      // The terminal error is expected after the retry budget is exhausted.
    }

    await vi.waitFor(async () => {
      const recalled = await memory.recall({ threadId, resourceId });
      expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    });
    const { messages } = await memory.recall({ threadId, resourceId });
    const [textPart, errorPart] = messages[1]?.content.parts ?? [];
    expect(textPart).toMatchObject({ type: 'text' });
    expect((textPart as { text?: string }).text).toMatch(/^partial [2-9]\d*$/);
    expect(errorPart).toMatchObject({
      type: 'error',
      error: { name: 'Error', message: 'retry budget exhausted' },
    });
    expect(messages[1]?.content.parts).toHaveLength(2);
    await cleanup?.();
  });

  it('lets an error processor put a signal in front of the retried request', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'durable-api-error-signal',
      name: 'durable-api-error-signal',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(1, prompt => prompts.push(prompt)) as LanguageModelV2, maxRetries: 0 }],
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'signal-on-api-error',
          processAPIError: async ({ sendSignal }) => {
            await sendSignal?.({ type: 'user', contents: 'keep the answer short this time' });
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

    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[0])).not.toContain('keep the answer short this time');
    expect(JSON.stringify(prompts[1])).toContain('keep the answer short this time');
  });
});
