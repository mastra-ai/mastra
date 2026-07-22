import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { createInitialTranscript, initialTranscript, transcriptReducer } from '../transcript';

type MessageEntryFixture = {
  kind: 'message';
  message: { content: { parts: unknown[] } };
};

function dbMessage(id: string, role: MastraDBMessage['role'], parts: MastraMessagePart[]): MastraDBMessage {
  return { id, role, createdAt: new Date(), content: { format: 2, parts } };
}

function signalMessage({
  id,
  type,
  tagName,
  text,
  attributes,
}: {
  id: string;
  type: string;
  tagName: string;
  text: string;
  attributes?: Record<string, unknown>;
}): MastraDBMessage {
  const createdAt = new Date('2026-07-15T10:00:00.000Z');
  return {
    id,
    role: 'signal',
    createdAt,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: {
        signal: { id, type, tagName, createdAt: createdAt.toISOString(), attributes },
      },
    },
  };
}

function messageParts(entry: unknown): unknown[] {
  return isMessageEntry(entry) ? entry.message.content.parts : [];
}

function isMessageEntry(entry: unknown): entry is MessageEntryFixture {
  return (
    typeof entry === 'object' && entry !== null && 'kind' in entry && entry.kind === 'message' && 'message' in entry
  );
}

describe('transcript reducer message entries', () => {
  it('creates initial transcript entries from MastraDBMessage history without flattening content', () => {
    const messages: MastraDBMessage[] = [
      dbMessage('user-1', 'user', [{ type: 'text', text: 'Inspect this' }]),
      dbMessage('assistant-1', 'assistant', [
        { type: 'text', text: 'I will inspect it.' },
        {
          type: 'reasoning',
          reasoning: 'Need the file first.',
          details: [{ type: 'text', text: 'Need the file first.' }],
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'tool-1',
            toolName: 'view',
            args: { path: 'src/index.ts' },
            result: 'export const value = 1;',
          },
        },
      ]),
    ];

    const state = createInitialTranscript({ messages });

    expect(state.entries).toHaveLength(2);
    expect(state.entries[0]).toMatchObject({
      kind: 'message',
      id: 'user-1',
      message: { role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'Inspect this' }] } },
    });
    expect(state.entries[1]).toMatchObject({ kind: 'message', id: 'assistant-1', streaming: false });
    expect(messageParts(state.entries[1])).toEqual([
      { type: 'text', text: 'I will inspect it.' },
      {
        type: 'reasoning',
        reasoning: 'Need the file first.',
        details: [{ type: 'text', text: 'Need the file first.' }],
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tool-1',
          toolName: 'view',
          args: { path: 'src/index.ts' },
          result: 'export const value = 1;',
        },
      },
    ]);
  });

  it('restores suspended tool prompts from persisted assistant metadata', () => {
    const message = dbMessage('assistant-ask', 'assistant', [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'ask-1',
          toolName: 'ask_user',
          args: { question: 'Which database?' },
        },
      },
    ]);
    message.content.metadata = {
      suspendedTools: {
        'ask-1': {
          toolCallId: 'ask-1',
          toolName: 'ask_user',
          args: { question: 'Which database?' },
          suspendPayload: { question: 'Which database?', options: [{ label: 'Postgres' }, { label: 'SQLite' }] },
        },
      },
    };

    const state = createInitialTranscript({ messages: [message] });

    expect(state.entries).toEqual([
      expect.objectContaining({ kind: 'message', id: 'assistant-ask' }),
      {
        kind: 'suspension',
        id: 'suspension-ask-1',
        toolCallId: 'ask-1',
        toolName: 'ask_user',
        args: { question: 'Which database?' },
        suspendPayload: { question: 'Which database?', options: [{ label: 'Postgres' }, { label: 'SQLite' }] },
      },
    ]);
  });

  it('projects persisted and live user signals to user messages without changing canonical content', () => {
    const persisted = signalMessage({
      id: 'user-signal-1',
      type: 'user',
      tagName: 'user',
      text: 'sup',
      attributes: { name: 'Ada Lovelace' },
    });
    const steered = signalMessage({
      id: 'user-signal-2',
      type: 'user',
      tagName: 'user',
      text: 'also inspect the tests',
      attributes: { delivery: 'while-active' },
    });
    const reminder = signalMessage({
      id: 'reminder-1',
      type: 'system-reminder',
      tagName: 'system-reminder',
      text: 'Follow the package instructions.',
    });

    const hydrated = createInitialTranscript({ messages: [persisted, reminder] });
    const persistedEntry = hydrated.entries[0];
    const reminderEntry = hydrated.entries[1];

    expect(persistedEntry).toMatchObject({
      kind: 'message',
      id: persisted.id,
      message: { role: 'user', createdAt: persisted.createdAt, content: persisted.content },
      steer: false,
      authorName: 'Ada Lovelace',
    });
    expect(reminderEntry).toMatchObject({
      kind: 'message',
      id: reminder.id,
      message: { role: 'signal', content: reminder.content },
    });
    expect(persisted.role).toBe('signal');

    const live = transcriptReducer(hydrated, {
      type: 'event',
      event: { type: 'message_start', message: steered },
    });

    expect(live.entries[2]).toMatchObject({
      kind: 'message',
      id: steered.id,
      message: { role: 'user', createdAt: steered.createdAt, content: steered.content },
      streaming: true,
      steer: true,
    });
    expect(steered.role).toBe('signal');
  });

  it('keeps optimistic attribution aligned with hydration and ignores malformed names', () => {
    const optimistic = transcriptReducer(initialTranscript, {
      type: 'localUser',
      text: 'Ship it',
      authorName: 'Ada Lovelace',
    });
    expect(optimistic.entries[0]).toMatchObject({
      kind: 'message',
      message: { role: 'user' },
      authorName: 'Ada Lovelace',
    });

    const malformed = signalMessage({
      id: 'user-signal-malformed',
      type: 'user',
      tagName: 'user',
      text: 'No trusted label',
      attributes: { name: 42 },
    });
    const oversized = signalMessage({
      id: 'user-signal-oversized',
      type: 'user',
      tagName: 'user',
      text: 'No oversized label',
      attributes: { name: 'a'.repeat(129) },
    });
    const hydrated = createInitialTranscript({ messages: [malformed, oversized] });
    expect(hydrated.entries[0]).toMatchObject({ authorName: undefined });
    expect(hydrated.entries[1]).toMatchObject({ authorName: undefined });
  });

  it('streams message updates without replacing non-message transcript state', () => {
    const withNotice = transcriptReducer(initialTranscript, {
      type: 'localNotice',
      level: 'info',
      text: 'Command handled',
    });

    const state = transcriptReducer(withNotice, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('assistant-1', 'assistant', [{ type: 'text', text: 'Streaming text' }]),
      },
    });

    expect(state.pending).toBe(false);
    expect(state.entries[0]).toMatchObject({ kind: 'notice', text: 'Command handled' });
    expect(state.entries[1]).toMatchObject({ kind: 'message', id: 'assistant-1', streaming: true });
    expect(messageParts(state.entries[1])).toEqual([{ type: 'text', text: 'Streaming text' }]);
  });

  it('retains live signal messages between assistant segments without changing assistant decode state', () => {
    const firstAssistant = dbMessage('assistant-1', 'assistant', [{ type: 'text', text: 'Before signals' }]);
    const reminder = signalMessage({
      id: 'reminder-1',
      type: 'system-reminder',
      tagName: 'system-reminder',
      text: 'Follow the package instructions.',
      attributes: { type: 'dynamic-agents-md', path: '/repo/AGENTS.md' },
    });
    const summary = signalMessage({
      id: 'summary-1',
      type: 'notification',
      tagName: 'notification-summary',
      text: 'github: 2 pending notifications',
      attributes: { pending: 2, notificationIds: ['n1', 'n2'] },
    });
    const secondAssistant = dbMessage('assistant-2', 'assistant', [{ type: 'text', text: 'After signals' }]);

    let state = transcriptReducer(
      { ...initialTranscript, pending: true },
      {
        type: 'event',
        event: { type: 'message_update', message: firstAssistant },
      },
    );
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: firstAssistant } });
    const decodeStartedAt = state._decodeStartedAt;

    for (const message of [reminder, summary]) {
      state = transcriptReducer(state, { type: 'event', event: { type: 'message_start', message } });
      expect(state.entries.at(-1)).toMatchObject({ kind: 'message', id: message.id, streaming: true });
      expect(state.pending).toBe(false);
      expect(state._decodeStartedAt).toBe(decodeStartedAt);

      state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message } });
      expect(state.entries.at(-1)).toMatchObject({ kind: 'message', id: message.id, streaming: false });
      expect(state.pending).toBe(false);
      expect(state._decodeStartedAt).toBe(decodeStartedAt);
    }

    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_update', message: secondAssistant },
    });

    expect(state.entries.map(entry => entry.id)).toEqual(['assistant-1', 'reminder-1', 'summary-1', 'assistant-2']);
    expect(state.entries[1]).toMatchObject({
      message: {
        role: 'signal',
        content: {
          parts: [{ type: 'text', text: 'Follow the package instructions.' }],
          metadata: {
            signal: {
              type: 'system-reminder',
              tagName: 'system-reminder',
              attributes: { type: 'dynamic-agents-md', path: '/repo/AGENTS.md' },
            },
          },
        },
      },
    });
    expect(state.entries[2]).toMatchObject({
      message: {
        role: 'signal',
        content: {
          parts: [{ type: 'text', text: 'github: 2 pending notifications' }],
          metadata: {
            signal: {
              type: 'notification',
              tagName: 'notification-summary',
              attributes: { pending: 2, notificationIds: ['n1', 'n2'] },
            },
          },
        },
      },
    });
    expect(messageParts(state.entries[3])).toEqual([{ type: 'text', text: 'After signals' }]);
  });

  it('keeps signal-only events from clearing pending or starting decode timing', () => {
    const reminder = signalMessage({
      id: 'reminder-1',
      type: 'system-reminder',
      tagName: 'system-reminder',
      text: 'Wait for assistant output.',
    });
    const pending = { ...initialTranscript, pending: true };

    const started = transcriptReducer(pending, {
      type: 'event',
      event: { type: 'message_start', message: reminder },
    });
    const ended = transcriptReducer(started, {
      type: 'event',
      event: { type: 'message_end', message: reminder },
    });

    expect(ended.pending).toBe(true);
    expect(ended._decodeStartedAt).toBe(0);
    expect(ended.entries).toHaveLength(1);
    expect(ended.entries[0]).toMatchObject({ id: 'reminder-1', streaming: false });
  });

  it('keeps a resumed specialized tool call in exactly one assistant message', () => {
    const suspendedMessage = dbMessage('assistant-before-suspend', 'assistant', [
      { type: 'text', text: 'Before question' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'ask-1',
          toolName: 'ask_user',
          args: { question: 'Which database?' },
        },
      },
    ]);
    const resumedMessage = dbMessage('assistant-after-resume', 'assistant', [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'ask-1',
          toolName: 'ask_user',
          args: { question: 'Which database?' },
          result: { content: 'User answered: Postgres', isError: false },
        },
      },
      { type: 'text', text: 'After question' },
    ]);

    const beforeResume = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_end', message: suspendedMessage },
    });
    const afterResume = transcriptReducer(beforeResume, {
      type: 'event',
      event: { type: 'message_update', message: resumedMessage },
    });

    const matchingParts = afterResume.entries.flatMap(entry =>
      messageParts(entry).filter(
        part =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          part.type === 'tool-invocation' &&
          'toolInvocation' in part &&
          typeof part.toolInvocation === 'object' &&
          part.toolInvocation !== null &&
          'toolCallId' in part.toolInvocation &&
          part.toolInvocation.toolCallId === 'ask-1',
      ),
    );

    expect(matchingParts).toHaveLength(1);
    expect(afterResume.entries).toHaveLength(2);
    expect(messageParts(afterResume.entries[0])).toEqual([{ type: 'text', text: 'Before question' }]);
    expect(messageParts(afterResume.entries[1])).toEqual(resumedMessage.content.parts);
  });

  it('keeps tool lifecycle events visible inline before a message update re-emits the tool call', () => {
    const started = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'tool_start', toolCallId: 'tool-1', toolName: 'view', args: { path: 'src/index.ts' } },
    });

    expect(messageParts(started.entries[0])).toEqual([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tool-1',
          toolName: 'view',
          args: { path: 'src/index.ts' },
        },
      },
    ]);

    const ended = transcriptReducer(started, {
      type: 'event',
      event: { type: 'tool_end', toolCallId: 'tool-1', result: 'done', isError: false },
    });

    expect(messageParts(ended.entries[0])).toEqual([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tool-1',
          toolName: 'view',
          args: { path: 'src/index.ts' },
          result: 'done',
        },
      },
    ]);
  });
});

