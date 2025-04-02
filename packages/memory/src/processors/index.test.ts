import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import type { CoreMessage, MessageType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { generateConversationHistory } from '../../integration-tests/src/test-utils';
import { TokenLimiter, ToolCallFilter } from './index';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

describe('TokenLimiter', () => {
  it('should limit messages to the specified token count', () => {
    // Create messages with predictable token counts (approximately 25 tokens each)
    const { messages } = generateConversationHistory({
      threadId: '1',
      messageCount: 5,
      toolNames: [],
      toolFrequency: 0,
    });

    const limiter = new TokenLimiter(200);
    // @ts-ignore
    const result = limiter.process(messages);

    // Should prioritize newest messages (higher ids)
    expect(result.length).toBe(2);
    expect((result[0] as MessageType).id).toBe('message-8');
    expect((result[1] as MessageType).id).toBe('message-9');
  });

  it('should handle empty messages array', () => {
    const limiter = new TokenLimiter(1000);
    const result = limiter.process([]);
    expect(result).toEqual([]);
  });

  it('should use different encodings based on configuration', () => {
    const { messages } = generateConversationHistory({
      threadId: '6',
      messageCount: 1,
      toolNames: [],
      toolFrequency: 0,
    });

    // Create limiters with different encoding settings
    const defaultLimiter = new TokenLimiter(1000);
    const customLimiter = new TokenLimiter({
      limit: 1000,
      encoding: cl100k_base,
    });

    // All should process messages successfully but potentially with different token counts
    const defaultResult = defaultLimiter.process(messages as CoreMessage[]);
    const customResult = customLimiter.process(messages as CoreMessage[]);

    // Each should return the same messages but with potentially different token counts
    expect(defaultResult.length).toBe(messages.length);
    expect(customResult.length).toBe(messages.length);
  });

  function estimateTokens(messages: MessageType[]) {
    // Create a TokenLimiter just for counting tokens
    const testLimiter = new TokenLimiter(Infinity);

    let estimatedTokens = testLimiter.TOKENS_PER_CONVERSATION;

    // Count tokens for each message including all overheads
    for (const message of messages) {
      // Base token count from the countTokens method
      estimatedTokens += testLimiter.countTokens(message as CoreMessage);
    }

    return estimatedTokens;
  }

  function percentDifference(a: number, b: number) {
    const difference = Number(((Math.abs(a - b) / b) * 100).toFixed(2));
    console.log(`${a} and ${b} are ${difference}% different`);
    return difference;
  }

  async function expectTokenEstimate(config: Parameters<typeof generateConversationHistory>[0], agent: Agent) {
    const { messages, counts } = generateConversationHistory(config);

    const estimate = estimateTokens(messages);
    const used = (await agent.generate(messages.slice(0, -1) as CoreMessage[])).usage.totalTokens;

    console.log(`Estimated ${estimate} tokens, used ${used} tokens.\n`, counts);

    // Check if within 2% margin
    expect(percentDifference(estimate, used)).toBeLessThanOrEqual(2);
  }

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

  const agent = new Agent({
    name: 'token estimate agent',
    model: openai('gpt-4o-mini'),
    instructions: ``,
    tools: { calculatorTool },
  });

  describe.concurrent(`98% accuracy`, () => {
    it(`20 messages, no tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 10,
          toolFrequency: 0,
          threadId: '2',
        },
        agent,
      );
    });

    it(`60 messages, no tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 30,
          toolFrequency: 0,
          threadId: '3',
        },
        agent,
      );
    });

    it(`4 messages, 0 tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 2,
          toolFrequency: 0,
          threadId: '3',
        },
        agent,
      );
    });

    it(`20 messages, 2 tool messages`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 10,
          toolFrequency: 5,
          threadId: '3',
        },
        agent,
      );
    });

    it(`40 messages, 6 tool messages`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 20,
          toolFrequency: 5,
          threadId: '4',
        },
        agent,
      );
    });

    it(`100 messages, 24 tool messages`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 50,
          toolFrequency: 4,
          threadId: '5',
        },
        agent,
      );
    });

    it(`101 messages, 49 tool calls`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 50,
          toolFrequency: 1,
          threadId: '5',
        },
        agent,
      );
    });
  });
});

describe.concurrent('ToolCallFilter', () => {
  it('should exclude all tool calls when created with no arguments', () => {
    const { messages } = generateConversationHistory({
      threadId: '3',
      toolNames: ['weather', 'calculator', 'search'],
      messageCount: 1,
    });
    const filter = new ToolCallFilter();
    const result = filter.process(messages as CoreMessage[]) as MessageType[];

    // Should only keep the text message and assistant res
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('message-0');
  });

  it('should exclude specific tool calls by name', () => {
    const { messages } = generateConversationHistory({
      threadId: '4',
      toolNames: ['weather', 'calculator'],
      messageCount: 2,
    });
    const filter = new ToolCallFilter({ exclude: ['weather'] });
    const result = filter.process(messages as CoreMessage[]) as MessageType[];

    // Should keep text message, assistant reply, calculator tool call, and calculator result
    expect(result.length).toBe(4);
    expect(result[0].id).toBe('message-0');
    expect(result[1].id).toBe('message-1');
    expect(result[2].id).toBe('message-2');
    expect(result[3].id).toBe('message-3');
  });

  it('should keep all messages when exclude list is empty', () => {
    const { messages } = generateConversationHistory({
      threadId: '5',
      toolNames: ['weather', 'calculator'],
    });

    const filter = new ToolCallFilter({ exclude: [] });
    const result = filter.process(messages as CoreMessage[]);

    // Should keep all messages
    expect(result.length).toBe(messages.length);
  });
});
