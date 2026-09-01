import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import { buildThreadRailTurns, getClientMessageKey, startsUserTurn } from './thread-rail-turns';

type Parts = MastraDBMessage['content']['parts'];

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

const withParts = (id: string, parts: unknown[]): MastraDBMessage => ({
  ...userMessage(id, ''),
  content: { format: 2, parts: parts as Parts },
});

const promptOf = (message: MastraDBMessage) => buildThreadRailTurns([message])[0]?.prompt;
const filesOf = (parts: unknown[]) => buildThreadRailTurns([withParts('files', parts)])[0]?.files;

describe('getClientMessageKey', () => {
  it('prefers the client message id so optimistic rows keep their identity', () => {
    expect(getClientMessageKey(userMessage('server-1', 'q', { clientMessageId: 'client-1' }))).toBe('client-1');
  });

  it.each([
    ['no metadata', undefined],
    ['metadata without the key', { other: 'x' }],
    ['an empty client message id', { clientMessageId: '' }],
    ['a non-string client message id', { clientMessageId: 42 }],
    ['array metadata', [] as unknown as MastraDBMessage['content']['metadata']],
  ])('falls back to the server id given %s', (_, metadata) => {
    expect(getClientMessageKey(userMessage('server-1', 'q', metadata as never))).toBe('server-1');
  });
});

describe('startsUserTurn', () => {
  it('opens a turn on a user message', () => {
    expect(startsUserTurn(userMessage('u', 'q'))).toBe(true);
  });

  it('does not open a turn on an assistant message', () => {
    expect(startsUserTurn(assistantMessage('a', 'answer'))).toBe(false);
  });

  it.each([
    ['user', true],
    ['user-message', true],
    ['state', false],
  ])('treats a %s signal as opening a turn: %s', (signalType, expected) => {
    expect(startsUserTurn(signalMessage('s', signalType, 'text'))).toBe(expected);
  });

  it('falls back to the message type when the signal metadata has no type', () => {
    const message = {
      ...signalMessage('s', 'user', 'text'),
      content: { format: 2, parts: [{ type: 'text', text: 'text' }], metadata: { signal: { kind: 'user' } } },
    } as MastraDBMessage;

    expect(startsUserTurn(message)).toBe(true);
  });
});

