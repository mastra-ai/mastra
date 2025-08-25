import { mkdtemp } from 'fs/promises';
import { afterEach } from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { openai } from '@ai-sdk/openai';
import type { MastraMessageV2 } from '@mastra/core/agent';
import { Agent, MessageList } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { MemoryProcessorOpts } from '@mastra/core/memory';
import { MemoryProcessor } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { TokenLimiter, ToolCallFilter } from '@mastra/memory/processors';
import type { UIMessage } from 'ai';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { filterToolCallsByName, filterToolResultsByName, generateConversationHistory } from './test-utils';

function v2ToCoreMessages(messages: MastraMessageV2[] | UIMessage[]): CoreMessage[] {
  return new MessageList().add(messages, 'memory').get.all.core();
}

let memory: Memory;
let storage: LibSQLStore;
let vector: LibSQLVector;
const resourceId = 'processor-test';

beforeEach(async () => {
  // Create a new unique database file in the temp directory for each test
  const dbPath = join(await mkdtemp(join(tmpdir(), `memory-processor-test-`)), 'test.db');

  storage = new LibSQLStore({
    url: `file:${dbPath}`,
  });
  vector = new LibSQLVector({
    connectionUrl: `file:${dbPath}`,
  });

  // Initialize memory with the in-memory database
  memory = new Memory({
    storage,
    options: {
      lastMessages: 10,
      semanticRecall: false,
      threads: {
        generateTitle: false,
      },
    },
  });
});

afterEach(async () => {
  //@ts-ignore
  await storage.client.close();
  //@ts-ignore
  await vector.turso.close();
});

