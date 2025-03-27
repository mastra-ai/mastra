import type { CoreMessage, MessageType } from '@mastra/core';
import { describe, it, expect } from 'vitest';
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
});

describe('ToolCallFilter', () => {
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

