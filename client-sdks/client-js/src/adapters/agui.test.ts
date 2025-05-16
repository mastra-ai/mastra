import type { Message } from '@ag-ui/client';
import { describe, it, expect } from 'vitest';
import { generateUUID, convertMessagesToMastraMessages } from './agui';

describe('generateUUID', () => {
  it('should generate a valid UUID v4 string', () => {
    const uuid = generateUUID();
    // Check UUID format (8-4-4-4-12 hex digits)
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    // All UUIDs should be unique
    expect(uuids.size).toBe(100);
  });
});

describe('convertMessagesToMastraMessages', () => {
  it('should convert user messages correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello, world!',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'user',
        content: 'Hello, world!',
      },
    ]);
  });

  it('should convert assistant messages correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello, I am an assistant',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, I am an assistant' }],
      },
    ]);
  });

  it('should convert assistant messages with tool calls correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: undefined,
        toolCalls: [
          {
            id: 'tool-call-1',
            type: 'function',
            function: {
              name: 'getWeather',
              arguments: '{"location":"San Francisco"}',
            },
          },
        ],
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool-call-1',
            toolName: 'getWeather',
            args: { location: 'San Francisco' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool-call-1',
            toolName: 'getWeather',
            result: { location: 'San Francisco' },
          },
        ],
      },
    ]);
  });

  it('should convert tool messages correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'tool',
        toolCallId: 'tool-call-1',
        content: '{"temperature":72,"unit":"F"}',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool-call-1',
            toolName: 'unknown',
            result: '{"temperature":72,"unit":"F"}',
          },
        ],
      },
    ]);
  });

  it('should convert a complex conversation correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: "What's the weather in San Francisco?",
      },
      {
        id: '2',
        role: 'assistant',
        content: undefined,
        toolCalls: [
          {
            id: 'tool-call-1',
            type: 'function',
            function: {
              name: 'getWeather',
              arguments: '{"location":"San Francisco"}',
            },
          },
        ],
      },
      {
        id: '4',
        role: 'assistant',
        content: 'The weather in San Francisco is 72°F.',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');
    expect(result[2].content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'tool-call-1',
        toolName: 'getWeather',
        result: { location: 'San Francisco' },
      },
    ]);
    expect(result[3].role).toBe('assistant');
  });
});
