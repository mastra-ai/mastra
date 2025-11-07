import { mkdtemp } from 'fs/promises';
import { afterEach } from 'node:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { openai } from '@ai-sdk/openai';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent, MessageList } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { MemoryProcessorOpts } from '@mastra/core/memory';
import { MemoryProcessor } from '@mastra/core/memory';
import { TokenLimiter, ToolCallFilter } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { filterToolCallsByName, filterToolResultsByName, generateConversationHistory } from './test-utils';

function v2ToCoreMessages(messages: MastraDBMessage[] | UIMessage[]): CoreMessage[] {
  return new MessageList().add(messages, 'response').get.all.core();
}

// Helper function to extract text content from MastraDBMessage
function getTextContent(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content?.parts && Array.isArray(message.content.parts)) {
    return message.content.parts.map((p: any) => p.text || '').join('');
  }
  if (message.content?.text) {
    return message.content.text;
  }
  if (typeof message.content?.content === 'string') {
    return message.content.content;
  }
  return '';
}

let memory: Memory;
let storage: LibSQLStore;
let vector: LibSQLVector;
const resourceId = 'processor-test';

beforeEach(async () => {
  // Create a new unique database file in the temp directory for each test
  const dbPath = join(await mkdtemp(join(tmpdir(), `memory-processor-test-`)), 'test.db');

  storage = new LibSQLStore({
    id: 'processor-storage',
    url: `file:${dbPath}`,
  });
  vector = new LibSQLVector({
    connectionUrl: `file:${dbPath}`,
    id: 'test-vector',
  });

  // Initialize memory with the in-memory database
  memory = new Memory({
    storage,
    options: {
      lastMessages: 10,
      semanticRecall: false,
      generateTitle: false,
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
    await memory.saveMessages({ messages: messagesV2 });

    // Get messages with a token limit of 250 (should get ~2.5 messages)
    const queryResult = await memory.recall({
      threadId: thread.id,
      perPage: 20,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    const messageList = new MessageList({ threadId: thread.id, resourceId }).add(queryResult.messages, 'memory');
    const dbMessages = messageList.get.all.db();
    const tokenLimiter = new TokenLimiter(250); // Limit to 250 tokens
    const result = await tokenLimiter.processInput({
      messages: dbMessages,
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });

    // We should have messages limited by token count
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(dbMessages.length); // Should get fewer messages than the full set

    // Verify the last message contains a tool result in MastraDBMessage format
    // Note: If the last assistant message had a tool call, generateConversationHistory adds a final user message
    const lastMessage = result.at(-1);
    if (lastMessage?.role === 'user') {
      // If last message is user, check the second-to-last message for assistant with tool result
      const secondLastMessage = result.at(-2);
      expect(secondLastMessage?.role).toBe('assistant');
      expect(secondLastMessage?.content.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'tool-invocation',
            toolInvocation: expect.objectContaining({
              state: 'result',
            }),
          }),
        ]),
      );
    } else {
      expect(lastMessage?.role).toBe('assistant');
      expect(lastMessage?.content.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'tool-invocation',
            toolInvocation: expect.objectContaining({
              state: 'result',
            }),
          }),
        ]),
      );
    }

    // Now query with a very high token limit that should return all messages
    const allMessagesQuery = await memory.recall({
      threadId: thread.id,
      perPage: 20,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    expect(allMessagesQuery.messages.length).toBe(20);

    const tokenLimiter2 = new TokenLimiter(3000); // High limit that should exceed total tokens
    const allMessagesResult = await tokenLimiter2.processInput({
      messages: new MessageList({ threadId: thread.id, resourceId })
        .add(allMessagesQuery.messages, 'memory')
        .get.all.db(),
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });

    // create response message list to add to memory
    const messages = new MessageList({ threadId: thread.id, resourceId })
      .add(allMessagesResult, 'response')
      .get.all.db();

    const listed = new MessageList({ threadId: thread.id, resourceId }).add(messages, 'memory').get.all.db();

    // generateConversationHistory already consolidates tool call/result messages
    // So the count should be the same after adding with 'response' or 'memory' source
    expect(listed.length).toBe(allMessagesQuery.messages.length);
    // TokenLimiter with high limit should return all messages
    expect(allMessagesResult.length).toBe(allMessagesQuery.messages.length);
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
    await memory.saveMessages({ messages: messagesV2 });

    // filter weather tool calls
    const queryResult = await memory.recall({
      threadId: thread.id,
      perPage: 20,
    });
    const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });
    const filteredMessages = await toolCallFilter.processInput({
      messages: queryResult.messages,
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });
    const result = v2ToCoreMessages(filteredMessages);
    const messages = new MessageList({ threadId: thread.id, resourceId }).add(result, 'response').get.all.db();

    // ToolCallFilter removes tool parts but doesn't necessarily remove entire messages
    // if they contain other content. The key test is that weather tools are gone.
    expect(messages.length).toBe(messagesV2.length);
    expect(filterToolCallsByName(result, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result, 'calculator')).toHaveLength(1);
    expect(filterToolResultsByName(result, 'calculator')).toHaveLength(1);

    // make another query with no processors to make sure memory messages in DB were not altered and were only filtered from results
    const queryResult2 = await memory.recall({
      threadId: thread.id,
      perPage: 20,
    });
    const result2 = v2ToCoreMessages(queryResult2.messages);
    const messages2 = new MessageList({ threadId: thread.id, resourceId }).add(result2, 'response').get.all.db();
    expect(new MessageList().add(messages2, 'memory').get.all.db()).toHaveLength(messages2.length);
    expect(filterToolCallsByName(result2, 'weather')).toHaveLength(1);
    expect(filterToolResultsByName(result2, 'weather')).toHaveLength(1);
    expect(filterToolCallsByName(result2, 'calculator')).toHaveLength(1);
    expect(filterToolResultsByName(result2, 'calculator')).toHaveLength(1);

    // filter all by name
    const queryResult3 = await memory.recall({
      threadId: thread.id,
      perPage: 20,
    });
    const toolCallFilter2 = new ToolCallFilter({ exclude: ['weather', 'calculator'] });
    const filteredMessages3 = await toolCallFilter2.processInput({
      messages: queryResult3.messages,
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });
    const result3 = v2ToCoreMessages(filteredMessages3);

    // ToolCallFilter removes tool parts but doesn't necessarily remove entire messages
    // if they contain other content. The key validation is that the specific tools are gone.
    expect(result3.length).toBeLessThanOrEqual(messagesV2.length);
    expect(filterToolCallsByName(result3, 'weather')).toHaveLength(0);
    expect(filterToolResultsByName(result3, 'weather')).toHaveLength(0);
    expect(filterToolCallsByName(result3, 'calculator')).toHaveLength(0);
    expect(filterToolResultsByName(result3, 'calculator')).toHaveLength(0);

    // filter all by default
    const queryResult4 = await memory.recall({
      threadId: thread.id,
      perPage: 20,
    });
    const toolCallFilter3 = new ToolCallFilter();
    const filteredMessages4 = await toolCallFilter3.processInput({
      messages: queryResult4.messages,
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });
    const result4 = v2ToCoreMessages(filteredMessages4);

    // ToolCallFilter removes tool parts but doesn't necessarily remove entire messages
    // if they contain other content. The key validation is that the specific tools are gone.
    expect(result4.length).toBeLessThanOrEqual(messagesV2.length);
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
    const { messagesV2: messages } = generateConversationHistory({
      threadId: thread.id,
      resourceId,
      messageCount: 8,
      toolFrequency: 2, // Every other assistant response is a tool call
      toolNames: ['weather', 'calculator', 'search'],
    });

    // Save messages
    await memory.saveMessages({ messages });

    // Apply multiple processors: first remove weather tool calls, then limit to 250 tokens
    const queryResult = await memory.recall({
      threadId: thread.id,
      perPage: 20,
    });
    const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });
    const tokenLimiter = new TokenLimiter(250);
    let filteredMessages = await toolCallFilter.processInput({
      messages: queryResult.messages,
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });
    filteredMessages = await tokenLimiter.processInput({
      messages: filteredMessages,
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });

    // Convert to CoreMessage for assertions
    const result = v2ToCoreMessages(filteredMessages);

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
      id: 'processor-test-agent',
      name: 'processor-test-agent',
      instructions,
      model: openai('gpt-4o'),
      memory,
      inputProcessors: [new ToolCallFilter(), new ConversationOnlyFilter(), new TokenLimiter(127000)],
    });

    const userMessage = 'Tell me something interesting about space';

    const res = await agent.generateLegacy(
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

    const userMessagesByContent = responseMessages.filter(m => getTextContent(m) === userMessage);
    expect(userMessagesByContent.length).toBe(1); // if there's more than one we have duplicate messages
    expect(userMessagesByContent[0].role).toBe('user');
    expect(getTextContent(userMessagesByContent[0])).toBe(userMessage);

    const userMessage2 = 'Tell me something else interesting about space';

    const res2 = await agent.generateLegacy(
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

    const userMessagesByContent2 = responseMessages2.filter((m: CoreMessage) => getTextContent(m) === userMessage2);
    expect(userMessagesByContent2.length).toBe(1); // if there's more than one we have duplicate messages
    expect(userMessagesByContent2[0].role).toBe('user');
    expect(getTextContent(userMessagesByContent2[0])).toBe(userMessage2);

    // make sure all user messages are there
    const allUserMessages = responseMessages2.filter((m: CoreMessage) => m.role === 'user');
    expect(allUserMessages.length).toBe(2);

    const remembered = await memory.recall({
      threadId: thread.id,
      resourceId,
      perPage: 20,
    });
    expect(remembered.messages.filter(m => m.role === 'user').length).toBe(2);
    expect(remembered.messages.length).toBe(4); // 2 user, 2 assistant. These wont be filtered because they come from memory.recall() directly
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
      execute: async input => {
        return `The weather in ${input.location} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
      },
    });

    const calculatorTool = createTool({
      id: 'calculator',
      description: 'Perform a simple calculation',
      inputSchema: z.object({
        expression: z.string().describe('The mathematical expression to calculate'),
      }),
      execute: async input => {
        return `The result of ${input.expression} is ${eval(input.expression)}`;
      },
    });

    const instructions =
      'You are a helpful assistant with access to weather and calculator tools. Use them when appropriate.';
    // Create agent with memory and tools
    const agent = new Agent({
      id: 'processor-test-agent',
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
    await agent.generateLegacy('What is the weather in Seattle?', {
      threadId,
      resourceId,
    });

    // Second message - use calculator tool
    await agent.generateLegacy('Calculate 123 * 456', {
      threadId,
      resourceId,
    });

    // Third message - simple text response
    await agent.generateLegacy('Tell me something interesting about space', {
      threadId,
      resourceId,
    });

    // Query with no processors to verify baseline message count
    const queryResult = await memory.recall({
      threadId,
      perPage: 20,
    });

    const list = new MessageList({ threadId }).add(queryResult.messages, 'memory');

    // No processors, just get the messages
    const baselineResult = list.get.remembered.core();

    // LLM flakiness: agent may generate 4-6+ messages depending on tool calls and consolidation
    expect(baselineResult.length).toBeGreaterThanOrEqual(4);

    // Verify we have tool calls in the baseline
    const weatherToolCalls = filterToolCallsByName(baselineResult, 'get_weather');
    const calculatorToolCalls = filterToolCallsByName(baselineResult, 'calculator');

    // Skip this test if the LLM didn't call tools (LLM flakiness)
    if (weatherToolCalls.length === 0 || calculatorToolCalls.length === 0) {
      return;
    }

    expect(weatherToolCalls.length).toBeGreaterThan(0);
    expect(calculatorToolCalls.length).toBeGreaterThan(0);

    // Test filtering weather tool calls
    const weatherQueryResult = await memory.recall({
      threadId,
      perPage: 20,
    });
    const list2 = new MessageList({ threadId }).add(weatherQueryResult.messages, 'memory');
    const weatherFilter = new ToolCallFilter({ exclude: ['get_weather'] });
    const weatherFilteredMessages = await weatherFilter.processInput({
      messages: list2.get.all.db(),
      abort: () => {
        throw new Error('Aborted');
      },
      runtimeContext: new RequestContext(),
    });

    const weatherFilteredResult = v2ToCoreMessages(weatherFilteredMessages);

    // Message count may decrease if messages become empty after filtering
    // (ToolCallFilter removes messages with no parts remaining)
    expect(weatherFilteredResult.length).toBeLessThan(baselineResult.length);

    // No weather tool calls should remain
    expect(filterToolCallsByName(weatherFilteredResult, 'get_weather').length).toBe(0);
    expect(filterToolResultsByName(weatherFilteredResult, 'get_weather').length).toBe(0);

    // Calculator tool calls should still be present
    expect(filterToolCallsByName(weatherFilteredResult, 'calculator').length).toBeGreaterThan(0);

    // Test token limiting
    const tokenLimitQuery = await memory.recall({
      threadId,
      perPage: 20,
    });
    const list3 = new MessageList({ threadId }).add(tokenLimitQuery.messages, 'memory');
    const tokenLimitedResult = await memory.processMessages({
      messages: list3.get.all.core(),
      processors: [new TokenLimiter(100)], // Small limit to only get a subset
    });

    // Should have fewer messages after token limiting
    expect(tokenLimitedResult.length).toBeLessThan(baselineResult.length);

    // Test combining processors
    const combinedQuery = await memory.recall({
      threadId,
      perPage: 20,
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
    const queryResult = await memory.recall({
      threadId: thread.id,
      perPage: 1,
    });

    // Retrieve the message (no processors, just convert to core messages)
    const result = v2ToCoreMessages(queryResult.messages);

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
