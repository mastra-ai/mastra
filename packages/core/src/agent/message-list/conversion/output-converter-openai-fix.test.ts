import { describe, it, expect } from 'vitest';
import type { AIV5Type } from '../types';
import { sanitizeV5UIMessages } from './output-converter';

describe('sanitizeV5UIMessages - OpenAI duplicate item fix', () => {
  it('should strip OpenAI provider metadata with item IDs when filterIncompleteToolCalls is true', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello, how can I help you?',
            providerMetadata: {
              openai: {
                id: 'msg_0a9f55fbab18fe4e0069b78644c718819c8dea51fff043aaaa',
              },
            },
          },
        ],
        metadata: {},
      },
    ];

    const result = sanitizeV5UIMessages(messages, true);

    expect(result).toHaveLength(1);
    expect(result[0]?.parts[0]?.type).toBe('text');
    expect((result[0]?.parts[0] as any).providerMetadata?.openai).toBeUndefined();
  });

  it('should strip OpenAI provider metadata from tool parts with call IDs', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-toolName',
            toolCallId: 'call_123',
            toolName: 'toolName',
            state: 'output-available',
            input: { query: 'test' },
            output: { result: 'success' },
            callProviderMetadata: {
              openai: {
                callId: 'fc_1234567890',
              },
            },
          },
        ],
        metadata: {},
      },
    ];

    const result = sanitizeV5UIMessages(messages, true);

    expect(result).toHaveLength(1);
    expect((result[0]?.parts[0] as any).callProviderMetadata?.openai).toBeUndefined();
  });

  it('should NOT strip OpenAI provider metadata when filterIncompleteToolCalls is false', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-3',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello',
            providerMetadata: {
              openai: {
                id: 'msg_123',
              },
            },
          },
        ],
        metadata: {},
      },
    ];

    const result = sanitizeV5UIMessages(messages, false);

    expect(result).toHaveLength(1);
    expect((result[0]?.parts[0] as any).providerMetadata?.openai).toBeDefined();
  });

  it('should preserve non-OpenAI provider metadata', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-4',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello',
            providerMetadata: {
              anthropic: {
                cacheControl: 'ephemeral',
              },
            },
          },
        ],
        metadata: {},
      },
    ];

    const result = sanitizeV5UIMessages(messages, true);

    expect(result).toHaveLength(1);
    expect((result[0]?.parts[0] as any).providerMetadata?.anthropic).toBeDefined();
    expect((result[0]?.parts[0] as any).providerMetadata?.openai).toBeUndefined();
  });

  it('should strip OpenAI provider metadata from message-level metadata', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-5',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello',
          },
        ],
        metadata: {
          providerMetadata: {
            openai: {
              id: 'msg_1234567890',
              previousResponseId: 'resp_123',
            },
          },
        },
      },
    ];

    const result = sanitizeV5UIMessages(messages, true);

    expect(result).toHaveLength(1);
    expect(result[0]?.metadata?.providerMetadata).toBeUndefined();
  });

  it('should preserve non-OpenAI provider metadata in message-level metadata', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-6',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello',
          },
        ],
        metadata: {
          providerMetadata: {
            anthropic: {
              cacheControl: 'ephemeral',
            },
          },
        },
      },
    ];

    const result = sanitizeV5UIMessages(messages, true);

    expect(result).toHaveLength(1);
    expect((result[0]?.metadata?.providerMetadata as any)?.anthropic).toBeDefined();
  });

  it('should strip OpenAI metadata from both parts and message metadata', () => {
    const messages: AIV5Type.UIMessage[] = [
      {
        id: 'msg-test-7',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello',
            providerMetadata: {
              openai: {
                id: 'msg_123',
              },
            },
          },
        ],
        metadata: {
          providerMetadata: {
            openai: {
              id: 'msg_456',
            },
          },
        },
      },
    ];

    const result = sanitizeV5UIMessages(messages, true);

    expect(result).toHaveLength(1);
    expect((result[0]?.parts[0] as any).providerMetadata?.openai).toBeUndefined();
    expect(result[0]?.metadata?.providerMetadata).toBeUndefined();
  });
});
