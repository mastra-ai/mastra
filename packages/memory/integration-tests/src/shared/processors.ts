import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent, MessageList } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { ProcessInputArgs, ProcessInputResult, Processor } from '@mastra/core/processors';
import { TokenLimiter, ToolCallFilter } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  filterToolCallsByName,
  filterToolResultsByName,
  filterMastraToolResultsByName,
  generateConversationHistory,
} from '../test-utils';

import { createMockModel, createMockModelWithToolCalls } from './mock-models';
import type { MockModelConfig } from './mock-models';

function v2ToCoreMessages(messages: MastraDBMessage[]): CoreMessage[] {
  return new MessageList().add(messages, 'memory').get.all.core();
}

const abort: (reason?: string) => never = reason => {
  throw new Error(reason || 'Aborted');
};

export interface ProcessorsTestConfig extends MockModelConfig {
  version: 'v5' | 'v6';
}

export function getProcessorsTests(config: ProcessorsTestConfig) {
  const { version } = config;

  describe(`Memory with Processors (${version})`, () => {
    let memory: Memory;
    let storage: LibSQLStore;
    let vector: LibSQLVector;
    const resourceId = 'processor-test';

    beforeEach(async () => {
      // Create a new unique database file in the temp directory for each test
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-processor-test-`)), 'test.db');

      storage = new LibSQLStore({
        id: 'processor-test-storage',
        url: `file:${dbPath}`,
      });
      vector = new LibSQLVector({
        id: 'processor-test-vector',
        url: `file:${dbPath}`,
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
      const tokenLimiter = new TokenLimiter(250);
      const result = await tokenLimiter.processInput({
        messages: new MessageList({ threadId: thread.id, resourceId }).add(queryResult.messages, 'memory').get.all.db(),
        abort,
        requestContext: new RequestContext(),
      });

      // We should have messages limited by token count
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThan(queryResult.messages.length); // Should get fewer messages than the full set

      // Verify the last message contains a tool result in MastraDBMessage format
      const lastMessage = result.at(-1);
      expect(lastMessage?.role).toBe('assistant');
      expect(lastMessage?.content.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'tool-invocation',
            toolInvocation: expect.objectContaining({
              state: 'result',
              toolCallId: 'tool-9',
              toolName: 'weather',
              result: 'Pretty hot',
            }),
          }),
        ]),
      );

      // Now query with a very high token limit that should return all messages
      const allMessagesQuery = await memory.recall({
        threadId: thread.id,
        perPage: 20,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      expect(allMessagesQuery.messages.length).toBe(20);

      // Apply TokenLimiter processor directly
      const tokenLimiter2 = new TokenLimiter(3000); // High limit that should exceed total tokens
      const messageList = new MessageList({ threadId: thread.id, resourceId }).add(allMessagesQuery.messages, 'memory');

      const processedMessages = await tokenLimiter2.processInput({
        messages: messageList.get.all.db(),
        abort: () => {
          throw new Error('Aborted');
        },
        requestContext: new RequestContext(),
      });

      // create response message list to add to memory
      const messages = new MessageList({ threadId: thread.id, resourceId })
        .add(processedMessages, 'response')
        .get.all.db();

      const listed = new MessageList({ threadId: thread.id, resourceId }).add(messages, 'memory').get.all.db();

      // We should get all messages back (no reduction due to high token limit)
      // Note: messages are consolidated when added with 'response' source, so listed.length === messages.length
      expect(listed.length).toBe(messages.length);
      // processedMessages should be 20 (no consolidation yet)
      expect(processedMessages.length).toBe(20);
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

      // Create a MessageList and add the messages to it
      const messageList = new MessageList({ threadId: thread.id, resourceId });
      for (const message of queryResult.messages) {
        messageList.add(message, 'memory');
      }

      const filteredResult = await toolCallFilter.processInput({
        messages: queryResult.messages,
        abort,
        requestContext: new RequestContext(),
        messageList,
      });
      const messages = Array.isArray(filteredResult) ? filteredResult : filteredResult.get.all.db();

      // Count parts before and after filtering
      const totalPartsBefore = messagesV2.reduce((sum, msg) => sum + (msg.content.parts?.length || 0), 0);
      const totalPartsAfter = messages.reduce((sum, msg) => sum + (msg.content.parts?.length || 0), 0);

      // Assert that parts were removed (not necessarily entire messages)
      expect(totalPartsAfter).toBeLessThan(totalPartsBefore);

      // Assert tool results are filtered correctly (using Mastra format helpers)
      // Note: generateConversationHistory creates tool invocations with state: 'result' only
      expect(filterMastraToolResultsByName(messages, 'weather')).toHaveLength(0);
      expect(filterMastraToolResultsByName(messages, 'calculator')).toHaveLength(1);

      // make another query with no processors to make sure memory messages in DB were not altered and were only filtered from results
      const queryResult2 = await memory.recall({
        threadId: thread.id,
        perPage: 20,
      });
      // No processors, just convert to core messages
      const result2 = v2ToCoreMessages(queryResult2.messages);
      const messages2 = new MessageList({ threadId: thread.id, resourceId }).add(result2, 'response').get.all.db();
      // MessageList.add with 'response' source consolidates messages, so messages2 will be shorter than queryResult2.messages
      // MessageList.add with 'memory' source does NOT consolidate, so the final count will equal messages2.length
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
      const toolCallFilter3 = new ToolCallFilter({ exclude: ['weather', 'calculator'] });

      // Create a MessageList and add the messages to it
      const messageList3 = new MessageList({ threadId: thread.id, resourceId });
      for (const message of queryResult3.messages) {
        messageList3.add(message, 'memory');
      }

      const filteredMessages3 = await toolCallFilter3.processInput({
        messages: queryResult3.messages,
        abort,
        requestContext: new RequestContext(),
        messageList: messageList3,
      });
      const result3 = v2ToCoreMessages(filteredMessages3 as MastraDBMessage[]);

      // Count parts before and after filtering (both tools excluded)
      const totalPartsBefore3 = messagesV2.reduce((sum, msg) => sum + (msg.content.parts?.length || 0), 0);
      const totalPartsAfter3 = result3.reduce((sum, msg) => sum + ((msg.content as any)?.parts?.length || 0), 0);
      expect(totalPartsAfter3).toBeLessThan(totalPartsBefore3);

      expect(filterToolCallsByName(result3, 'weather')).toHaveLength(0);
      expect(filterToolResultsByName(result3, 'weather')).toHaveLength(0);
      expect(filterToolCallsByName(result3, 'calculator')).toHaveLength(0);
      expect(filterToolResultsByName(result3, 'calculator')).toHaveLength(0);

      // filter all by default
      const queryResult4 = await memory.recall({
        threadId: thread.id,
        perPage: 20,
      });
      const toolCallFilter4 = new ToolCallFilter();
      const messageList4 = new MessageList({ threadId: thread.id, resourceId });
      for (const message of queryResult4.messages) {
        messageList4.add(message, 'memory');
      }
      const filteredResult4 = await toolCallFilter4.processInput({
        messages: queryResult4.messages,
        abort,
        requestContext: new RequestContext(),
        messageList: messageList4,
      });
      const filteredMessages4 = Array.isArray(filteredResult4) ? filteredResult4 : filteredResult4.get.all.db();
      const result4 = v2ToCoreMessages(filteredMessages4);

      // Count parts before and after filtering (all tools excluded)
      const totalPartsBefore4 = queryResult4.messages.reduce((sum, msg) => sum + (msg.content.parts?.length || 0), 0);
      const totalPartsAfter4 = filteredMessages4.reduce((sum, msg) => sum + (msg.content.parts?.length || 0), 0);
      expect(totalPartsAfter4).toBeLessThan(totalPartsBefore4); // All tool invocations should be filtered

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
      const { messagesV2 } = generateConversationHistory({
        threadId: thread.id,
        resourceId,
        messageCount: 8,
        toolFrequency: 2, // Every other assistant response is a tool call
        toolNames: ['weather', 'calculator', 'search'],
      });

      // Save messages
      await memory.saveMessages({ messages: messagesV2 });

      // Apply multiple processors: first remove weather tool calls, then limit to 250 tokens
      const queryResult = await memory.recall({
        threadId: thread.id,
        perPage: 20,
      });
      const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });
      const tokenLimiter = new TokenLimiter(250);
      const requestContext = new RequestContext();

      const messageList5 = new MessageList({ threadId: thread.id, resourceId });
      for (const message of queryResult.messages) {
        messageList5.add(message, 'memory');
      }

      const filteredMessages = await toolCallFilter.processInput({
        messages: queryResult.messages,
        messageList: messageList5,
        abort,
        requestContext,
      });
      const filteredArray = Array.isArray(filteredMessages) ? filteredMessages : filteredMessages.get.all.db();
      const limitedMessages = await tokenLimiter.processInput({
        messages: filteredArray,
        abort,
        requestContext,
      });
      const result = v2ToCoreMessages(limitedMessages);

      // We should have fewer messages after filtering and token limiting
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThan(messagesV2.length);
      // And they should exclude weather tool messages
      expect(filterToolResultsByName(result, `weather`)).toHaveLength(0);
      expect(filterToolCallsByName(result, `weather`)).toHaveLength(0);
    });

    it('should apply multiple processors without duplicating messages', async () => {
      class ConversationOnlyFilter implements Processor {
        id = 'conversation-only-filter';
        name = 'ConversationOnlyFilter';

        processInput(args: ProcessInputArgs<unknown>): ProcessInputResult {
          return args.messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
        }
      }
      const testMemory = new Memory({
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
      const thread = await testMemory.createThread({
        title: 'Multiple Processors Test Thread 2',
        resourceId,
      });
      const instructions = 'You are a helpful assistant';
      const mockModel = createMockModel(config);
      const agent = new Agent({
        id: 'processor-test-agent',
        name: 'processor-test-agent',
        instructions,
        model: mockModel,
        memory: testMemory,
        inputProcessors: [new ToolCallFilter(), new ConversationOnlyFilter(), new TokenLimiter(127000)],
      });

      const userMessage = 'Tell me something interesting about space';

      const res = await agent.generate([{ role: 'user', content: userMessage }], {
        memory: { thread: thread.id, resource: resourceId },
      });

      // Small delay to ensure message persistence completes
      await new Promise(resolve => setTimeout(resolve, 50));

      const requestBody = typeof res.request.body === 'string' ? JSON.parse(res.request.body) : res.request.body;
      const requestInputMessages = requestBody.input || requestBody.messages;
      if (!Array.isArray(requestInputMessages)) {
        throw new Error(`responseMessages should be an array`);
      }

      const userMessagesByContent = requestInputMessages.filter((m: any) => {
        const text = m.content?.[0]?.text || (typeof m.content === 'string' ? m.content : '');
        return text === userMessage;
      });
      expect(userMessagesByContent.length).toBe(1); // if there's more than one we have duplicate messages

      const userMessage2 = 'Tell me something else interesting about space';

      const res2 = await agent.generate([{ role: 'user', content: userMessage2 }], {
        memory: { thread: thread.id, resource: resourceId },
      });

      // Small delay to ensure message persistence completes
      await new Promise(resolve => setTimeout(resolve, 50));

      const requestBody2 = typeof res2.request.body === 'string' ? JSON.parse(res2.request.body) : res2.request.body;
      const requestInputMessages2 = requestBody2.input || requestBody2.messages;

      if (!Array.isArray(requestInputMessages2)) {
        throw new Error(`responseMessages should be an array`);
      }

      const userMessagesByContent2 = requestInputMessages2.filter((m: any) => {
        const text = m.content?.[0]?.text || (typeof m.content === 'string' ? m.content : '');
        return text === userMessage2;
      });
      expect(userMessagesByContent2.length).toBe(1); // if there's more than one we have duplicate messages

      // make sure all user messages are there
      const allUserMessages = requestInputMessages2.filter((m: any) => m.role === 'user');
      expect(allUserMessages.length).toBe(2);

      const remembered = await testMemory.recall({
        threadId: thread.id,
        resourceId,
        perPage: 20,
      });
      expect(remembered.messages.filter(m => m.role === 'user').length).toBe(2);
      expect(remembered.messages.length).toBe(4); // 2 user, 2 assistant. These wont be filtered because they come from memory.recall() directly
    });

    it('should apply processors with tool calls', async () => {
      // Create a thread
      const thread = await memory.createThread({
        title: 'Tool Processor Test Thread',
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
          // Safe calculation for test purposes - only handles simple multiplication
          const match = input.expression.match(/^(\d+)\s*\*\s*(\d+)$/);
          if (match) {
            const result = parseInt(match[1]) * parseInt(match[2]);
            return `The result of ${input.expression} is ${result}`;
          }
          return `Cannot calculate: ${input.expression}`;
        },
      });

      const instructions =
        'You are a helpful assistant with access to weather and calculator tools. Use them when appropriate.';

      // Create mock model that returns tool calls
      const weatherMockModel = createMockModelWithToolCalls(config, [
        {
          toolName: 'get_weather',
          toolCallId: 'call-weather-1',
          args: { location: 'Seattle' },
          result: 'The weather in Seattle is sunny.',
        },
      ]);

      const calculatorMockModel = createMockModelWithToolCalls(config, [
        {
          toolName: 'calculator',
          toolCallId: 'call-calc-1',
          args: { expression: '123 * 456' },
          result: 'The result is 56088',
        },
      ]);

      const textMockModel = createMockModel(config, 'Space is vast and contains billions of galaxies.');

      // Create agents for each scenario
      const weatherAgent = new Agent({
        id: 'weather-agent',
        name: 'weather-agent',
        instructions,
        model: weatherMockModel,
        memory,
        tools: { get_weather: weatherTool },
      });

      const calculatorAgent = new Agent({
        id: 'calculator-agent',
        name: 'calculator-agent',
        instructions,
        model: calculatorMockModel,
        memory,
        tools: { calculator: calculatorTool },
      });

      const textAgent = new Agent({
        id: 'text-agent',
        name: 'text-agent',
        instructions,
        model: textMockModel,
        memory,
      });

      // First message - use weather tool
      await weatherAgent.generate('What is the weather in Seattle?', {
        memory: { thread: threadId, resource: resourceId },
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      // Second message - use calculator tool
      await calculatorAgent.generate('Calculate 123 * 456', { memory: { thread: threadId, resource: resourceId } });
      await new Promise(resolve => setTimeout(resolve, 50));
      // Third message - simple text response
      await textAgent.generate('Tell me something interesting about space', {
        memory: { thread: threadId, resource: resourceId },
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // Query with no processors to verify baseline message count
      const queryResult = await memory.recall({
        threadId,
        perPage: 20,
      });

      const list = new MessageList({ threadId }).add(queryResult.messages, 'memory');

      const baselineResult = [...list.get.remembered.core(), ...list.get.input.core()];

      // There should be at least 6 messages (3 user + 3 assistant responses)
      expect(baselineResult.length).toBeGreaterThanOrEqual(6);

      // Verify we have tool calls in the baseline
      const weatherToolCalls = filterToolCallsByName(baselineResult, 'get_weather');
      const calculatorToolCalls = filterToolCallsByName(baselineResult, 'calculator');
      expect(weatherToolCalls.length).toBeGreaterThan(0);
      expect(calculatorToolCalls.length).toBeGreaterThan(0);

      // Test filtering weather tool calls
      const weatherQueryResult = await memory.recall({
        threadId,
        perPage: 20,
      });
      const list2 = new MessageList({ threadId }).add(weatherQueryResult.messages, 'memory');
      const toolCallFilter5 = new ToolCallFilter({ exclude: ['get_weather'] });
      const filteredMessages5 = await toolCallFilter5.processInput({
        messages: list2.get.all.db(),
        messageList: list2,
        abort,
        requestContext: new RequestContext(),
      });
      const filteredArray5 = Array.isArray(filteredMessages5) ? filteredMessages5 : filteredMessages5.get.all.db();
      const weatherFilteredResult = v2ToCoreMessages(filteredArray5);

      // Should have fewer messages after filtering
      expect(weatherFilteredResult.length).toBeLessThan(baselineResult.length);

      // No weather tool calls should remain
      expect(filterToolCallsByName(weatherFilteredResult, 'get_weather').length).toBe(0);
      expect(filterToolResultsByName(weatherFilteredResult, 'get_weather').length).toBe(0);

      // Calculator tool calls should still be present
      expect(filterToolCallsByName(weatherFilteredResult, 'calculator').length).toBeGreaterThan(0);

      // Test token limiting - call processor directly (ProcessorRunner only processes 'input' source messages)
      const tokenLimitQuery = await memory.recall({
        threadId,
        perPage: 20,
      });
      const tokenLimitList = new MessageList({ threadId, resourceId }).add(tokenLimitQuery.messages, 'memory');
      // Use a very small token limit (10 tokens) to ensure messages get filtered
      const tokenLimiter = new TokenLimiter(10);
      const tokenLimitedMessages = await tokenLimiter.processInput({
        messages: tokenLimitList.get.all.db(),
        abort,
        requestContext: new RequestContext(),
      });
      const tokenLimitedResult = v2ToCoreMessages(tokenLimitedMessages);

      // Should have fewer messages after token limiting (10 tokens is very restrictive)
      expect(tokenLimitedResult.length).toBeLessThan(baselineResult.length);

      // Test combining processors - call processors directly in sequence
      const combinedQuery = await memory.recall({
        threadId,
        perPage: 20,
      });
      const combinedList = new MessageList({ threadId, resourceId }).add(combinedQuery.messages, 'memory');
      const toolCallFilter2 = new ToolCallFilter({ exclude: ['get_weather', 'calculator'] });
      const tokenLimiter2 = new TokenLimiter(500);
      const requestContext = new RequestContext();

      // First filter tool calls
      const filteredResult = await toolCallFilter2.processInput({
        messages: combinedList.get.all.db(),
        messageList: combinedList,
        abort,
        requestContext,
      });
      const filteredArray = Array.isArray(filteredResult) ? filteredResult : filteredResult.get.all.db();

      // Then apply token limit
      const combinedMessages = await tokenLimiter2.processInput({
        messages: filteredArray,
        abort,
        requestContext,
      });
      const combinedResult = v2ToCoreMessages(combinedMessages);

      // No tool calls should remain
      expect(filterToolCallsByName(combinedResult, 'get_weather').length).toBe(0);
      expect(filterToolCallsByName(combinedResult, 'calculator').length).toBe(0);
      expect(filterToolResultsByName(combinedResult, 'get_weather').length).toBe(0);
      expect(filterToolResultsByName(combinedResult, 'calculator').length).toBe(0);

      // The result should still contain some messages
      expect(combinedResult.length).toBeGreaterThan(0);
    });

    it.skip('should chunk long text by character count', async () => {
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
              format: 2 as const,
              parts: [{ type: 'text' as const, text: longText }],
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

      // Retrieve the message (no TokenLimiter, just get the message back)
      // @ts-expect-error TODO, what is this test supposed to be doing?
      const result = await memory.processMessages({
        messages: v2ToCoreMessages(queryResult.messages),
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
  describe(`Memory.chunkText (${version})`, () => {
    let storage: LibSQLStore;
    let vector: LibSQLVector;

    beforeEach(async () => {
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-chunk-test-`)), 'test.db');
      storage = new LibSQLStore({
        id: 'chunk-test-storage',
        url: `file:${dbPath}`,
      });
      vector = new LibSQLVector({
        id: 'chunk-test-vector',
        url: `file:${dbPath}`,
      });
    });

    afterEach(async () => {
      //@ts-ignore
      await storage.client.close();
      //@ts-ignore
      await vector.turso.close();
    });

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
}
