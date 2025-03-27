import { afterEach } from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/core/storage/libsql';
import { createTool } from '@mastra/core/tools';
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
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

  it('should apply processors with a real Mastra agent', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'Real Agent Processor Test Thread',
      resourceId,
    });

    const threadId = thread.id;

    // Create test tools
    const weatherTool = createTool({
      id: 'get_weather',
      description: 'Get the weather for a given location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ context: { location } }) => {
        return `The weather in ${location} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
      },
    });

    const calculatorTool = createTool({
      id: 'calculator',
      description: 'Perform a simple calculation',
      inputSchema: z.object({
        expression: z.string().describe('The mathematical expression to calculate'),
      }),
      execute: async ({ context: { expression } }) => {
        return `The result of ${expression} is ${eval(expression)}`;
      },
    });

    const instructions =
      'You are a helpful assistant with access to weather and calculator tools. Use them when appropriate.';
    // Create agent with memory and tools
    const agent = new Agent({
      name: 'processor-test-agent',
      instructions,
      model: openai('gpt-4o'),
      memory,
      tools: {
        get_weather: weatherTool,
        calculator: calculatorTool,
      },
    });

    // First message - use weather tool
    await agent.generate('What is the weather in Seattle?', {
      threadId,
      resourceId,
    });
    // Second message - use calculator tool
    await agent.generate('Calculate 123 * 456', {
      threadId,
      resourceId,
    });
    // Third message - simple text response
    await agent.generate('Tell me something interesting about space', {
      threadId,
      resourceId,
    });
    // Query with no processors to verify baseline message count
    const baselineResult = await memory.query({
      threadId,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [],
      },
    });

    // There should be at least 6 messages (3 user + 3 assistant responses)
    expect(baselineResult.messages.length).toBeGreaterThanOrEqual(6);

    // Verify we have tool calls in the baseline
    const weatherToolCalls = filterToolCallsByName(baselineResult.messages, 'get_weather');
    const calculatorToolCalls = filterToolCallsByName(baselineResult.messages, 'calculator');
    expect(weatherToolCalls.length).toBeGreaterThan(0);
    expect(calculatorToolCalls.length).toBeGreaterThan(0);

    // Test filtering weather tool calls
    const weatherFilteredResult = await memory.query({
      threadId,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['get_weather'] })],
      },
    });

    // Should have fewer messages after filtering
    expect(weatherFilteredResult.messages.length).toBeLessThan(baselineResult.messages.length);

    // No weather tool calls should remain
    expect(filterToolCallsByName(weatherFilteredResult.messages, 'get_weather').length).toBe(0);
    expect(filterToolResultsByName(weatherFilteredResult.messages, 'get_weather').length).toBe(0);

    // Calculator tool calls should still be present
    expect(filterToolCallsByName(weatherFilteredResult.messages, 'calculator').length).toBeGreaterThan(0);

    // Test token limiting
    const tokenLimitedResult = await memory.query({
      threadId,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new TokenLimiter(100)], // Small limit to only get a subset
      },
    });

    // Should have fewer messages after token limiting
    expect(tokenLimitedResult.messages.length).toBeLessThan(baselineResult.messages.length);

    // Test combining processors
    const combinedResult = await memory.query({
      threadId,
      selectBy: { last: 20 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['get_weather', 'calculator'] }), new TokenLimiter(500)],
      },
    });

    // No tool calls should remain
    expect(filterToolCallsByName(combinedResult.messages, 'get_weather').length).toBe(0);
    expect(filterToolCallsByName(combinedResult.messages, 'calculator').length).toBe(0);
    expect(filterToolResultsByName(combinedResult.messages, 'get_weather').length).toBe(0);
    expect(filterToolResultsByName(combinedResult.messages, 'calculator').length).toBe(0);

    // The result should still contain some messages
    expect(combinedResult.messages.length).toBeGreaterThan(0);
  });
});
