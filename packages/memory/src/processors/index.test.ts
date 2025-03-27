import { openai } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import type { CoreMessage, MessageType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateConversationHistory } from '../../integration-tests/src/test-utils';
import { TokenLimiter, ToolCallFilter } from './index';

describe('TokenLimiter', () => {
  it('should limit messages to the specified token count', () => {
    // Create messages with predictable token counts (approximately 25 tokens each)
    const messages = generateConversationHistory({
      threadId: '1',
      messageCount: 5,
      toolNames: [],
      toolFrequency: 0,
    });

    const limiter = new TokenLimiter(200); // Should allow approximately 2 messages
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

  function estimateTokens(messages: MessageType[]) {
    const testLimiter = new TokenLimiter(Infinity);
    let estimatedTokens = 0;
    for (const message of messages) {
      estimatedTokens += testLimiter.countTokens(message as CoreMessage);
    }
    return estimatedTokens;
  }
  function percentDifference(a: number, b: number) {
    const difference = Math.round((Math.abs(a - b) / b) * 100);
    console.log(`${a} and ${b} are ${difference}% different`);
    return difference;
  }
  async function expectTokenEstimate(config: Parameters<typeof generateConversationHistory>[0], agent: Agent) {
    const messages = generateConversationHistory(config);

    const estimate = estimateTokens(messages);
    const used = (await agent.generate(messages.slice(0, -1) as CoreMessage[])).usage.totalTokens;

    console.log(`Estimated ${estimate} tokens, used ${used} tokens.`);

    // Check if within 10% margin
    expect(percentDifference(estimate, used)).toBeLessThanOrEqual(10);
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
  describe.concurrent(`90% accuracy`, () => {
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
    it(`4 messages, 2 tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 2,
          toolFrequency: 2,
          threadId: '3',
        },
        agent,
      );
    });
    it(`20 messages, 4 tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 10,
          toolFrequency: 5, // one tool every five turns
          threadId: '3',
        },
        agent,
      );
    });
    it(`40 messages, 8 tools`, async () => {
      await expectTokenEstimate(
        {
          messageCount: 20,
          toolFrequency: 5,
          threadId: '4',
        },
        agent,
      );
    });
  });
});

describe.concurrent('ToolCallFilter', () => {
  it('should exclude all tool calls when created with no arguments', () => {
    const messages = generateConversationHistory({
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
    const messages = generateConversationHistory({
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
    const messages = generateConversationHistory({
      threadId: '5',
      toolNames: ['weather', 'calculator'],
    });

    const filter = new ToolCallFilter({ exclude: [] });
    const result = filter.process(messages as CoreMessage[]);

    // Should keep all messages
    expect(result.length).toBe(messages.length);
  });
});
