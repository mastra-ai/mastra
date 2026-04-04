/**
 * Tests for issue #12572: handleChatStream should properly merge providerOptions.
 */
import type { UIMessage } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import { handleChatStream } from '../chat-route';

function createMockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello world' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ] as any),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });
}

function createTestAgent() {
  return new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a helpful assistant.',
    model: createMockModel(),
  });
}

function createTestMastra(agent: Agent) {
  return new Mastra({
    agents: { [agent.id]: agent },
  });
}

async function drainStream(stream: ReadableStream) {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

const messages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

describe('providerOptions forwarding (issue #12572)', () => {
  it('should forward params.providerOptions to agent.stream()', async () => {
    const agent = createTestAgent();
    const mastra = createTestMastra(agent);
    const streamSpy = vi.spyOn(agent, 'stream');

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: {
        messages,
        providerOptions: { openai: { reasoningEffort: 'high' } },
      },
    });
    await drainStream(stream);

    expect(streamSpy).toHaveBeenCalledTimes(1);
    const options = streamSpy.mock.calls[0]![1];
    expect(options?.providerOptions).toEqual({ openai: { reasoningEffort: 'high' } });

    streamSpy.mockRestore();
  });

  it('should merge params.providerOptions with defaultOptions.providerOptions', async () => {
    const agent = createTestAgent();
    const mastra = createTestMastra(agent);
    const streamSpy = vi.spyOn(agent, 'stream');

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      defaultOptions: {
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      params: {
        messages,
        providerOptions: { openai: { reasoningEffort: 'high' } },
      },
    });
    await drainStream(stream);

    expect(streamSpy).toHaveBeenCalledTimes(1);
    const options = streamSpy.mock.calls[0]![1];
    expect(options?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
      openai: { reasoningEffort: 'high' },
    });

    streamSpy.mockRestore();
  });

  it('should let params.providerOptions override defaultOptions.providerOptions for the same provider', async () => {
    const agent = createTestAgent();
    const mastra = createTestMastra(agent);
    const streamSpy = vi.spyOn(agent, 'stream');

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      defaultOptions: {
        providerOptions: { openai: { reasoningEffort: 'low' } },
      },
      params: {
        messages,
        providerOptions: { openai: { reasoningEffort: 'high' } },
      },
    });
    await drainStream(stream);

    expect(streamSpy).toHaveBeenCalledTimes(1);
    const options = streamSpy.mock.calls[0]![1];
    expect(options?.providerOptions).toEqual({ openai: { reasoningEffort: 'high' } });

    streamSpy.mockRestore();
  });

  it('should replace the entire provider block when params overrides the same provider', async () => {
    const agent = createTestAgent();
    const mastra = createTestMastra(agent);
    const streamSpy = vi.spyOn(agent, 'stream');

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      defaultOptions: {
        providerOptions: { openai: { reasoningEffort: 'low', someOtherSetting: true } },
      },
      params: {
        messages,
        providerOptions: { openai: { reasoningEffort: 'high' } },
      },
    });
    await drainStream(stream);

    expect(streamSpy).toHaveBeenCalledTimes(1);
    const options = streamSpy.mock.calls[0]![1];
    // params.providerOptions.openai replaces defaultOptions.providerOptions.openai entirely
    expect(options?.providerOptions).toEqual({ openai: { reasoningEffort: 'high' } });

    streamSpy.mockRestore();
  });

  it('should not include providerOptions when none are provided', async () => {
    const agent = createTestAgent();
    const mastra = createTestMastra(agent);
    const streamSpy = vi.spyOn(agent, 'stream');

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: { messages },
    });
    await drainStream(stream);

    expect(streamSpy).toHaveBeenCalledTimes(1);
    const options = streamSpy.mock.calls[0]![1];
    expect(options?.providerOptions).toBeUndefined();

    streamSpy.mockRestore();
  });
});
