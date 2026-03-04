/**
 * Integration tests for issue #12683 / #11552: addToolResult with client-side tools.
 *
 * Simulates the full two-request flow through handleChatStream:
 *
 * Request 1: User sends "What's in my clipboard?"
 *   → LLM responds with tool call for get_clipboard
 *   → Server streams response with start event containing messageId "A"
 *
 * Request 2: Client calls addToolResult, sends back messages with tool result
 *   → Last message is assistant (id="A", with tool result) — this is a continuation
 *   → Server streams continuation response
 *   → start event messageId MUST be "A" (not a new server-generated ID)
 *   → Otherwise the client creates a duplicate assistant message
 *
 * This test proves the bug: without the fix, the second start event has a
 * different messageId, causing useChat to create a new assistant message
 * instead of appending to the existing one.
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import type { UIMessage } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { handleChatStream } from '../chat-route';

// ============================================================================
// Helpers
// ============================================================================

let callCount = 0;

/**
 * Mock model that:
 * - First call: returns a tool call for get_clipboard
 * - Second call: returns text (continuation after tool result)
 */
function createClientToolModel() {
  callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date() },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-clipboard-1',
              toolName: 'get_clipboard',
              args: '{}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ] as any),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: 'Your clipboard contains: Meeting notes for Monday standup.',
            },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
            },
          ] as any),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      }
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
// Integration Test
// ============================================================================

describe('addToolResult full flow integration (issue #12683)', () => {
  it('continuation start event messageId should match the first response messageId', async () => {
    const clipboardTool = createTool({
      id: 'get_clipboard',
      description: 'Gets clipboard contents',
      inputSchema: z.object({}),
      // No execute — client-side tool
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are helpful. Use get_clipboard when asked about clipboard.',
      model: createClientToolModel(),
      tools: { get_clipboard: clipboardTool },
    });
    const mastra = new Mastra({ agents: { 'test-agent': agent } });

    // ================================================================
    // REQUEST 1: User sends "What's in my clipboard?"
    //
    // This is what useChat sends on the initial user message.
    // The server responds with a tool call. The start event includes
    // a messageId that the client uses to track the assistant message.
    // ================================================================
    const userMessage: UIMessage = {
      id: 'user-msg-1',
      role: 'user',
      parts: [{ type: 'text', text: "What's in my clipboard?" }],
    };

    const stream1 = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: { messages: [userMessage] },
    });

    const chunks1 = await collectStreamChunks(stream1);
    const startChunk1 = chunks1.find(c => c.type === 'start');

    expect(startChunk1).toBeDefined();
    expect(startChunk1.messageId).toBeDefined();

    const firstResponseMessageId = startChunk1.messageId;

    // ================================================================
    // REQUEST 2: Client executes tool, calls addToolResult, auto-sends
    //
    // This simulates what useChat + sendAutomaticallyWhen does after
    // the client calls addToolResult():
    // - The assistant message is updated with the tool result
    // - useChat sends all messages to the server
    // - The last message is the assistant message (with tool result)
    //
    // handleChatStream sees lastMessage.role === 'assistant' and sets
    // lastMessageId = lastMessage.id (the client's assistant ID from
    // the first response).
    // ================================================================
    const messagesForContinuation: UIMessage[] = [
      userMessage,
      {
        // The client uses the messageId from the first response
        id: firstResponseMessageId,
        role: 'assistant',
        parts: [
          {
            type: 'tool-get_clipboard',
            toolCallId: 'call-clipboard-1',
            toolName: 'get_clipboard',
            state: 'output-available',
            input: {},
            output: 'Meeting notes for Monday standup',
          } as any,
        ],
      },
    ];

    const stream2 = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: { messages: messagesForContinuation },
    });

    const chunks2 = await collectStreamChunks(stream2);
    const startChunk2 = chunks2.find(c => c.type === 'start');

    expect(startChunk2).toBeDefined();
    expect(startChunk2.messageId).toBeDefined();

    const secondResponseMessageId = startChunk2.messageId;

    // ================================================================
    // KEY ASSERTION:
    //
    // The continuation response MUST use the SAME messageId as the
    // first response. This is how useChat knows to append the
    // continuation text to the existing assistant message.
    //
    // Without the fix:
    //   secondResponseMessageId = "new-server-uuid" (different!)
    //   → useChat creates a DUPLICATE assistant message
    //
    // With the fix:
    //   secondResponseMessageId = firstResponseMessageId
    //   → useChat appends to the existing assistant message
    // ================================================================
    expect(secondResponseMessageId).toBe(firstResponseMessageId);

    // Verify the continuation has actual text content
    const textChunks = chunks2.filter(c => c.type === 'text-delta');
    expect(textChunks.length).toBeGreaterThan(0);
    expect(textChunks[0].delta).toContain('clipboard');
  });
});
