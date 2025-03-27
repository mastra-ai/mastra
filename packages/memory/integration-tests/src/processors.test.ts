import { afterEach } from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { LibSQLStore } from '@mastra/core/storage/libsql';
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { describe, it, expect, beforeEach } from 'vitest';
import { filterToolCallsByName, filterToolResultsByName, generateConversationHistory } from './test-utils';

describe('Memory with Processors', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  const resourceId = 'processor-test';
  let testCount = 0;

  beforeEach(() => {
    // Create a new unique database file in the temp directory for each test
    const timestamp = Date.now();
    const uniqueId = `memory-processor-test-${timestamp}-${testCount++}`;
    const dbPath = join(tmpdir(), uniqueId);

    storage = new LibSQLStore({
      config: {
        url: `file:${dbPath}`,
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
    expect(result.messages.length).toBeLessThanOrEqual(4); // Should get a small subset of messages

    // And they should be the most recent ones
    const msgIds = result.messages.map(m => (m as any).id);
    // Verify we have the most recent message(s)
    expect(msgIds.length).toBeGreaterThan(0);

    // Get the highest message ID number from the results
    const highestMsgIdNumber = Math.max(
      ...msgIds.filter(id => id.startsWith('message-')).map(id => parseInt(id.replace('message-', ''), 10)),
    );

    // The highest message ID should be one of the last ones from the original set
    expect(highestMsgIdNumber).toBeGreaterThan(15);

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
      toolNames: ['weather', 'calculator'],
    });

    // Save messages
    await memory.saveMessages({ messages });

    // filter weather tool calls
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['weather'] })],
      },
    });
    expect(result.messages.length).toBeLessThan(messages.length);
    expect(filterToolCallsByName(result.messages, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result.messages, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result.messages, 'calculator')).toHaveLength(1);
    expect(filterToolResultsByName(result.messages, 'calculator')).toHaveLength(1);

    // make another query with no processors to make sure memory messages in DB were not altered and were only filtered from results
    const result2 = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [],
      },
    });
    expect(result2.messages).toHaveLength(messages.length);
    expect(filterToolCallsByName(result2.messages, 'weather')).toHaveLength(1);
    expect(filterToolResultsByName(result2.messages, 'weather')).toHaveLength(1);
    expect(filterToolCallsByName(result2.messages, 'calculator')).toHaveLength(1);
    expect(filterToolResultsByName(result2.messages, 'calculator')).toHaveLength(1);

    // filter all by name
    const result3 = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['weather', 'calculator'] })],
      },
    });
    expect(result3.messages.length).toBeLessThan(messages.length);
    expect(filterToolCallsByName(result3.messages, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result3.messages, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result3.messages, 'calculator')).toHaveLength(0);
    expect(filterToolResultsByName(result3.messages, 'calculator')).toHaveLength(0);

    // filter all by default
    const result4 = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new ToolCallFilter()],
      },
    });
    expect(result4.messages.length).toBeLessThan(messages.length);
    expect(filterToolCallsByName(result4.messages, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result4.messages, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result4.messages, 'calculator')).toHaveLength(0);
    expect(filterToolResultsByName(result4.messages, 'calculator')).toHaveLength(0);
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
    // And they should exclude weather tool messages
    expect(filterToolResultsByName(result.messages, `weather`)).toHaveLength(0);
    expect(filterToolCallsByName(result.messages, `weather`)).toHaveLength(0);
  });
});
