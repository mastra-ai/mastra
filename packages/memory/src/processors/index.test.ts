import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { MastraMessageV1 } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import type { CoreMessage } from 'ai';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { generateConversationHistory } from '../../integration-tests/src/test-utils';
import { TokenLimiter, ToolCallFilter } from './index';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

describe('TokenLimiter', () => {
  it('should limit messages to the specified token count', () => {
    // Create messages with predictable token counts (approximately 25 tokens each)
    const { fakeCore } = generateConversationHistory({
      threadId: '1',
      messageCount: 5,
      toolNames: [],
      toolFrequency: 0,
    });

    const limiter = new TokenLimiter(200);
    const result = limiter.process(fakeCore) as MastraMessageV1[];

    // Should prioritize newest messages (higher ids)
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('message-8');
    expect(result[1].id).toBe('message-9');
  });

  it('should handle empty messages array', () => {
    const limiter = new TokenLimiter(1000);
    const result = limiter.process([]);
    expect(result).toEqual([]);
  });

  it('should use different encodings based on configuration', () => {
    const { fakeCore } = generateConversationHistory({
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

    // All should process fakeCore successfully but potentially with different token counts
    const defaultResult = defaultLimiter.process(fakeCore);
    const customResult = customLimiter.process(fakeCore);

    // Each should return the same fakeCore but with potentially different token counts
    expect(defaultResult.length).toBe(fakeCore.length);
    expect(customResult.length).toBe(fakeCore.length);
  });

  function estimateTokens(messages: MastraMessageV1[]) {
    // Create a TokenLimiter just for counting tokens
    const testLimiter = new TokenLimiter(Infinity);

    let estimatedTokens = testLimiter.TOKENS_PER_CONVERSATION;

    // Count tokens for each message including all overheads
    for (const message of messages) {
      // Base token count from the countTokens method
      estimatedTokens += testLimiter.countTokens(message as CoreMessage); // TODO: this is really actually a MastraMessageV1 but in previous implementations we were casting V1 to CoreMessage which is almost the same but not exactly
    }

    return Number(estimatedTokens.toFixed(2));
  }

  function percentDifference(a: number, b: number) {
    const difference = Number(((Math.abs(a - b) / b) * 100).toFixed(2));
    console.log(`${a} and ${b} are ${difference}% different`);
    return difference;
  }

  async function expectTokenEstimate(config: Parameters<typeof generateConversationHistory>[0], agent: Agent) {
    const { messages, fakeCore, counts } = generateConversationHistory(config);

    const estimate = estimateTokens(messages);
    const used = (await agent.generate(fakeCore)).usage.promptTokens;

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
      // Don't actually eval the expression. The model is dumb and sometimes passes "banana" as the expression because that's one of the sample tokens we're using in input messages lmao
      return `The result of ${expression} is 10`;
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

    it(`20 messages, 0 tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 10,
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

    it(
      `101 messages, 49 tool calls`,
      async () => {
        await expectTokenEstimate(
          {
            messageCount: 50,
            toolFrequency: 1,
            threadId: '5',
          },
          agent,
        );
      },
      {
        // for some reason AI SDK randomly returns 2x token count here
        retry: 3,
      },
    );
  });
});

describe.concurrent('ToolCallFilter', () => {
  it('should exclude all tool calls when created with no arguments', () => {
    const { fakeCore } = generateConversationHistory({
      threadId: '3',
      toolNames: ['weather', 'calculator', 'search'],
      messageCount: 1,
    });
    const filter = new ToolCallFilter();
    const result = filter.process(fakeCore) as MastraMessageV1[];

    // Should only keep the text message and assistant res
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('message-0');
  });

  it('should exclude specific tool calls by name', () => {
    const { fakeCore } = generateConversationHistory({
      threadId: '4',
      toolNames: ['weather', 'calculator'],
      messageCount: 2,
    });
    const filter = new ToolCallFilter({ exclude: ['weather'] });
    const result = filter.process(fakeCore) as MastraMessageV1[];

    // Should keep text message, assistant reply, calculator tool call, and calculator result
    expect(result.length).toBe(4);
    expect(result[0].id).toBe('message-0');
    expect(result[1].id).toBe('message-1');
    expect(result[2].id).toBe('message-2');
    expect(result[3].id).toBe('message-3');
  });

  it('should keep all messages when exclude list is empty', () => {
    const { fakeCore } = generateConversationHistory({
      threadId: '5',
      toolNames: ['weather', 'calculator'],
    });

    const filter = new ToolCallFilter({ exclude: [] });
    const result = filter.process(fakeCore);

    // Should keep all messages
    expect(result.length).toBe(fakeCore.length);
  });
});
