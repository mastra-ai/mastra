import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { CLIENT_MESSAGE_ID_KEY } from '@mastra/react';
import { describe, expect, it } from 'vitest';

import { buildThreadRailTurns } from './thread-rail-turns';

const userMessage = (id: string, text: string, metadata?: MastraDBMessage['content']['metadata']): MastraDBMessage => ({
  id,
  role: 'user',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }], metadata },
});

const assistantMessage = (id: string, text: string): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

const signalMessage = (id: string, signalType: string, text: string): MastraDBMessage => ({
  id,
  role: 'signal',
  type: signalType,
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }], metadata: { signal: { type: signalType } } },
});

describe('buildThreadRailTurns', () => {
  it('creates one turn per displayable user message with stable client keys and assistant previews', () => {
    const turns = buildThreadRailTurns([
      userMessage('server-user-1', 'first question', { [CLIENT_MESSAGE_ID_KEY]: 'client-user-1' }),
      assistantMessage('assistant-1', 'first answer'),
      userMessage('server-user-2', 'second question'),
    ]);

    expect(turns).toEqual([
      {
        key: 'client-user-1',
        messageId: 'server-user-1',
        prompt: 'first question',
        reply: 'first answer',
        files: [],
        hiddenFileCount: 0,
      },
      {
        key: 'server-user-2',
        messageId: 'server-user-2',
        prompt: 'second question',
        reply: undefined,
        files: [],
        hiddenFileCount: 0,
      },
    ]);
  });

  it('includes persisted user signals and skips non-user signals', () => {
    const turns = buildThreadRailTurns([
      signalMessage('signal-user', 'user-message', 'reloaded user turn'),
      signalMessage('signal-state', 'state', 'reactive state'),
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0]?.messageId).toBe('signal-user');
    expect(turns[0]?.prompt).toBe('reloaded user turn');
  });

  it('summarizes up to two file labels and reports overflow', () => {
    const turns = buildThreadRailTurns([
      {
        ...userMessage('files', ''),
        content: {
          format: 2,
          parts: [
            { type: 'file', filename: 'plan.md', data: 'https://files.example.com/plan.md' },
            { type: 'file', filename: 'trace.json', data: 'https://files.example.com/trace.json' },
            { type: 'image', data: 'data:image/png;base64,abc' },
          ],
        },
      },
    ]);

    expect(turns[0]).toMatchObject({
      prompt: 'Attached file',
      files: ['plan.md', 'trace.json'],
      hiddenFileCount: 1,
    });
  });
});
