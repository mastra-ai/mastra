import { openai } from '@ai-sdk/openai';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import { MessageList } from '../../agent/message-list';
import { generateConversationHistory } from '../../agent/test-utils';
import { createTool } from '../../tools';
import { TokenLimiterProcessor } from './token-limiter';
import { ToolCallFilter } from './tool-call-filter';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

describe('TokenLimiterProcessor', () => {
  it('should limit messages to the specified token count', async () => {
    // Create messages with predictable token counts (approximately 25 tokens each)
    const { messagesV2 } = generateConversationHistory({
      threadId: '1',
      messageCount: 5,
      toolNames: [],
      toolFrequency: 0,
    });

    const limiter = new TokenLimiterProcessor(200);
    const mockAbort = vi.fn() as any;
    const result = await limiter.processInput({ messages: messagesV2, abort: mockAbort });

    // Should prioritize newest messages (higher ids)
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('message-8');
    expect(result[1].id).toBe('message-9');
  });

  it('should throw TripWire for empty messages array', async () => {
    const limiter = new TokenLimiterProcessor(1000);
    const mockAbort = vi.fn() as any;
    await expect(limiter.processInput({ messages: [], abort: mockAbort })).rejects.toThrow(
      'TokenLimiterProcessor: No messages to process',
    );
  });

  it('should use different encodings based on configuration', async () => {
    const { messagesV2 } = generateConversationHistory({
      threadId: '6',
      messageCount: 1,
      toolNames: [],
      toolFrequency: 0,
    });

    // Create limiters with different encoding settings
    const defaultLimiter = new TokenLimiterProcessor(1000);
    const customLimiter = new TokenLimiterProcessor({
      limit: 1000,
      encoding: cl100k_base,
    });

    const mockAbort = vi.fn() as any;
    // All should process messagesV2 successfully but potentially with different token counts
    const defaultResult = await defaultLimiter.processInput({ messages: messagesV2, abort: mockAbort });
    const customResult = await customLimiter.processInput({ messages: messagesV2, abort: mockAbort });

    // Each should return the same messagesV2 but with potentially different token counts
    expect(defaultResult.length).toBe(messagesV2.length);
    expect(customResult.length).toBe(messagesV2.length);
  });

  function estimateTokens(messages: MastraDBMessage[]) {
    // Create a TokenLimiterProcessor just for counting tokens
    const testLimiter = new TokenLimiterProcessor(Infinity);

    let estimatedTokens = (TokenLimiterProcessor as any).TOKENS_PER_CONVERSATION || 24; // Use the processor's conversation overhead

    // Count tokens for each message including all overheads
    for (const message of messages) {
      // Base token count from the countInputMessageTokens method
      estimatedTokens += (testLimiter as any).countInputMessageTokens(message);
    }

    return Number(estimatedTokens.toFixed(2));
  }

  function percentDifference(a: number, b: number) {
    const difference = Number(((Math.abs(a - b) / b) * 100).toFixed(2));
    console.log(`${a} and ${b} are ${difference}% different`);
    return difference;
  }

  async function expectTokenEstimate(
    config: Parameters<typeof generateConversationHistory>[0],
    agent: Agent,
    accuracyMargin: number = 2,
  ) {
    const { messagesV2, fakeCore } = generateConversationHistory(config);

    const estimate = estimateTokens(messagesV2);
    const used = (await agent.generateLegacy(fakeCore)).usage.promptTokens;

    // Check if within accuracy margin
    expect(percentDifference(estimate, used)).toBeLessThanOrEqual(accuracyMargin);
  }

  const calculatorTool = createTool({
    id: 'calculator',
    description: 'Perform a simple calculation',
    inputSchema: z.object({
      expression: z.string().describe('The mathematical expression to calculate'),
    }),
    execute: async input => {
      // Don't actually eval the expression. The model is dumb and sometimes passes "banana" as the expression because that's one of the sample tokens we're using in input messages lmao
      return `The result of ${input.expression} is 10`;
    },
  });

  const agent = new Agent({
    id: 'token-estimate-agent',
    name: 'Token Estimate Agent',
    model: openai('gpt-4o-mini'),
    instructions: ``,
    tools: { calculatorTool },
  });

  describe.concurrent(`98% accuracy`, () => {
    it(
      `20 messages, no tools`,
      {
        timeout: 60000,
        // LLM token counts can vary slightly between runs
        retry: 3,
      },
      async () => {
        await expectTokenEstimate(
          {
            messageCount: 10,
            toolFrequency: 0,
            threadId: '2',
          },
          agent,
        );
      },
    );

    it(`60 messages, no tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 30,
          toolFrequency: 0,
          threadId: '3',
        },
        agent,
      );
    }, 60000);

    it(
      `20 messages, 0 tools`,
      {
        timeout: 60000,
        // LLM token counts can vary slightly between runs
        retry: 3,
      },
      async () => {
        await expectTokenEstimate(
          {
            messageCount: 10,
            toolFrequency: 0,
            threadId: '3',
          },
          agent,
        );
      },
    );

    it(`20 messages, 2 tool messages`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 10,
          toolFrequency: 5,
          threadId: '3',
        },
        agent,
      );
    }, 60000);

    it(`40 messages, 6 tool messages`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 20,
          toolFrequency: 5,
          threadId: '4',
        },
        agent,
      );
    }, 60000);

    it(`100 messages, 24 tool messages`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 50,
          toolFrequency: 4,
          threadId: '5',
        },
        agent,
      );
    }, 60000);

    it(
      `101 messages, 49 tool calls`,
      {
        // for some reason AI SDK randomly returns 2x token count here
        retry: 3,
        timeout: 60000,
      },
      async () => {
        await expectTokenEstimate(
          {
            messageCount: 50,
            toolFrequency: 1,
            threadId: '5',
          },
          agent,
          12, // Higher margin due to LLM token counting variability with many tool calls
        );
      },
    );
  });
});

describe.concurrent('ToolCallFilter', () => {
  const abort: (reason?: string) => never = reason => {
    throw new Error(reason || 'abort should not be called in this test');
  };

  it('should exclude all tool calls when created with no arguments', async () => {
    const { messagesV2 } = generateConversationHistory({
      threadId: '3',
      toolNames: ['weather', 'calculator', 'search'],
      messageCount: 1,
      toolFrequency: 1,
    });
    const filter = new ToolCallFilter();
    const messageList = new MessageList().add(messagesV2, 'memory');
    const result = (await filter.processInput({
      messages: messagesV2,
      messageList,
      abort,
    })) as MastraDBMessage[];

    // Should only keep the text message and assistant res
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('message-0');
  });

  it('should exclude specific tool calls by name', async () => {
    const { messagesV2 } = generateConversationHistory({
      threadId: '4',
      toolNames: ['weather', 'calculator'],
      messageCount: 3,
      toolFrequency: 1,
    });
    const filter = new ToolCallFilter({ exclude: ['weather'] });
    const messageList = new MessageList().add(messagesV2, 'memory');
    const result = (await filter.processInput({
      messages: messagesV2,
      messageList,
      abort,
    })) as MastraDBMessage[];

    // With messageCount: 3 and toolFrequency: 1:
    // i=0: user (message-0), assistant without tool (message-1)
    // i=1: user (message-2), assistant with weather tool (removed)
    // i=2: user (message-4), assistant with calculator tool (kept)
    // Result: 6 messages (weather tool message removed entirely since it has no other parts)
    expect(result.length).toBe(6);

    // Check that weather tool invocations are removed
    const weatherToolInvocations = result.flatMap(m => {
      if (typeof m.content === 'string') return [];
      if (!m.content?.parts) return [];
      return m.content.parts.filter(
        (p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'weather',
      );
    });
    expect(weatherToolInvocations.length).toBe(0);

    // Check that calculator tool invocations are kept
    const calculatorToolInvocations = result.flatMap(m => {
      if (typeof m.content === 'string') return [];
      if (!m.content?.parts) return [];
      return m.content.parts.filter(
        (p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'calculator',
      );
    });
    expect(calculatorToolInvocations.length).toBeGreaterThan(0);
  });

  it('should keep all messages when exclude list is empty', async () => {
    const { messagesV2 } = generateConversationHistory({
      threadId: '5',
      toolNames: ['weather', 'calculator'],
    });

    const filter = new ToolCallFilter({ exclude: [] });
    const messageList = new MessageList().add(messagesV2, 'memory');
    const result = (await filter.processInput({
      messages: messagesV2,
      messageList,
      abort,
    })) as MastraDBMessage[];

    // Should keep all messages
    expect(result.length).toBe(messagesV2.length);
  });
});
