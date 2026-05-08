import type { UIMessage } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter part createdAt', () => {
  it('preserves part createdAt from db to ui', () => {
    const uiMessage = AIV5Adapter.toUIMessage({
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date('2026-04-06T00:00:00.000Z'),
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'hello', createdAt: 111 },
          {
            type: 'tool-invocation',
            createdAt: 222,
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'weather',
              args: { city: 'SF' },
              result: { temp: 65 },
            },
          },
        ],
      },
    });

    expect(uiMessage.parts[0]).toMatchObject({
      type: 'text',
      text: 'hello',
      providerMetadata: { mastra: { createdAt: 111 } },
    });
    expect(uiMessage.parts[1]).toMatchObject({
      type: 'tool-weather',
      callProviderMetadata: { mastra: { createdAt: 222 } },
    });
  });

  it('preserves part createdAt from ui to db', () => {
    const dbMessage = AIV5Adapter.fromUIMessage({
      id: 'msg-1',
      role: 'assistant',
      metadata: { createdAt: new Date('2026-04-06T00:00:00.000Z') },
      parts: [
        {
          type: 'text',
          text: 'hello',
          providerMetadata: { mastra: { createdAt: 333 } },
        },
        {
          type: 'tool-weather',
          toolCallId: 'call-1',
          state: 'output-available',
          input: { city: 'SF' },
          output: { temp: 65 },
          callProviderMetadata: { mastra: { createdAt: 444 } },
        },
      ],
    } as UIMessage);

    expect(dbMessage.content.parts[0]).toMatchObject({
      type: 'text',
      text: 'hello',
      createdAt: 333,
    });
    expect(dbMessage.content.parts[1]).toMatchObject({
      type: 'tool-invocation',
      createdAt: 444,
    });
  });
});
