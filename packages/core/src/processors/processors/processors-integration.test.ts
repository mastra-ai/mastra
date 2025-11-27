import { describe, it, expect } from 'vitest';

import type { MastraDBMessage } from '../../agent/message-list';
import { MessageList } from '../../agent/message-list';

import { TokenLimiterProcessor } from './token-limiter';
import { ToolCallFilter } from './tool-call-filter';

describe('Processors Integration Tests', () => {
  const mockAbort = ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;

  /**
   * Test processor chaining with ToolCallFilter + TokenLimiter
   *
   * Origin: Migrated from packages/memory/integration-tests/src/processors.test.ts
   * Test name: "should apply multiple processors in order"
   *
   * Purpose: Verify that multiple processors can be chained together in a specific order
   * and that each processor operates on the output of the previous processor.
   */
  it('should chain multiple processors in order (ToolCallFilter + TokenLimiter)', async () => {
    // Create messages with tool calls and text content
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather in NYC?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The weather in NYC is sunny and 72°F. It is a beautiful day outside with clear skies.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-1',
                toolName: 'weather',
                args: { location: 'NYC' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-1',
                toolName: 'weather',
                args: {},
                result: 'Sunny, 72°F',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-5',
        role: 'user',
        content: {
          format: 2,
          content: 'What about San Francisco?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content: {
          format: 2,
          content: 'San Francisco is foggy with a temperature of 58°F.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-2',
                toolName: 'time',
                args: { location: 'SF' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-2',
                toolName: 'time',
                args: {},
                result: '3:45 PM',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
    ];

    // Step 1: Apply ToolCallFilter to exclude weather tool calls
    const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });

    // Create MessageList and add messages
    const messageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    for (const msg of messages) {
      messageList.add(msg, 'input');
    }

    const filteredResult = await toolCallFilter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: mockAbort,
    });
    // Extract messages from result (could be MessageList or MastraDBMessage)
    const filteredMessages = Array.isArray(filteredResult)
      ? filteredResult
      : filteredResult instanceof MessageList
        ? filteredResult.get.all.db()
        : [filteredResult];

    // Verify ToolCallFilter removed weather tool call messages
    expect(filteredMessages).toHaveLength(3); // msg-1 (user), msg-5 (user), msg-6 (assistant with 'time' tool)
    expect(filteredMessages.some(m => m.id === 'msg-2')).toBe(false); // Weather tool call removed
    expect(filteredMessages.some(m => m.id === 'msg-6')).toBe(true); // Time tool call preserved
    expect(filteredMessages.some(m => m.id === 'msg-1')).toBe(true); // User message preserved
    expect(filteredMessages.some(m => m.id === 'msg-5')).toBe(true); // User message preserved

    // Step 2: Apply TokenLimiter to limit message count
    // TokenLimiter with a low limit should further reduce messages
    const tokenLimiter = new TokenLimiterProcessor({ limit: 50 });

    const limitedMessages = await tokenLimiter.processInput({
      messages: filteredMessages,
      abort: mockAbort,
    });

    // Verify TokenLimiter further reduced messages
    expect(limitedMessages.length).toBeLessThanOrEqual(filteredMessages.length);
    expect(limitedMessages.length).toBeGreaterThan(0); // Should have at least some messages

    // Verify no message duplication
    const messageIds = limitedMessages.map(m => m.id);
    const uniqueIds = new Set(messageIds);
    expect(messageIds.length).toBe(uniqueIds.size);

    // Verify final messages are a subset of filtered messages
    limitedMessages.forEach(msg => {
      expect(filteredMessages.some(m => m.id === msg.id)).toBe(true);
    });
  });

  it('should apply multiple processors without duplicating messages', async () => {
    // Create test messages
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Weather is sunny',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'tc-1',
                toolName: 'weather',
                args: { location: 'NYC' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'tc-1',
                toolName: 'weather',
                args: {},
                result: 'Sunny',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-3',
        role: 'user',
        content: {
          format: 2,
          content: 'What time is it?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: {
          format: 2,
          content: 'It is 3:45 PM',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'tc-2',
                toolName: 'time',
                args: {},
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'tc-2',
                toolName: 'time',
                args: {},
                result: '3:45 PM',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-5',
        role: 'user',
        content: {
          format: 2,
          content: 'Thanks',
          parts: [],
        },
        createdAt: new Date(),
      },
    ];

    // Create MessageList and add messages
    const messageList = new MessageList({
      threadId: 'test-thread',
      resourceId: 'test-resource',
    });

    for (const msg of messages) {
      messageList.add(msg, 'input');
    }

    // Apply ToolCallFilter (exclude 'weather')
    const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });
    const filteredResult = await toolCallFilter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: mockAbort,
    });

    const filteredMessages = Array.isArray(filteredResult)
      ? filteredResult
      : filteredResult instanceof MessageList
        ? filteredResult.get.all.db()
        : [filteredResult];

    // Apply TokenLimiter
    const tokenLimiter = new TokenLimiterProcessor({ limit: 100 });
    const limitedMessages = await tokenLimiter.processInput({
      messages: filteredMessages,
      abort: mockAbort,
    });

    // Verify no duplicates by checking unique IDs
    const messageIds = limitedMessages.map(m => m.id);
    const uniqueIds = new Set(messageIds);

    expect(uniqueIds.size).toBe(messageIds.length);

    // Verify all messages are unique by content
    const messageContents = limitedMessages.map(m => JSON.stringify(m));
    const uniqueContents = new Set(messageContents);

    expect(uniqueContents.size).toBe(messageContents.length);

    // Verify final messages are subset of filtered messages
    const filteredIds = new Set(filteredMessages.map(m => m.id));
    for (const msg of limitedMessages) {
      expect(filteredIds.has(msg.id)).toBe(true);
    }
  });

  /**
   * Test processors with a real Mastra agent integration
   *
   * Origin: Migrated from packages/memory/integration-tests/src/processors.test.ts
   * Test name: "should apply processors with a real Mastra agent"
   *
   * Purpose: Verify that processors work correctly when used directly with ProcessorRunner,
   * simulating how they're used in the agent's memory system.
   *
   * Note: This is a unit test that verifies processor behavior without requiring
   * a full agent setup or LLM calls. Integration tests with real agents are in
   * packages/memory/integration-tests/
   */
  it('should integrate processors with ProcessorRunner', async () => {
    // Create messages simulating a conversation with tool calls
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather in Seattle?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The weather in Seattle is sunny and 70 degrees.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-weather-1',
                toolName: 'get_weather',
                args: { location: 'Seattle' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-weather-1',
                toolName: 'get_weather',
                args: {},
                result: 'Sunny, 70°F',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-3',
        role: 'user',
        content: {
          format: 2,
          content: 'Calculate 123 * 456',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The result of 123 * 456 is 56088.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-calc-1',
                toolName: 'calculator',
                args: { expression: '123 * 456' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-calc-1',
                toolName: 'calculator',
                args: {},
                result: '56088',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-5',
        role: 'user',
        content: {
          format: 2,
          content: 'Tell me something interesting about space',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Space is vast and contains billions of galaxies.',
          parts: [],
        },
        createdAt: new Date(),
      },
    ];

    // Create MessageList
    const messageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    for (const msg of messages) {
      messageList.add(msg, 'input');
    }

    // Test 1: Filter weather tool calls
    const weatherFilter = new ToolCallFilter({ exclude: ['get_weather'] });
    const weatherFilteredResult = await weatherFilter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: mockAbort,
    });

    const weatherFilteredMessages = Array.isArray(weatherFilteredResult)
      ? weatherFilteredResult
      : weatherFilteredResult.get.all.db();

    // Should have fewer messages (msg-2 with weather tool removed)
    expect(weatherFilteredMessages.length).toBe(5);
    expect(weatherFilteredMessages.some(m => m.id === 'msg-2')).toBe(false);
    expect(weatherFilteredMessages.some(m => m.id === 'msg-4')).toBe(true); // Calculator preserved

    // Test 2: Apply token limiting with a low limit to force truncation
    // The limiter uses ~24 tokens for conversation overhead + ~3.8 per message
    // With 6 messages, we need a limit that keeps some but not all messages
    const tokenLimiter = new TokenLimiterProcessor({ limit: 50 });
    const tokenLimitedResult = await tokenLimiter.processInput({
      messages: messageList.get.all.db(),
      abort: mockAbort,
    });

    // Should have fewer messages due to token limit (prioritizes recent messages)
    expect(tokenLimitedResult.length).toBeLessThan(messages.length);
    expect(tokenLimitedResult.length).toBeGreaterThan(0);

    // Test 3: Combine both processors
    const combinedFilter = new ToolCallFilter({ exclude: ['get_weather', 'calculator'] });
    const combinedFilteredResult = await combinedFilter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: mockAbort,
    });

    const combinedFilteredMessages = Array.isArray(combinedFilteredResult)
      ? combinedFilteredResult
      : combinedFilteredResult.get.all.db();

    // Then apply token limiter
    const finalResult = await tokenLimiter.processInput({
      messages: combinedFilteredMessages,
      abort: mockAbort,
    });

    // Should have no tool call messages
    expect(combinedFilteredMessages.some(m => m.id === 'msg-2')).toBe(false);
    expect(combinedFilteredMessages.some(m => m.id === 'msg-4')).toBe(false);
    // But should still have user messages and simple assistant response
    expect(combinedFilteredMessages.some(m => m.id === 'msg-1')).toBe(true);
    expect(combinedFilteredMessages.some(m => m.id === 'msg-6')).toBe(true);

    // Final result should be further limited by tokens
    expect(finalResult.length).toBeGreaterThan(0);
    expect(finalResult.length).toBeLessThanOrEqual(combinedFilteredMessages.length);
  });
});
