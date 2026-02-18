/**
 * Integration tests for chat-route behavior with memory.
 *
 * Issue #11913: When using AI SDK's useChat hook with memory enabled,
 * messages are duplicated because:
 * 1. useChat sends the full message history on each request
 * 2. Memory also fetches stored messages
 * 3. Both get saved, causing duplicates
 *
 * The fix: When memory is configured (threadId/resourceId), only send
 * the latest message to the agent - let memory provide the history.
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import type { UIMessage } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai/test';
import { describe, expect, it, beforeEach } from 'vitest';

import { handleChatStream } from '../chat-route';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => {
      return {
        stream: convertArrayToReadableStream([
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
        ] as any),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
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
// Tests for Message Duplication Issue (#11913)
// ============================================================================

describe('handleChatStream with memory - message duplication', () => {
  let memory: MockMemory;
  const threadId = 'test-thread-dedup';
  const resourceId = 'test-resource';

  beforeEach(async () => {
    memory = new MockMemory();
    // Pre-create the thread
    await memory.createThread({ threadId, resourceId, title: 'Dedup Test' });
  });

  it('should not duplicate messages when useChat sends full history with memory enabled', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful.',
      model: createMockModel('Response 1'),
      memory,
    });

    const mastra = new Mastra({
      agents: { 'test-agent': agent },
    });

    // Simulate first message exchange
    // useChat sends the first user message
    const firstMessages: UIMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }];

    const stream1 = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: {
        messages: firstMessages,
        memory: { thread: threadId, resource: resourceId },
      },
    });
    await collectStreamChunks(stream1);

    // Wait for async save operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check messages in memory after first exchange
    const recall1 = await memory.recall({ threadId, resourceId });
    const userMessages1 = recall1.messages.filter(m => m.role === 'user');
    const assistantMessages1 = recall1.messages.filter(m => m.role === 'assistant');

    // Should have 1 user message and 1 assistant message
    expect(userMessages1.length).toBe(1);
    expect(assistantMessages1.length).toBe(1);

    // Now simulate second message - THIS IS WHERE THE BUG OCCURS
    // useChat sends FULL history including previous messages
    const secondMessages: UIMessage[] = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Response 1' }] },
      { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'How are you?' }] },
    ];

    const stream2 = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: {
        messages: secondMessages,
        memory: { thread: threadId, resource: resourceId },
      },
    });
    await collectStreamChunks(stream2);

    // Wait for async save operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check messages in memory after second exchange
    const recall2 = await memory.recall({ threadId, resourceId });
    const userMessages2 = recall2.messages.filter(m => m.role === 'user');
    const assistantMessages2 = recall2.messages.filter(m => m.role === 'assistant');

    // BUG: Without the fix, this would be 3 user messages (1 + 2 duplicates)
    // and potentially duplicate assistant messages too
    // With the fix, should have exactly 2 user messages and 2 assistant messages
    expect(userMessages2.length).toBe(2);
    expect(assistantMessages2.length).toBe(2);

    // Verify no duplicate content
    const userContents = userMessages2.map(m => {
      const textPart = m.content?.parts?.find((p: any) => p.type === 'text');
      return textPart?.text;
    });
    expect(userContents).toContain('Hello');
    expect(userContents).toContain('How are you?');
    // Should not have duplicates
    expect(userContents.filter(c => c === 'Hello').length).toBe(1);
    expect(userContents.filter(c => c === 'How are you?').length).toBe(1);
  });

  it('should send all messages when memory is not configured', async () => {
    // Agent WITHOUT memory
    const agent = new Agent({
      id: 'no-memory-agent',
      name: 'No Memory Agent',
      instructions: 'You are helpful.',
      model: createMockModel('Response'),
    });

    const mastra = new Mastra({
      agents: { 'no-memory-agent': agent },
    });

    // Without memory config, ALL messages should be passed to the agent
    const messages: UIMessage[] = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'First message' }] },
      { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'First response' }] },
      { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'Second message' }] },
    ];

    const stream = await handleChatStream({
      mastra,
      agentId: 'no-memory-agent',
      params: {
        messages,
        // No memory config - stateless mode
      },
    });

    const chunks = await collectStreamChunks(stream);

    // Should complete successfully with text response
    const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');
    expect(textDeltaChunks.length).toBeGreaterThan(0);
  });

  it('should only pass latest message to agent.stream when memory is configured', async () => {
    // Track what messages are passed to agent.stream()
    let streamCalledWith: any[] = [];

    const agent = new Agent({
      id: 'tracking-agent',
      name: 'Tracking Agent',
      instructions: 'You are helpful.',
      model: createMockModel('Response'),
      memory,
    });

    // Spy on agent.stream to capture what messages are passed
    const originalStream = agent.stream.bind(agent);
    agent.stream = async (messages: any, options: any) => {
      streamCalledWith = Array.isArray(messages) ? messages : [messages];
      return originalStream(messages, options);
    };

    const mastra = new Mastra({
      agents: { 'tracking-agent': agent },
    });

    // useChat sends full history including old messages + new one
    const messages: UIMessage[] = [
      { id: 'old-1', role: 'user', parts: [{ type: 'text', text: 'First message' }] },
      { id: 'old-2', role: 'assistant', parts: [{ type: 'text', text: 'First response' }] },
      { id: 'old-3', role: 'user', parts: [{ type: 'text', text: 'Second message' }] },
      { id: 'old-4', role: 'assistant', parts: [{ type: 'text', text: 'Second response' }] },
      { id: 'new-1', role: 'user', parts: [{ type: 'text', text: 'New message' }] },
    ];

    const stream = await handleChatStream({
      mastra,
      agentId: 'tracking-agent',
      params: {
        messages,
        memory: { thread: threadId, resource: resourceId },
      },
    });
    await collectStreamChunks(stream);

    // With the fix, only the latest user message should be passed to agent.stream()
    // Memory recall will provide the history - we don't need to send duplicates
    expect(streamCalledWith.length).toBe(1);
    expect(streamCalledWith[0].parts[0].text).toBe('New message');
  });
});
