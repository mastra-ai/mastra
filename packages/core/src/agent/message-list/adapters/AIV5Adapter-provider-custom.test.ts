import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter provider custom parts', () => {
  const providerMetadata = {
    openai: {
      type: 'compaction',
      itemId: 'cmp_123',
      encryptedContent: 'opaque-encrypted-state',
    },
  };

  it('preserves provider metadata when converting UI messages to stored messages', () => {
    const storedMessage = {
      id: 'assistant-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'custom',
            kind: 'openai.compaction',
            providerMetadata,
          },
        ],
      },
    } satisfies MastraDBMessage;
    const uiMessage = AIV5Adapter.toUIMessage(storedMessage);
    const message = AIV5Adapter.fromUIMessage(uiMessage);

    expect(message.content.parts).toEqual([
      {
        type: 'custom',
        kind: 'openai.compaction',
        providerMetadata,
      },
    ]);
    expect(AIV5Adapter.toUIMessage(message).parts).toEqual(message.content.parts);
  });

  it.each(['providerMetadata', 'providerOptions'] as const)(
    'preserves provider custom parts from non-streamed model output using %s',
    metadataKey => {
      const modelMessage = {
        role: 'assistant' as const,
        content: [
          {
            type: 'custom' as const,
            kind: 'openai.compaction',
            [metadataKey]: providerMetadata,
          },
        ],
      };
      const message = AIV5Adapter.fromModelMessage(modelMessage);

      expect(message.content.parts).toEqual([
        {
          type: 'custom',
          kind: 'openai.compaction',
          providerMetadata,
        },
      ]);
      expect(message.content.content).toBeUndefined();
    },
  );

  it('prefers provider metadata when custom model output contains both metadata representations', () => {
    const message = AIV5Adapter.fromModelMessage({
      role: 'assistant',
      content: [
        {
          type: 'custom',
          kind: 'openai.compaction',
          providerMetadata,
          providerOptions: { openai: { encryptedContent: 'stale-state' } },
        },
      ],
      // AI SDK v5's ModelMessage type predates provider custom parts.
    } as unknown as Parameters<typeof AIV5Adapter.fromModelMessage>[0]);

    expect(message.content.parts).toEqual([
      {
        type: 'custom',
        kind: 'openai.compaction',
        providerMetadata,
      },
    ]);
  });

  it('ignores malformed provider custom parts from non-streamed model output', () => {
    const message = AIV5Adapter.fromModelMessage({
      role: 'assistant',
      content: [{ type: 'custom', kind: '' }],
    });

    expect(message.content.parts).toEqual([]);
  });
});
