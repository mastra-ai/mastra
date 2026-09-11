import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage';
import { Agent } from './index';

/**
 * Regression coverage for the OpenAI `400 Duplicate item found` failure reported when a
 * caller sets `providerOptions.openai.previousResponseId`.
 *
 * `previousResponseId` hands conversation history to the provider: OpenAI restores prior
 * state server-side. Mastra was still replaying recalled thread history into the prompt on
 * top of that. Recalled assistant parts carry a persisted Responses itemId, which the
 * provider SDK converts into an `item_reference` sent alongside `previous_response_id` —
 * the same item twice, which OpenAI rejects.
 *
 * These tests cover the end-to-end wiring: that `providerOptions` given to `generate()` /
 * `stream()` actually reaches the memory processors, and that the write side (persistence)
 * is deliberately left untouched by the gate.
 */
describe('provider-side response chaining', () => {
  let memory: MockMemory;
  let agent: Agent;
  let prompts: any[][];

  const threadId = 'chain-thread';
  const resourceId = 'chain-resource';
  const memoryOptions = { thread: threadId, resource: resourceId };

  beforeEach(() => {
    memory = new MockMemory({ storage: new InMemoryStore() });
    prompts = [];

    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: 'first reply' }],
          warnings: [],
        };
      },
      doStream: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'first reply' },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });

    agent = new Agent({
      id: 'chain-agent',
      name: 'Chain Agent',
      instructions: 'Reply briefly.',
      model,
      memory,
    });
  });

  /** Conversation messages only — the system prompt is injected separately. */
  function conversationOf(callIndex: number) {
    return (prompts[callIndex] ?? []).filter((message: any) => message.role !== 'system');
  }

  function textOf(callIndex: number) {
    return JSON.stringify(prompts[callIndex] ?? []);
  }

  async function drain(result: any) {
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'error') throw chunk.error;
    }
  }

  async function storedMessages() {
    const store = await memory.storage.getStore('memory');
    const { messages } = await store!.listMessages({ threadId, perPage: false });
    return messages;
  }

  it('replays thread history when previousResponseId is absent', async () => {
    await agent.generate('first user message', { memory: memoryOptions });
    await agent.generate('second user message', { memory: memoryOptions });

    // system + user(first) + assistant(first reply) + user(second)
    expect(conversationOf(1)).toHaveLength(3);
    expect(textOf(1)).toContain('first user message');
    expect(textOf(1)).toContain('first reply');
    expect(textOf(1)).toContain('second user message');
  });

  it('does not replay thread history when providerOptions.openai.previousResponseId is set', async () => {
    await agent.generate('first user message', { memory: memoryOptions });
    await agent.generate('second user message', {
      memory: memoryOptions,
      providerOptions: { openai: { previousResponseId: 'resp_turn1', store: true } },
    });

    // Only the new turn — the provider already holds everything before it.
    expect(conversationOf(1)).toHaveLength(1);
    expect(textOf(1)).toContain('second user message');
    expect(textOf(1)).not.toContain('first user message');
    expect(textOf(1)).not.toContain('first reply');
  });

  it('does not replay thread history when providerOptions.azure.previousResponseId is set', async () => {
    // Azure declares no previousResponseId of its own; the gateway mirrors azure.* into
    // openai.* only at call time, which is after memory recall has already run.
    await agent.generate('first user message', { memory: memoryOptions });
    await agent.generate('second user message', {
      memory: memoryOptions,
      providerOptions: { azure: { previousResponseId: 'resp_turn1', store: true } },
    });

    expect(conversationOf(1)).toHaveLength(1);
    expect(textOf(1)).not.toContain('first user message');
  });

  it('ignores a null previousResponseId', async () => {
    await agent.generate('first user message', { memory: memoryOptions });
    await agent.generate('second user message', {
      memory: memoryOptions,
      providerOptions: { openai: { previousResponseId: null, store: true } },
    });

    expect(conversationOf(1)).toHaveLength(3);
    expect(textOf(1)).toContain('first user message');
  });

  it('still persists the turn when previousResponseId is set', async () => {
    await agent.generate('first user message', { memory: memoryOptions });
    await agent.generate('second user message', {
      memory: memoryOptions,
      providerOptions: { openai: { previousResponseId: 'resp_turn1', store: true } },
    });

    // Gating the read side must not stop the write side: both turns stay in storage so
    // later turns without a provider-side chain still recall correctly.
    const stored = await storedMessages();
    const storedText = JSON.stringify(stored);
    expect(storedText).toContain('first user message');
    expect(storedText).toContain('first reply');
    expect(storedText).toContain('second user message');
    expect(stored).toHaveLength(4);
  });

  it('applies the gate to stream() as well', async () => {
    await agent.generate('first user message', { memory: memoryOptions });
    await drain(
      await agent.stream('second user message', {
        memory: memoryOptions,
        providerOptions: { openai: { previousResponseId: 'resp_turn1', store: true } },
      }),
    );

    expect(conversationOf(1)).toHaveLength(1);
    expect(textOf(1)).not.toContain('first user message');
  });
});
