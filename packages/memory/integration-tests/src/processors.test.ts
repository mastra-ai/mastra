import { afterEach } from 'node:test';
import type { MessageType } from '@mastra/core';
import { LibSQLStore } from '@mastra/core/storage/libsql';
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Creates a simulated conversation history with alternating messages and occasional tool calls
 * @param threadId Thread ID for the messages
 * @param messageCount Number of turn pairs (user + assistant) to generate
 * @param toolFrequency How often to include tool calls (e.g., 3 means every 3rd assistant message)
 * @returns Array of messages representing the conversation
 */
function generateConversationHistory({
  threadId,
  messageCount = 5,
  toolFrequency = 3,
  toolNames = ['weather', 'calculator', 'search'],
}: {
  threadId: string;
  messageCount?: number;
  toolFrequency?: number;
  toolNames?: string[];
}): MessageType[] {
  // Create some words that will each be about one token
  const words = ['apple', 'banana', 'orange', 'grape'];
  // Arguments for different tools
  const toolArgs = {
    weather: { location: 'New York' },
    calculator: { expression: '2+2' },
    search: { query: 'latest AI developments' },
  };

  const messages: MessageType[] = [];
  const startTime = Date.now();

  // Generate message pairs (user message followed by assistant response)
  for (let i = 0; i < messageCount; i++) {
    // Create user message content
    const userContent = Array(25).fill(words).flat().join(' '); // ~100 tokens

    // Add user message
    messages.push({
      role: 'user',
      content: userContent,
      id: `message-${i * 2}`,
      threadId,
      createdAt: new Date(startTime + i * 2000), // Each pair 2 seconds apart
      type: 'text',
    });

    // Determine if this assistant message should include a tool call
    const includeTool = i > 0 && i % toolFrequency === 0;
    const toolIndex = includeTool ? (i / toolFrequency) % toolNames.length : -1;
    const toolName = includeTool ? toolNames[toolIndex] : '';

    // Create assistant message
    if (includeTool) {
      // Assistant message with tool call
      messages.push({
        role: 'assistant',
        content: [
          { type: 'text', text: `Using ${toolName} tool:` },
          {
            type: 'tool-call',
            toolCallId: `tool-${i}`,
            toolName,
            args: toolArgs[toolName as keyof typeof toolArgs] || {},
          },
        ],
        id: `message-${i * 2 + 1}`,
        threadId,
        createdAt: new Date(startTime + i * 2000 + 1000), // 1 second after user message
        type: 'tool-call',
      });
    } else {
      // Regular assistant text message
      messages.push({
        role: 'assistant',
        content: Array(15).fill(words).flat().join(' '), // ~60 tokens
        id: `message-${i * 2 + 1}`,
        threadId,
        createdAt: new Date(startTime + i * 2000 + 1000), // 1 second after user message
        type: 'text',
      });
    }
  }

  return messages;
}

describe('Memory with Processors', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  const resourceId = 'processor-test';

  beforeAll(() => {
    // Create a single in-memory database for all tests
    storage = new LibSQLStore({
      config: {
        url: 'file::memory:?cache=shared',
      },
    });

    // Initialize memory with the in-memory database
    memory = new Memory({
      storage,
      options: {
        semanticRecall: false,
        threads: {
          generateTitle: false,
        },
      },
    });
  });

  afterEach(async () => {
    for (const thread of await storage.getThreadsByResourceId({
      resourceId,
    })) {
      await storage.deleteThread({ threadId: thread.id });
    }
  });

  it('should apply TokenLimiter when retrieving messages', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'TokenLimiter Test Thread',
      resourceId,
    });

    // Generate conversation with 10 turn pairs (20 messages total)
    const messages = generateConversationHistory({
      threadId: thread.id,
      messageCount: 10,
      toolFrequency: 3,
    });

    // Save messages
    await memory.saveMessages({ messages });

    // Get messages with a token limit of 250 (should get ~2.5 messages)
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new TokenLimiter(250)], // Limit to 250 tokens
      },
    });

    // We should have messages limited by token count
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(4); // Should get a few messages

    // And they should be the most recent ones
    const msgIds = result.messages.map(m => (m as any).id);
    // Verify we have the most recent message(s)
    expect(msgIds.length).toBeGreaterThan(0);
    // Check if the most recent message is included
    expect(msgIds).toContain('message-19');

    // Now query with a very high token limit that should return all messages
    const allMessagesResult = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new TokenLimiter(3000)], // High limit that should exceed total tokens
      },
    });

    // We should get all 20 messages
    expect(allMessagesResult.messages.length).toBe(20);
  });

  it('should apply ToolCallFilter when retrieving messages', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'ToolFilter Test Thread',
      resourceId,
    });

    // Generate conversation with tool calls
    const messages = generateConversationHistory({
      threadId: thread.id,
      messageCount: 5,
      toolFrequency: 2, // Every other assistant response is a tool call
      toolNames: ['weather', 'calculator'], // Limit to these two tools for simplicity
    });

    // Save messages
    await memory.saveMessages({ messages });

    // Get messages with a weather tool filter
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 10 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['weather'] })],
      },
    });

    // We should have fewer messages after filtering
    expect(result.messages.length).toBeLessThan(messages.length);

    // And they should exclude weather tool messages
    const weatherMsgIds = result.messages
      .filter(
        m =>
          Array.isArray(m.content) &&
          m.content.some(part => part.type === 'tool-call' && (part as any).toolName === 'weather'),
      )
      .map(m => (m as any).id);

    expect(weatherMsgIds.length).toBe(0);
  });

  it('should apply multiple processors in order', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'Multiple Processors Test Thread',
      resourceId,
    });

    // Generate conversation with tool calls
    const messages = generateConversationHistory({
      threadId: thread.id,
      messageCount: 8,
      toolFrequency: 2, // Every other assistant response is a tool call
      toolNames: ['weather', 'calculator', 'search'],
    });

    // Save messages
    await memory.saveMessages({ messages });

    // Apply multiple processors: first remove weather tool calls, then limit to 250 tokens
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['weather'] }), new TokenLimiter(250)],
      },
    });

    // We should have fewer messages after filtering and token limiting
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);

    // And they should exclude weather messages
    const weatherMsgIds = result.messages
      .filter(
        m =>
          Array.isArray(m.content) &&
          m.content.some(part => part.type === 'tool-call' && (part as any).toolName === 'weather'),
      )
      .map(m => (m as any).id);

    expect(weatherMsgIds.length).toBe(0);
  });
});
