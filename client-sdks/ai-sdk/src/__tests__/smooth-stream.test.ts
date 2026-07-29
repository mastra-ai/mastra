import type { UIMessage } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it } from 'vitest';

import { handleChatStream, smoothStream } from '../index';

const messages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

function createMastra() {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hel' },
        { type: 'text-delta', id: 'text-1', delta: 'lo world ' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        },
      ] as any),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });

  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'Help the user.',
    model,
  });

  return new Mastra({ agents: { [agent.id]: agent } });
}

async function collect(stream: ReadableStream) {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

function textDeltas(chunks: any[]) {
  return chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.delta ?? chunk.text);
}

describe('smoothStream AI SDK integration', () => {
  it('can be applied directly through Agent.stream options', async () => {
    const agent = createMastra().getAgentById('test-agent');
    const result = await agent.stream(messages, {
      experimentalTransform: smoothStream({ chunking: 'word', delayInMs: null }),
    });
    const chunks = await collect(result.fullStream);

    expect(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text)).toEqual([
      'Hello ',
      'world ',
    ]);
  });

  it.each(['v5', 'v6'] as const)('smooths handleChatStream output for AI SDK %s', async version => {
    const chunks = await collect(
      await handleChatStream({
        mastra: createMastra(),
        agentId: 'test-agent',
        params: { messages } as any,
        version,
        experimentalTransform: smoothStream({ chunking: 'word', delayInMs: null }),
      } as any),
    );

    expect(textDeltas(chunks)).toEqual(['Hello ', 'world ']);
    expect(textDeltas(chunks).join('')).toBe('Hello world ');
    expect(chunks.map(chunk => chunk.type)).toEqual(
      expect.arrayContaining(['start', 'text-start', 'text-end', 'finish']),
    );
  });

  it('accepts a reusable transform factory in defaultOptions', async () => {
    const transform = smoothStream({ chunking: 'word', delayInMs: null });
    const mastra = createMastra();

    for (let request = 0; request < 2; request++) {
      const chunks = await collect(
        await handleChatStream({
          mastra,
          agentId: 'test-agent',
          params: { messages },
          defaultOptions: { experimentalTransform: transform },
        }),
      );

      expect(textDeltas(chunks)).toEqual(['Hello ', 'world ']);
    }
  });
});
