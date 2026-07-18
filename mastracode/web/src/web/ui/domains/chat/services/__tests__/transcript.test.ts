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

  it('projects persisted and live user signals to user messages without changing canonical content', () => {
    const persisted = signalMessage({
      id: 'user-signal-1',
      type: 'user',
      tagName: 'user',
      text: 'sup',
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

  it('removes empty text parts while preserving surrounding tool and text content', () => {
    const state = createInitialTranscript({
      messages: [
        dbMessage('assistant-1', 'assistant', [
          { type: 'text', text: '   \n' },
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
          { type: 'text', text: 'Summary follows.' },
        ]),
      ],
    });

    expect(messageParts(state.entries[0])).toEqual([
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
      { type: 'text', text: 'Summary follows.' },
    ]);
  });

  it('drops hydrated and streamed messages that contain only empty text', () => {
    const hydrated = createInitialTranscript({
      messages: [dbMessage('assistant-empty', 'assistant', [{ type: 'text', text: '  \n ' }])],
    });
    expect(hydrated.entries).toEqual([]);

    const streamed = transcriptReducer(initialTranscript, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('assistant-empty', 'assistant', [{ type: 'text', text: '\t' }]),
      },
    });
    expect(streamed.entries).toEqual([]);
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
