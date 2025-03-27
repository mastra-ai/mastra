import { describe, it, expect, vi } from 'vitest';
import { TokenLimiter, ToolCallFilter } from './index';
import type { CoreMessage } from '@mastra/core';

// Mock message type for testing with id field
type MockMessage = CoreMessage & { id: string };

describe('TokenLimiter', () => {
  const createMessage = (id: string, content: string): MockMessage => ({
    id,
    role: 'user',
    content,
    createdAt: new Date(Date.now() - parseInt(id) * 1000), // older ids have earlier timestamps
  } as MockMessage);

  it('should limit messages to the specified token count', () => {
    // Create messages with predictable token counts (approximately 25 tokens each)
    const messages = [
      createMessage('1', 'A '.repeat(100)), // ~25 tokens
      createMessage('2', 'B '.repeat(100)), // ~25 tokens
      createMessage('3', 'C '.repeat(100)), // ~25 tokens
      createMessage('4', 'D '.repeat(100)), // ~25 tokens
      createMessage('5', 'E '.repeat(100)), // ~25 tokens
    ];

    const limiter = new TokenLimiter(60); // Should allow approximately 2 messages
    const result = limiter.process(messages) as MockMessage[];

    // Should prioritize newest messages (higher ids)
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('5');
  });

  it('should handle empty messages array', () => {
    const limiter = new TokenLimiter(1000);
    const result = limiter.process([]);
    expect(result).toEqual([]);
  });

  it('should handle complex message structures', () => {
    // Create messages with different content types
    const messages = [
      createMessage('1', 'Simple text message'),
      {
        id: '2',
        role: 'assistant',
        content: [
          { type: 'text', text: 'This is a structured message' },
          { 
            type: 'tool-call',
            id: 'tool-1',
            name: 'calculator',
            args: { expression: '2+2' }
          }
        ],
        createdAt: new Date()
      } as unknown as MockMessage,
      {
        id: '3',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Here is a tool result' },
          { 
            type: 'tool-result',
            toolCallId: 'tool-1',
            result: { value: 4 }
          }
        ],
        createdAt: new Date()
      } as unknown as MockMessage
    ];

    const limiter = new TokenLimiter(100); 
    const result = limiter.process(messages) as MockMessage[];

    // All messages should fit in our limit
    expect(result.length).toBe(3);
    expect(result.map(m => m.id)).toEqual(['1', '2', '3']);
  });
});

describe('ToolCallFilter', () => {
  // Create test messages with tool calls
  const createToolCallMessage = (id: string, toolName: string): MockMessage => ({
    id,
    role: 'assistant',
    content: [
      { type: 'text', text: 'Here is the result:' },
      { 
        type: 'tool-call', 
        id: `tool-${id}`, 
        name: toolName,
        args: {} 
      }
    ],
    createdAt: new Date(),
  } as unknown as MockMessage);

  const createToolResultMessage = (id: string, toolCallId: string): MockMessage => ({
    id,
    role: 'assistant',
    content: [
      { type: 'text', text: 'Tool executed:' },
      { 
        type: 'tool-result', 
        toolCallId,
        result: { success: true } 
      }
    ],
    createdAt: new Date(),
  } as unknown as MockMessage);

  const textMessage: MockMessage = {
    id: 'text-1',
    role: 'user',
    content: 'Hello world',
    createdAt: new Date(),
  } as MockMessage;

  it('should exclude all tool calls when created with no arguments', () => {
    const messages = [
      textMessage,
      createToolCallMessage('1', 'weather'),
      createToolResultMessage('2', 'tool-1'),
    ];

    const filter = new ToolCallFilter();
    const result = filter.process(messages) as MockMessage[];

    // Should only keep the text message
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('text-1');
  });

  it('should exclude specific tool calls by name', () => {
    const messages = [
      textMessage,
      createToolCallMessage('1', 'weather'),
      createToolCallMessage('2', 'calculator'),
      createToolResultMessage('3', 'tool-1'), // weather result
      createToolResultMessage('4', 'tool-2'), // calculator result
    ];

    const filter = new ToolCallFilter({ exclude: ['weather'] });
    const result = filter.process(messages) as MockMessage[];

    // Should keep text message, calculator tool call, and calculator result
    expect(result.length).toBe(3);
    expect(result[0].id).toBe('text-1');
    expect(result[1].id).toBe('2'); // calculator tool call
    expect(result[2].id).toBe('4'); // calculator result
  });

  it('should keep all messages when exclude list is empty', () => {
    const messages = [
      textMessage,
      createToolCallMessage('1', 'weather'),
    ];

    const filter = new ToolCallFilter({ exclude: [] });
    const result = filter.process(messages);

    // Should keep all messages
    expect(result.length).toBe(messages.length);
  });

  it('should remove messages that are left with empty content after filtering', () => {
    const onlyToolCallMessage: MockMessage = {
      id: 'only-tool',
      role: 'assistant',
      content: [{ 
        type: 'tool-call', 
        id: 'tool-only', 
        name: 'weather',
        args: {} 
      }],
      createdAt: new Date(),
    } as unknown as MockMessage;

    const messages = [textMessage, onlyToolCallMessage];

    const filter = new ToolCallFilter({ exclude: ['weather'] });
    const result = filter.process(messages) as MockMessage[];

    // Should remove the message that only had a tool call
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('text-1');
  });
}); 