describe('transcript reducer prependOlder', () => {
  it('prepends only messages older than the oldest entry already on screen', () => {
    // On screen: newest window (msg-3, msg-4). Grown fetch returns an older
    // window that overlaps at msg-3 (the anchor).
    const onScreen = createInitialTranscript({
      messages: [
        dbMessage('msg-3', 'user', [{ type: 'text', text: 'third' }]),
        dbMessage('msg-4', 'assistant', [{ type: 'text', text: 'fourth' }]),
      ],
    });

    const grown = [
      dbMessage('msg-1', 'user', [{ type: 'text', text: 'first' }]),
      dbMessage('msg-2', 'assistant', [{ type: 'text', text: 'second' }]),
      dbMessage('msg-3', 'user', [{ type: 'text', text: 'third' }]),
      dbMessage('msg-4', 'assistant', [{ type: 'text', text: 'fourth' }]),
    ];

    const next = transcriptReducer(onScreen, { type: 'prependOlder', messages: grown });

    expect(next.entries.map(e => (e.kind === 'message' ? e.id : e.kind))).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4']);
  });

  it('does not duplicate the overlapping/anchor message', () => {
    const onScreen = createInitialTranscript({
      messages: [dbMessage('msg-2', 'assistant', [{ type: 'text', text: 'second' }])],
    });

    const grown = [
      dbMessage('msg-1', 'user', [{ type: 'text', text: 'first' }]),
      dbMessage('msg-2', 'assistant', [{ type: 'text', text: 'second' }]),
    ];

    const next = transcriptReducer(onScreen, { type: 'prependOlder', messages: grown });
    const ids = next.entries.filter(e => e.kind === 'message').map(e => (e.kind === 'message' ? e.id : ''));

    expect(ids).toEqual(['msg-1', 'msg-2']);
    expect(ids.filter(id => id === 'msg-2')).toHaveLength(1);
  });

  it('preserves live-streamed messages at the tail when prepending older history', () => {
    let state = createInitialTranscript({
      messages: [dbMessage('history-2', 'assistant', [{ type: 'text', text: 'older reply' }])],
    });
    // A message streams in live after mount and persists at the tail.
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_end',
        message: dbMessage('live-1', 'assistant', [{ type: 'text', text: 'live reply' }]),
      },
    });

    const grown = [
      dbMessage('history-1', 'user', [{ type: 'text', text: 'oldest' }]),
      dbMessage('history-2', 'assistant', [{ type: 'text', text: 'older reply' }]),
    ];

    const next = transcriptReducer(state, { type: 'prependOlder', messages: grown });
    const ids = next.entries.filter(e => e.kind === 'message').map(e => (e.kind === 'message' ? e.id : ''));

    // Older history joins the front; the live message stays at the tail.
    expect(ids).toEqual(['history-1', 'history-2', 'live-1']);
  });

  it('is a no-op for an empty older window', () => {
    const onScreen = createInitialTranscript({
      messages: [dbMessage('msg-1', 'user', [{ type: 'text', text: 'only' }])],
    });
    const next = transcriptReducer(onScreen, { type: 'prependOlder', messages: [] });
    expect(next).toBe(onScreen);
  });
});

describe('transcript reducer error notices', () => {
  function errorNoticeText(event: Record<string, unknown>): string {
    const state = transcriptReducer(initialTranscript, { type: 'event', event: { type: 'error', ...event } });
    const notice = state.entries.find(entry => entry.kind === 'notice');
    if (!notice || notice.kind !== 'notice') throw new Error('expected a notice entry');
    return notice.text;
  }

  it('renders a string error payload verbatim', () => {
    expect(errorNoticeText({ error: 'model quota exhausted' })).toBe('model quota exhausted');
  });

  it('renders the message from an object error payload', () => {
    expect(errorNoticeText({ error: { message: 'model quota exhausted' } })).toBe('model quota exhausted');
  });

  it('falls back to errorType when the payload has no message', () => {
    expect(errorNoticeText({ error: {}, errorType: 'provider' })).toBe(
      'Run failed (provider). Check the server logs for details.',
    );
  });

  it('falls back to a generic hint when the payload is empty', () => {
    expect(errorNoticeText({ error: {} })).toBe('Run failed with an unknown error. Check the server logs for details.');
  });
});