describe('buildThreadRailTurns', () => {
  it('creates one turn per displayable user message with stable client keys and assistant previews', () => {
    const turns = buildThreadRailTurns([
      userMessage('server-user-1', 'first question', { clientMessageId: 'client-user-1' }),
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

  it('returns no turns for a thread that never had a user message', () => {
    expect(buildThreadRailTurns([assistantMessage('a', 'answer')])).toEqual([]);
  });

  describe('reply preview', () => {
    it('skips assistant messages that carry no text', () => {
      const turns = buildThreadRailTurns([
        userMessage('u', 'q'),
        assistantMessage('a-empty', '   '),
        assistantMessage('a-real', 'the answer'),
      ]);

      expect(turns[0]?.reply).toBe('the answer');
    });

    it('stops at the next user turn rather than borrowing its answer', () => {
      const turns = buildThreadRailTurns([
        userMessage('u1', 'first'),
        userMessage('u2', 'second'),
        assistantMessage('a', 'answer to the second'),
      ]);

      expect(turns[0]?.reply).toBeUndefined();
      expect(turns[1]?.reply).toBe('answer to the second');
    });

    it('looks past messages that are neither assistant nor a turn start', () => {
      const turns = buildThreadRailTurns([
        userMessage('u', 'q'),
        signalMessage('s', 'state', 'reactive state'),
        assistantMessage('a', 'the answer'),
      ]);

      expect(turns[0]?.reply).toBe('the answer');
    });
  });

  describe('prompt summary', () => {
    it('collapses runs of whitespace onto one line', () => {
      expect(promptOf(userMessage('u', '  first\n\n  second   line \t'))).toBe('first second line');
    });

    it('leaves a summary at the limit untouched and truncates past it', () => {
      expect(promptOf(userMessage('u', 'b'.repeat(120)))).toBe('b'.repeat(120));
      expect(promptOf(userMessage('u', 'a'.repeat(121)))).toBe(`${'a'.repeat(117)}...`);
    });

    it('does not leave a dangling space before the ellipsis', () => {
      expect(promptOf(userMessage('u', `${'x'.repeat(116)} ${'y'.repeat(20)}`))).toBe(`${'x'.repeat(116)}...`);
    });

    it('falls back to a placeholder when there is no text', () => {
      expect(promptOf(userMessage('u', '   '))).toBe('User message');
      expect(buildThreadRailTurns([withParts('u', [{ type: 'file', filename: 'plan.md' }])])[0]?.prompt).toBe(
        'Attached file',
      );
    });
  });

  describe('file labels', () => {
    it('summarizes up to two file labels and reports overflow', () => {
      const turns = buildThreadRailTurns([
        withParts('files', [
          { type: 'file', filename: 'plan.md', data: 'https://files.example.com/plan.md' },
          { type: 'file', filename: 'trace.json', data: 'https://files.example.com/trace.json' },
          { type: 'image', data: 'data:image/png;base64,abc' },
        ]),
      ]);

      expect(turns[0]).toMatchObject({
        prompt: 'Attached file',
        files: ['plan.md', 'trace.json'],
        hiddenFileCount: 1,
      });
    });

    it('ignores parts that are neither a file nor an image', () => {
      expect(filesOf([{ type: 'text', text: 'hello' }, { type: 'file', filename: 'plan.md' }, 'not-a-record'])).toEqual(
        ['plan.md'],
      );
    });

    it('prefers an explicit filename, then a name, then the source path', () => {
      expect(filesOf([{ type: 'file', filename: 'plan.md', name: 'other.md', url: 'https://x.dev/third.md' }])).toEqual(
        ['plan.md'],
      );
      expect(filesOf([{ type: 'file', filename: '   ', name: 'other.md' }])).toEqual(['other.md']);
      expect(filesOf([{ type: 'file', url: 'https://x.dev/docs/third.md' }])).toEqual(['third.md']);
    });

    it.each([
      ['a URL path', 'https://files.example.com/a/b/plan.md', 'plan.md'],
      ['a URL with no path', 'https://files.example.com', 'files.example.com'],
      ['a URL with a trailing slash', 'https://files.example.com/', 'files.example.com'],
      ['a relative path with a query string', 'uploads/report.pdf?token=1', 'report.pdf'],
      ['a relative path with a fragment', '/uploads/report.pdf#page=2', 'report.pdf'],
    ])('reads the label from %s', (_, source, expected) => {
      expect(filesOf([{ type: 'file', url: source }])).toEqual([expected]);
    });

    it.each([
      ['an image part', { type: 'image', data: 'data:image/png;base64,abc' }, 'Image'],
      ['an image mime type', { type: 'file', mimeType: 'image/png', url: 'data:image/png;base64,abc' }, 'Image'],
      ['a pdf', { type: 'file', mimeType: 'application/pdf', url: 'data:application/pdf;base64,abc' }, 'PDF'],
      ['a video', { type: 'file', mediaType: 'video/mp4', url: 'data:video/mp4;base64,abc' }, 'Video'],
      ['an audio file', { type: 'file', mediaType: 'audio/mpeg', url: 'data:audio/mpeg;base64,abc' }, 'Audio'],
      [
        'an unknown type',
        { type: 'file', mediaType: 'application/zip', url: 'data:application/zip;base64,abc' },
        'File',
      ],
      ['a part with no source at all', { type: 'file' }, 'File'],
    ])('falls back to a generic label for %s', (_, part, expected) => {
      expect(filesOf([part])).toEqual([expected]);
    });
  });

  describe('prompt text', () => {
    it('joins several text parts as separate lines', () => {
      expect(
        promptOf(
          withParts('u', [
            { type: 'text', text: 'first' },
            { type: 'text', text: 'second' },
          ]),
        ),
      ).toBe('first second');
    });

    it('reads text only from text parts that carry a string', () => {
      const message = withParts('u', [
        { type: 'text', text: 'kept' },
        // A non-text part is not prompt text even when it has its own `text`.
        { type: 'image', text: 'alt caption', url: 'https://x.dev/a.png' },
        // A text part whose text is not a string is not prompt text either.
        { type: 'text', text: 42 },
        null,
      ]);

      expect(promptOf(message)).toBe('kept');
    });
  });

  describe('signal turns', () => {
    it('reads the signal type from metadata rather than the message type', () => {
      const message = {
        ...signalMessage('s', 'state', 'text'),
        content: { format: 2, parts: [{ type: 'text', text: 'text' }], metadata: { signal: { type: 'user' } } },
      } as MastraDBMessage;

      expect(startsUserTurn(message)).toBe(true);
    });

    it('falls back to the message type when there is no metadata at all', () => {
      const message = {
        ...signalMessage('s', 'user', 'text'),
        content: { format: 2, parts: [{ type: 'text', text: 'text' }] },
      } as MastraDBMessage;

      expect(startsUserTurn(message)).toBe(true);
    });
  });

  describe('file label sources', () => {
    it('tolerates a null part', () => {
      expect(filesOf([null, { type: 'file', filename: 'plan.md' }])).toEqual(['plan.md']);
    });

    it.each([['url'], ['image'], ['data']])('reads the label from a %s source', field => {
      expect(filesOf([{ type: 'file', [field]: 'https://x.dev/docs/plan.md' }])).toEqual(['plan.md']);
    });

    it('ignores the empty trailing segment of a path', () => {
      expect(filesOf([{ type: 'file', url: 'https://x.dev/docs/reports/' }])).toEqual(['reports']);
      expect(filesOf([{ type: 'file', url: '/docs/reports/?token=1' }])).toEqual(['reports']);
    });
  });
});
