import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/**
 * The trailing assistant guard adds its synthetic user turn to the run's
 * MessageList as `context`. Durable execution serializes the MessageList
 * between steps, so this covers that the turn survives the round trip into
 * later steps while still never being persisted to the thread.
 */
describe('DurableAgent trailing assistant guard', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('guards Gemini 3 across steps without persisting the synthetic turn', async () => {
    const memory = new MockMemory();
    const prompts: LanguageModelV2Prompt[] = [];
    let call = 0;

    const model = new MockLanguageModelV2({
      provider: 'google.generative-ai',
      modelId: 'gemini-3.5-flash-lite',
      doStream: async options => {
        prompts.push(options.prompt);
        call++;
        const chunks =
          call === 1
            ? [
                { type: 'stream-start' as const, warnings: [] },
                {
                  type: 'tool-call' as const,
                  toolCallType: 'function' as const,
                  toolCallId: 'call-1',
                  toolName: 'ping',
                  input: '{}',
                  providerExecuted: false,
                },
                {
                  type: 'finish' as const,
                  finishReason: 'tool-calls' as const,
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start' as const, warnings: [] },
                { type: 'text-start' as const, id: 'text-1' },
                { type: 'text-delta' as const, id: 'text-1', delta: 'done' },
                { type: 'text-end' as const, id: 'text-1' },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ];
        return {
          stream: convertArrayToReadableStream(chunks),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const ping = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      execute: async () => 'pong',
    });

    const durableAgent = createDurableAgent({
      agent: new Agent({ id: 'guarded', name: 'guarded', instructions: 'x', model, memory, tools: { ping } }),
      pubsub,
    });

    const result = await durableAgent.stream(
      [
        { role: 'user', content: 'question' },
        { role: 'assistant', content: 'draft' },
      ],
      { memory: { thread: 'thread-guard', resource: 'resource-guard' } },
    );
    for await (const _chunk of result.fullStream as AsyncIterable<unknown>) {
      // drain
    }

    const roles = (prompt: LanguageModelV2Prompt) => prompt.filter(m => m.role !== 'system').map(m => m.role);
    expect(roles(prompts[0]!)).toEqual(['user', 'assistant', 'user']);
    // The context turn added in step 1 is still present after the durable round trip.
    expect(roles(prompts[1]!)).toEqual(['user', 'assistant', 'user', 'assistant', 'tool']);

    const { messages } = await memory.recall({ threadId: 'thread-guard', resourceId: 'resource-guard' });
    expect(JSON.stringify(messages)).not.toContain('Continue.');
  });
});