describe('Memory with Processors', () => {
  it('should apply TokenLimiter when retrieving messages', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'TokenLimiter Test Thread',
      resourceId,
    });

    // Generate conversation with 10 turn pairs (20 messages total)
    const { messagesV2 } = generateConversationHistory({
      threadId: thread.id,
      resourceId,
      messageCount: 10,
      toolFrequency: 3,
    });

    // Save messages
    await memory.saveMessages({ messages: messagesV2, format: 'v2' });

    // Get messages with a token limit of 250 (should get ~2.5 messages)
    const queryResult = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    const result = await memory.processMessages({
      messages: new MessageList({ threadId: thread.id, resourceId })
        .add(queryResult.uiMessages, 'memory')
        .get.all.core(),
      processors: [new TokenLimiter(250)], // Limit to 250 tokens
    });

    // We should have messages limited by token count
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(4); // Should get a small subset of messages

    expect(result.at(-1)).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'tool-9',
          toolName: 'weather',
          result: 'Pretty hot',
        },
      ],
    });

    // Now query with a very high token limit that should return all messages
    const allMessagesQuery = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    expect(allMessagesQuery.messages.length).toBe(20);

    const allMessagesResult = await memory.processMessages({
      messages: new MessageList({ threadId: thread.id, resourceId })
        .add(allMessagesQuery.uiMessages, 'memory')
        .get.all.core(),
      processors: [new TokenLimiter(3000)], // High limit that should exceed total tokens
    });

    // create response message list to add to memory
    const messages = new MessageList({ threadId: thread.id, resourceId })
      .add(allMessagesResult, 'response')
      .get.all.v2();

    const listed = new MessageList({ threadId: thread.id, resourceId }).add(messages, 'memory').get.all.v2();

    // We should get all 20 messages
    expect(listed.length).toBe(20);
    // core messages store tool call/result as separate messages, so +3
    expect(allMessagesResult.length).toBe(23);
  });

  it('should apply ToolCallFilter when retrieving messages', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'ToolFilter Test Thread',
      resourceId,
    });

    // Generate conversation with tool calls
    const { messagesV2 } = generateConversationHistory({
      threadId: thread.id,
      resourceId,
      messageCount: 5,
      toolFrequency: 2, // Every other assistant response is a tool call
      toolNames: ['weather', 'calculator'],
    });

    // Save messages
    await memory.saveMessages({ messages: messagesV2, format: 'v2' });

    // filter weather tool calls
    const queryResult = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    const result = await memory.processMessages({
      messages: v2ToCoreMessages(queryResult.uiMessages),
      processors: [new ToolCallFilter({ exclude: ['weather'] })],
    });
    const messages = new MessageList({ threadId: thread.id, resourceId }).add(result, 'response').get.all.v2();
    expect(new MessageList().add(messages, 'memory').get.all.v2().length).toBeLessThan(messagesV2.length);
    expect(filterToolCallsByName(result, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result, 'calculator')).toHaveLength(1);
    expect(filterToolResultsByName(result, 'calculator')).toHaveLength(1);

    // make another query with no processors to make sure memory messages in DB were not altered and were only filtered from results
    const queryResult2 = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    const result2 = await memory.processMessages({
      messages: v2ToCoreMessages(queryResult2.uiMessages),
      processors: [],
    });
    const messages2 = new MessageList({ threadId: thread.id, resourceId }).add(result2, 'response').get.all.v2();
    expect(new MessageList().add(messages2, 'memory').get.all.v2()).toHaveLength(messagesV2.length);
    expect(filterToolCallsByName(result2, 'weather')).toHaveLength(1);
    expect(filterToolResultsByName(result2, 'weather')).toHaveLength(1);
    expect(filterToolCallsByName(result2, 'calculator')).toHaveLength(1);
    expect(filterToolResultsByName(result2, 'calculator')).toHaveLength(1);

    // filter all by name
    const queryResult3 = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    const result3 = await memory.processMessages({
      messages: v2ToCoreMessages(queryResult3.uiMessages),
      processors: [new ToolCallFilter({ exclude: ['weather', 'calculator'] })],
    });
    expect(result3.length).toBeLessThan(messagesV2.length);
    expect(filterToolCallsByName(result3, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result3, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result3, 'calculator')).toHaveLength(0);
    expect(filterToolResultsByName(result3, 'calculator')).toHaveLength(0);

    // filter all by default
    const queryResult4 = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    const result4 = await memory.processMessages({
      messages: v2ToCoreMessages(queryResult4.uiMessages),
      processors: [new ToolCallFilter()],
    });
    expect(result4.length).toBeLessThan(messagesV2.length);
    expect(filterToolCallsByName(result4, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result4, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result4, 'calculator')).toHaveLength(0);
    expect(filterToolResultsByName(result4, 'calculator')).toHaveLength(0);
  });

  it('should apply multiple processors in order', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'Multiple Processors Test Thread',
      resourceId,
    });

    // Generate conversation with tool calls
    const { messages } = generateConversationHistory({
      threadId: thread.id,
      resourceId,
      messageCount: 8,
      toolFrequency: 2, // Every other assistant response is a tool call
      toolNames: ['weather', 'calculator', 'search'],
    });

    // Save messages
    await memory.saveMessages({ messages });

    // Apply multiple processors: first remove weather tool calls, then limit to 250 tokens
    const queryResult = await memory.query({
      threadId: thread.id,
      selectBy: { last: 20 },
    });
    const result = await memory.processMessages({
      messages: v2ToCoreMessages(queryResult.uiMessages),
      processors: [new ToolCallFilter({ exclude: ['weather'] }), new TokenLimiter(250)],
    });

    // We should have fewer messages after filtering and token limiting
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(messages.length);
    // And they should exclude weather tool messages
    expect(filterToolResultsByName(result, `weather`)).toHaveLength(0);
    expect(filterToolCallsByName(result, `weather`)).toHaveLength(0);
  });

  it('should apply multiple processors without duplicating messages', async () => {
    class ConversationOnlyFilter extends MemoryProcessor {
      constructor() {
        super({ name: 'ConversationOnlyFilter' });
      }

      process(messages: CoreMessage[], _opts: MemoryProcessorOpts = {}): CoreMessage[] {
        return messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
      }
    }
    const memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      processors: [new ToolCallFilter(), new ConversationOnlyFilter(), new TokenLimiter(127000)],
      options: {
        lastMessages: 10,
        semanticRecall: true,
        workingMemory: {
          enabled: true,
        },
      },
    });
    const thread = await memory.createThread({
      title: 'Multiple Processors Test Thread 2',
      resourceId,
    });
    const instructions = 'You are a helpful assistant';
    const agent = new Agent({
      name: 'processor-test-agent',
      instructions,
      model: openai('gpt-4o'),
      memory,
    });

    const userMessage = 'Tell me something interesting about space';

    const res = await agent.generate(
      [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      {
        threadId: thread.id,
        resourceId,
      },
    );

    const responseMessages = JSON.parse(res.request.body || '')?.messages;
    if (!Array.isArray(responseMessages)) {
      throw new Error(`responseMessages should be an array`);
    }

    const userMessagesByContent = responseMessages.filter(m => m.content === userMessage);
    expect(userMessagesByContent).toEqual([expect.objectContaining({ role: 'user', content: userMessage })]); // should only be one
    expect(userMessagesByContent.length).toBe(1); // if there's more than one we have duplicate messages

    const userMessage2 = 'Tell me something else interesting about space';

    const res2 = await agent.generate(
      [
        {
          role: 'user',
          content: userMessage2,
        },
      ],
      {
        threadId: thread.id,
        resourceId,
      },
    );

    const responseMessages2 = JSON.parse(res2.request.body || '')?.messages;
    if (!Array.isArray(responseMessages)) {
      throw new Error(`responseMessages should be an array`);
    }

    const userMessagesByContent2 = responseMessages2.filter((m: CoreMessage) => m.content === userMessage2);
    expect(userMessagesByContent2).toEqual([expect.objectContaining({ role: 'user', content: userMessage2 })]); // should only be one
    expect(userMessagesByContent2.length).toBe(1); // if there's more than one we have duplicate messages

    // make sure all user messages are there
    const allUserMessages = responseMessages2.filter((m: CoreMessage) => m.role === 'user');
    expect(allUserMessages.length).toBe(2);

    const remembered = await memory.query({
      threadId: thread.id,
      resourceId,
      selectBy: {
        last: 20,
      },
    });
    expect(remembered.messages.filter(m => m.role === 'user').length).toBe(2);
    expect(remembered.messages.length).toBe(4); // 2 user, 2 assistant. These wont be filtered because they come from memory.query() directly
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
    const queryResult = await memory.query({
      threadId,
      selectBy: { last: 20 },
    });

    const list = new MessageList({ threadId }).add(queryResult.messagesV2, 'memory');

    const baselineResult = await memory.processMessages({
      messages: list.get.remembered.core(),
      newMessages: list.get.input.core(),
      processors: [],
    });

    // There should be at least 6 messages (3 user + 3 assistant responses)
    expect(baselineResult.length).toBeGreaterThanOrEqual(6);

    // Verify we have tool calls in the baseline
    const weatherToolCalls = filterToolCallsByName(baselineResult, 'get_weather');
    const calculatorToolCalls = filterToolCallsByName(baselineResult, 'calculator');
    expect(weatherToolCalls.length).toBeGreaterThan(0);
    expect(calculatorToolCalls.length).toBeGreaterThan(0);

    // Test filtering weather tool calls
    const weatherQueryResult = await memory.query({
      threadId,
      selectBy: { last: 20 },
    });
    const list2 = new MessageList({ threadId }).add(weatherQueryResult.messagesV2, 'memory');
    const weatherFilteredResult = await memory.processMessages({
      messages: list2.get.all.core(),
      processors: [new ToolCallFilter({ exclude: ['get_weather'] })],
    });

    // Should have fewer messages after filtering
    expect(weatherFilteredResult.length).toBeLessThan(baselineResult.length);

    // No weather tool calls should remain
    expect(filterToolCallsByName(weatherFilteredResult, 'get_weather').length).toBe(0);
    expect(filterToolResultsByName(weatherFilteredResult, 'get_weather').length).toBe(0);

    // Calculator tool calls should still be present
    expect(filterToolCallsByName(weatherFilteredResult, 'calculator').length).toBeGreaterThan(0);

    // Test token limiting
    const tokenLimitQuery = await memory.query({
      threadId,
      selectBy: { last: 20 },
    });
    const list3 = new MessageList({ threadId }).add(tokenLimitQuery.messages, 'memory');
    const tokenLimitedResult = await memory.processMessages({
      messages: list3.get.all.core(),
      processors: [new TokenLimiter(100)], // Small limit to only get a subset
    });

    // Should have fewer messages after token limiting
    expect(tokenLimitedResult.length).toBeLessThan(baselineResult.length);

    // Test combining processors
    const combinedQuery = await memory.query({
      threadId,
      selectBy: { last: 20 },
    });
    const list4 = new MessageList({ threadId }).add(combinedQuery.messages, 'memory');
    const combinedResult = await memory.processMessages({
      messages: list4.get.all.core(),
      processors: [new ToolCallFilter({ exclude: ['get_weather', 'calculator'] }), new TokenLimiter(500)],
    });

    // No tool calls should remain
    expect(filterToolCallsByName(combinedResult, 'get_weather').length).toBe(0);
    expect(filterToolCallsByName(combinedResult, 'calculator').length).toBe(0);
    expect(filterToolResultsByName(combinedResult, 'get_weather').length).toBe(0);
    expect(filterToolResultsByName(combinedResult, 'calculator').length).toBe(0);

    // The result should still contain some messages
    expect(combinedResult.length).toBeGreaterThan(0);
  });

  it('should chunk long text by character count', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'Text Chunking Test Thread',
      resourceId,
    });

    // Create a long text with known word boundaries
    const words = [];
    for (let i = 0; i < 1000; i++) {
      words.push(`word${i}`);
    }
    const longText = words.join(' ');

    // Save a message with the long text
    await memory.saveMessages({
      messages: [
        {
          id: 'chunking-test',
          threadId: thread.id,
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: longText }],
          },
          createdAt: new Date(),
          resourceId,
        },
      ],
    });

    // Query the message back
    const queryResult = await memory.query({
      threadId: thread.id,
      selectBy: { last: 1 },
    });

    // Retrieve the message (no TokenLimiter, just get the message back)
    const result = await memory.processMessages({
      messages: v2ToCoreMessages(queryResult.uiMessages),
    });

    // Should have retrieved the message
    expect(result.length).toBe(1);

    // Each chunk should respect word boundaries
    for (const msg of result) {
      // No words should be cut off
      const content = typeof msg.content === 'string' ? msg.content : (msg.content[0] as { text: string }).text;
      const words = content.split(/\s+/);
      for (const word of words) {
        expect(word).toMatch(/^word\d+$/); // Each word should be complete
      }
    }

    // Chunks should maintain original order
    let prevNum = -1;
    for (const msg of result) {
      const content = typeof msg.content === 'string' ? msg.content : (msg.content[0] as { text: string }).text;
      const firstWord = content.split(/\s+/)[0];
      const num = parseInt(firstWord.replace('word', ''));
      expect(num).toBeGreaterThan(prevNum);
      prevNum = num;
    }
  });
});

// Direct unit test for chunkText

describe('Memory.chunkText', () => {
  it('should split long text into chunks at word boundaries', () => {
    const memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      options: {
        semanticRecall: true,
        lastMessages: 10,
      },
    });
    const words = [];
    for (let i = 0; i < 1000; i++) {
      words.push(`word${i}`);
    }
    const longText = words.join(' ');
    // Use a small token size to force chunking
    const chunks = (memory as any).chunkText(longText, 50);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should respect word boundaries
    for (const chunk of chunks) {
      const chunkWords = chunk.split(/\s+/);
      for (const word of chunkWords) {
        if (word.length === 0) continue;
        expect(word).toMatch(/^word\d+$/);
      }
    }
    // Chunks should maintain original order
    let prevNum = -1;
    for (const chunk of chunks) {
      const firstWord = chunk.split(/\s+/)[0];
      if (!firstWord) continue; // skip empty
      const num = parseInt(firstWord.replace('word', ''));
      expect(num).toBeGreaterThan(prevNum);
      prevNum = num;
    }
  });
});
