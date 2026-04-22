import { describe, expect, it } from 'vitest';

import { sanitizeV5UIMessages } from './output-converter';
import type { UIMessage } from '@internal/ai-sdk-v5';

/**
 * Reproduces the "Duplicate item found with id rs_..." error from #15617.
 *
 * When Observational Memory's async buffering is enabled, reasoning parts with
 * the same OpenAI itemId (rs_*) can appear in multiple assistant messages loaded
 * from memory. The AI SDK converts each into an item_reference, causing OpenAI
 * to reject the request with a "Duplicate item found" error.
 */
describe('sanitizeV5UIMessages — OpenAI itemId deduplication (#15617)', () => {
  it('should deduplicate reasoning parts with the same rs_* itemId within a single message', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            reasoning: 'first reasoning',
            details: [{ type: 'text', text: 'thinking...' }],
            providerMetadata: { openai: { itemId: 'rs_001' } },
          } as any,
          {
            type: 'text',
            text: 'Hello',
          },
          {
            type: 'reasoning',
            reasoning: 'duplicate reasoning',
            details: [{ type: 'text', text: 'thinking again...' }],
            providerMetadata: { openai: { itemId: 'rs_001' } },
          } as any,
        ],
        createdAt: new Date(),
      },
    ];

    const result = sanitizeV5UIMessages(messages);
    expect(result).toHaveLength(1);

    const reasoningParts = result[0]!.parts.filter(p => p.type === 'reasoning');
    expect(reasoningParts).toHaveLength(1);
  });

  it('should deduplicate reasoning parts with the same rs_* itemId across messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            reasoning: '',
            details: [{ type: 'text', text: '' }],
            providerMetadata: { openai: { itemId: 'rs_abc123' } },
          } as any,
          {
            type: 'text',
            text: 'Step 1 result',
            providerMetadata: { openai: { itemId: 'msg_001' } },
          },
        ],
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            reasoning: '',
            details: [{ type: 'text', text: '' }],
            providerMetadata: { openai: { itemId: 'rs_abc123' } },
          } as any,
          {
            type: 'text',
            text: 'Step 2 result',
            providerMetadata: { openai: { itemId: 'msg_002' } },
          },
        ],
        createdAt: new Date(),
      },
    ];

    const result = sanitizeV5UIMessages(messages);

    // Both messages should still exist
    expect(result).toHaveLength(2);

    // First message keeps reasoning
    const msg1Reasoning = result[0]!.parts.filter(p => p.type === 'reasoning');
    expect(msg1Reasoning).toHaveLength(1);

    // Second message should have reasoning removed (duplicate rs_abc123)
    const msg2Reasoning = result[1]!.parts.filter(p => p.type === 'reasoning');
    expect(msg2Reasoning).toHaveLength(0);

    // Text parts with different itemIds should be preserved
    const msg1Text = result[0]!.parts.filter(p => p.type === 'text');
    const msg2Text = result[1]!.parts.filter(p => p.type === 'text');
    expect(msg1Text).toHaveLength(1);
    expect(msg2Text).toHaveLength(1);
  });

  it('should still merge text parts with the same itemId within a message', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello ',
            providerMetadata: { openai: { itemId: 'msg_001' } },
          },
          {
            type: 'text',
            text: 'world',
            providerMetadata: { openai: { itemId: 'msg_001' } },
          },
        ],
        createdAt: new Date(),
      },
    ];

    const result = sanitizeV5UIMessages(messages);
    expect(result).toHaveLength(1);

    const textParts = result[0]!.parts.filter(p => p.type === 'text');
    expect(textParts).toHaveLength(1);
    expect((textParts[0] as any).text).toBe('Hello world');
  });

  it('should drop text parts with duplicate itemIds across messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello',
            providerMetadata: { openai: { itemId: 'msg_001' } },
          },
        ],
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello duplicate',
            providerMetadata: { openai: { itemId: 'msg_001' } },
          },
        ],
        createdAt: new Date(),
      },
    ];

    const result = sanitizeV5UIMessages(messages);
    // Second message should be filtered out entirely (empty after dedup)
    expect(result).toHaveLength(1);
    expect((result[0]!.parts[0] as any).text).toBe('Hello');
  });

  it('should preserve parts without OpenAI itemIds', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'no itemId here' },
          {
            type: 'reasoning',
            reasoning: 'also no itemId',
            details: [{ type: 'text', text: 'thinking' }],
          } as any,
        ],
        createdAt: new Date(),
      },
    ];

    const result = sanitizeV5UIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);
  });
});
