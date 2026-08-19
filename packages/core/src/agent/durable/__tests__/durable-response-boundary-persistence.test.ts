import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function makeToolThenAnswerModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'looking it up' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'tc-1',
              toolName: 'lookup',
              input: JSON.stringify({ x: 1 }),
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-2' },
          { type: 'text-delta', id: 'text-2', delta: 'here is the answer' },
          { type: 'text-end', id: 'text-2' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('durable response boundary persistence', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('stores each iteration as its own assistant message, sealed across the state round-trip', async () => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'durable-boundary-persistence',
      name: 'durable-boundary-persistence',
      instructions: 'You are helpful.',
      model: makeToolThenAnswerModel() as LanguageModelV2,
      tools: {
        lookup: {
          description: 'A tool',
          parameters: z.object({ x: z.number() }),
          execute: async ({ x }: { x: number }) => `result-${x}`,
        },
      },
      memory,
    });

    const durableAgent = createDurableAgent({ agent, pubsub });
    const { fullStream, cleanup } = await durableAgent.stream('hello', {
      maxSteps: 3,
      memory: { thread: 'thread-boundary', resource: 'resource-boundary' },
    });
    for await (const _chunk of fullStream as AsyncIterable<unknown>) {
    }
    await cleanup?.();

    const { messages } = await memory.recall({ threadId: 'thread-boundary', resourceId: 'resource-boundary' });
    const assistantMessages = messages.filter(message => message.role === 'assistant');

    expect(assistantMessages).toHaveLength(2);
    expect(assistantMessages[0]!.id).not.toBe(assistantMessages[1]!.id);
    expect(JSON.stringify(assistantMessages[0]!.content)).toContain('looking it up');
    expect(JSON.stringify(assistantMessages[1]!.content)).toContain('here is the answer');
    expect(assistantMessages[0]!.content.metadata?.mastra).toMatchObject({ responseBoundary: true });
  });
});
