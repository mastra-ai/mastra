import { describe, expect, it } from 'vitest';

import { buildMessagesFromChunks } from '../../../loop/workflows/agentic-execution/build-messages-from-chunks';
import { AIV5Adapter } from '../adapters/AIV5Adapter';
import type { MastraDBMessage } from '../state/types';
import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';

describe('provider custom message conversion', () => {
  it('restores persisted provider custom parts in stream order', () => {
    const providerMetadata = {
      openai: {
        type: 'compaction',
        itemId: 'cmp_123',
        encryptedContent: 'opaque-encrypted-state',
      },
    };
    const storedMessage = {
      id: 'assistant-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'before' },
          { type: 'custom', kind: 'openai.compaction', providerMetadata },
          { type: 'text', text: 'after' },
        ],
      },
    } satisfies MastraDBMessage;
    const messages = [AIV5Adapter.toUIMessage(storedMessage)];

    expect(aiV5UIMessagesToAIV5ModelMessages(messages, [], 'prompt')).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: 'before' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'custom',
            kind: 'openai.compaction',
            providerOptions: providerMetadata,
          },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'after' }] },
    ]);
  });

  it('round-trips streamed compaction state through stored messages into the next prompt', () => {
    const providerMetadata = {
      openai: {
        type: 'compaction',
        itemId: 'cmp_123',
        encryptedContent: 'opaque-encrypted-state',
      },
    };
    const [storedMessage] = buildMessagesFromChunks({
      chunks: [
        { type: 'text-start', payload: { id: 'text-1' } },
        { type: 'text-delta', payload: { id: 'text-1', text: 'before' } },
        { type: 'text-end', payload: { id: 'text-1' } },
        {
          type: 'custom',
          payload: { kind: 'openai.compaction', providerMetadata },
        },
      ],
      messageId: 'assistant-1',
    });

    expect(storedMessage).toBeDefined();
    const uiMessage = AIV5Adapter.toUIMessage(storedMessage!);

    expect(aiV5UIMessagesToAIV5ModelMessages([uiMessage], [], 'prompt')).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: 'before' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'custom',
            kind: 'openai.compaction',
            providerOptions: providerMetadata,
          },
        ],
      },
    ]);
  });

  it('omits malformed provider custom parts without dropping surrounding content', () => {
    const storedMessage = {
      id: 'assistant-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'before' },
          { type: 'custom', kind: '' },
          { type: 'text', text: 'after' },
        ],
      },
    } satisfies MastraDBMessage;
    const messages = [AIV5Adapter.toUIMessage(storedMessage)];

    expect(aiV5UIMessagesToAIV5ModelMessages(messages, [], 'prompt')).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'before' },
          { type: 'text', text: 'after' },
        ],
      },
    ]);
  });

  it('continues to omit ordinary data parts from provider prompts', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'visible' },
          { type: 'data-progress', data: { percent: 50 } },
        ],
      },
    ] satisfies AIV5Type.UIMessage[];

    expect(aiV5UIMessagesToAIV5ModelMessages(messages, [], 'prompt')).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: 'visible' }] },
    ]);
  });
});
