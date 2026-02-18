/**
 * Tests for issue #13038: chatRoute should pass abort signal to enable request cancellation.
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { UIMessage } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { chatRoute, handleChatStream } from '../chat-route';

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

describe('abort signal propagation (issue #13038)', () => {
  describe('handleChatStream', () => {
    it('should pass abortSignal through to agent.stream() via params', async () => {
      const agent = createTestAgent();
      const mastra = createTestMastra(agent);
      const streamSpy = vi.spyOn(agent, 'stream');
      const abortController = new AbortController();

      const messages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

      const stream = await handleChatStream({
        mastra,
        agentId: 'test-agent',
        params: {
          messages,
          abortSignal: abortController.signal,
        },
      });

      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const options = streamSpy.mock.calls[0]![1];
      expect(options).toBeDefined();
      expect(options!.abortSignal).toBe(abortController.signal);

      streamSpy.mockRestore();
    });
  });

  describe('chatRoute', () => {
    it('should pass request abort signal to handleChatStream params', async () => {
      const agent = createTestAgent();
      const mastra = createTestMastra(agent);
      const streamSpy = vi.spyOn(agent, 'stream');

      const route = chatRoute({
        path: '/chat/:agentId',
      });

      const abortController = new AbortController();
      const mockBody = JSON.stringify({
        messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      });

      const mockRequest = new Request('http://localhost/chat/test-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: mockBody,
        signal: abortController.signal,
      });

      const contextStore = new Map<string, any>();
      contextStore.set('mastra', mastra);

      const mockContext = {
        req: {
          raw: mockRequest,
          json: () => Promise.resolve(JSON.parse(mockBody)),
          param: (name: string) => {
            if (name === 'agentId') return 'test-agent';
            return undefined;
          },
        },
        get: (key: string) => contextStore.get(key),
      };

      const response = await (route as any).handler(mockContext);

      if (response?.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } catch {
          // Stream may error on abort
        }
      }

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const options = streamSpy.mock.calls[0]![1];
      expect(options).toBeDefined();
      // new Request() creates its own linked AbortSignal, so compare against the request's signal
      expect(options!.abortSignal).toBe(mockRequest.signal);

      streamSpy.mockRestore();
    });
  });
});
