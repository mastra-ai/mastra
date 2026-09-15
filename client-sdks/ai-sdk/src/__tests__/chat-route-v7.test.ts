import type { UIMessage as UIMessageV5 } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it } from 'vitest';

import { handleChatStream, toAISdkStream } from '../index';

const messages: UIMessageV5[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

function createMastra() {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello world' },
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

/** Chunk ids/timestamps differ per run, so compare structure only. */
function normalize(chunks: any[]) {
  return chunks.map(chunk => {
    const { id, messageId, ...rest } = chunk;
    return rest;
  });
}

describe('AI SDK v7 support', () => {
  it('streams UI chunks from handleChatStream when version is v7', async () => {
    const chunks = await collect(
      await handleChatStream({
        mastra: createMastra(),
        agentId: 'test-agent',
        params: { messages } as any,
        version: 'v7',
      }),
    );

    expect(chunks.map(chunk => chunk.type)).toEqual(
      expect.arrayContaining(['start', 'text-start', 'text-delta', 'text-end', 'finish']),
    );
    expect(
      chunks
        .filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.delta)
        .join(''),
    ).toBe('Hello world');
  });

  it('emits the same chunks for v6 and v7', async () => {
    const v6Chunks = normalize(
      await collect(
        await handleChatStream({
          mastra: createMastra(),
          agentId: 'test-agent',
          params: { messages } as any,
          version: 'v6',
        }),
      ),
    );
    const v7Chunks = normalize(
      await collect(
        await handleChatStream({
          mastra: createMastra(),
          agentId: 'test-agent',
          params: { messages } as any,
          version: 'v7',
        }),
      ),
    );

    expect(v7Chunks).toEqual(v6Chunks);
  });

  it('accepts version v7 in toAISdkStream', async () => {
    const agent = createMastra().getAgentById('test-agent');
    const result = await agent.stream(messages as any);

    const chunks: any[] = [];
    for await (const part of toAISdkStream(result, { from: 'agent', version: 'v7' })) {
      chunks.push(part);
    }

    expect(chunks.map(chunk => chunk.type)).toEqual(expect.arrayContaining(['start', 'text-delta', 'finish']));
  });
});
