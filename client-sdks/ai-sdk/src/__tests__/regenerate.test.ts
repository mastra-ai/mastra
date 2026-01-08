/**
 * Integration tests for the regenerate functionality in handleChatStream.
 *
 * Tests the actual code path with a real Agent and Mastra instance,
 * using MockLanguageModelV2 to avoid external API calls.
 *
 * Issue #11557: chatRoute() with AI SDK useChat regenerate() only returned
 * step-start chunks without text content.
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { UIMessage } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import { handleChatStream } from '../chat-route';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock model that simulates real LLM behavior:
 * - If conversation ends with user message → generates text response
 * - If conversation ends with assistant message → NO text (the bug!)
 *
 * This accurately reproduces issue #11557.
 */
function createMockModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      // Check if last message is assistant - if so, don't generate text
      const lastMessage = prompt[prompt.length - 1];
      const shouldGenerateText = lastMessage?.role !== 'assistant';

      return {
        content: shouldGenerateText ? [{ type: 'text', text: responseText }] : [],
        finishReason: 'stop',
        usage: {
          inputTokens: 10,
          outputTokens: shouldGenerateText ? 20 : 0,
          totalTokens: shouldGenerateText ? 30 : 10,
        },
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      // Check if last message is assistant - if so, don't generate text
      const lastMessage = prompt[prompt.length - 1];
      const shouldGenerateText = lastMessage?.role !== 'assistant';

      const streamParts = shouldGenerateText
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: responseText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]
        : [
            // Bug reproduction: only step-start, no text content
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'msg-1', modelId: 'mock-model', timestamp: new Date() },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
            },
          ];

      return {
        stream: convertArrayToReadableStream(streamParts as any),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function createTestAgent(responseText: string) {
  return new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a helpful assistant.',
    model: createMockModel(responseText),
  });
}

function createTestMastra(agent: Agent) {
  return new Mastra({
    agents: { [agent.id]: agent },
  });
}

async function collectStreamChunks(stream: ReadableStream): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('handleChatStream regenerate integration', () => {
  const expectedText = 'This is the regenerated response';

  describe('trigger: regenerate-message', () => {
    it('should return text content when regenerating (issue #11557)', async () => {
      const agent = createTestAgent(expectedText);
      const mastra = createTestMastra(agent);

      // This is what useChat.regenerate() sends:
      // - Full conversation including the assistant message to regenerate
      // - trigger: 'regenerate-message'
      const messages: UIMessage[] = [
        { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Tell me a joke' }] },
        { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Old response to replace' }] },
      ];

      const stream = await handleChatStream({
        mastra,
        agentId: 'test-agent',
        params: { messages, trigger: 'regenerate-message' },
      });

      const chunks = await collectStreamChunks(stream);

      // The actual bug was: only step-start chunks, no text content
      // Verify we get text-delta chunks with actual content
      const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');
      expect(textDeltaChunks.length).toBeGreaterThan(0);
      expect(textDeltaChunks[0].delta).toBe(expectedText);

      // Verify full stream structure
      const chunkTypes = chunks.map(c => c.type);
      expect(chunkTypes).toContain('start');
      expect(chunkTypes).toContain('text-delta');
      expect(chunkTypes).toContain('finish');
    });

    it('should include start chunk with message metadata', async () => {
      const agent = createTestAgent(expectedText);
      const mastra = createTestMastra(agent);

      const messages: UIMessage[] = [
        { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Question' }] },
        { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Old answer' }] },
      ];

      const stream = await handleChatStream({
        mastra,
        agentId: 'test-agent',
        params: { messages, trigger: 'regenerate-message' },
      });

      const chunks = await collectStreamChunks(stream);
      const startChunk = chunks.find(c => c.type === 'start');

      // The start chunk should exist and have a messageId
      expect(startChunk).toBeDefined();
      expect(startChunk.messageId).toBeDefined();
    });

    it('should work with multi-turn conversations', async () => {
      const agent = createTestAgent('Better explanation');
      const mastra = createTestMastra(agent);

      const messages: UIMessage[] = [
        { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'What is 2+2?' }] },
        { id: 'msg-2', role: 'assistant', parts: [{ type: 'text', text: '4' }] },
        { id: 'msg-3', role: 'user', parts: [{ type: 'text', text: 'Explain why' }] },
        { id: 'msg-4', role: 'assistant', parts: [{ type: 'text', text: 'Bad explanation to replace...' }] },
      ];

      const stream = await handleChatStream({
        mastra,
        agentId: 'test-agent',
        params: { messages, trigger: 'regenerate-message' },
      });

      const chunks = await collectStreamChunks(stream);

      // Should have text content - this is the key fix for issue #11557
      const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');
      expect(textDeltaChunks.length).toBeGreaterThan(0);
      expect(textDeltaChunks[0].delta).toBe('Better explanation');

      // Should have proper stream structure
      const chunkTypes = chunks.map(c => c.type);
      expect(chunkTypes).toContain('start');
      expect(chunkTypes).toContain('finish');
    });
  });

  describe('trigger: submit-message (normal flow)', () => {
    it('should return text content for normal messages', async () => {
      const agent = createTestAgent('Hello! How can I help?');
      const mastra = createTestMastra(agent);

      const messages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hi there' }] }];

      const stream = await handleChatStream({
        mastra,
        agentId: 'test-agent',
        params: { messages, trigger: 'submit-message' },
      });

      const chunks = await collectStreamChunks(stream);

      const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');
      expect(textDeltaChunks.length).toBeGreaterThan(0);
      expect(textDeltaChunks[0].delta).toBe('Hello! How can I help?');
    });

    it('should have complete stream structure for new messages', async () => {
      const agent = createTestAgent('Response');
      const mastra = createTestMastra(agent);

      const messages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

      const stream = await handleChatStream({
        mastra,
        agentId: 'test-agent',
        params: { messages, trigger: 'submit-message' },
      });

      const chunks = await collectStreamChunks(stream);

      // Should have complete stream structure
      const chunkTypes = chunks.map(c => c.type);
      expect(chunkTypes).toContain('start');
      expect(chunkTypes).toContain('text-delta');
      expect(chunkTypes).toContain('finish');

      // Start chunk exists with a generated message ID
      const startChunk = chunks.find(c => c.type === 'start');
      expect(startChunk).toBeDefined();
    });
  });
});
