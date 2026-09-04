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

function isToolInvocationPart(part: unknown): part is { toolInvocation: { toolCallId: string } } {
  return typeof part === 'object' && part !== null && 'toolInvocation' in part;
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
    // The question stays in the bubble the reader answered it in, with the
    // resumed copy's result folded in; the new message keeps only its own text.
    expect(messageParts(afterResume.entries[0])).toEqual([
      { type: 'text', text: 'Before question' },
      resumedMessage.content.parts[0],
    ]);
    expect(messageParts(afterResume.entries[1])).toEqual([{ type: 'text', text: 'After question' }]);
  });

  it('keeps a call where the reader watched it land when the rotated message claims it', () => {
    // A step's first call can stream in before the engine announces the step's
    // message, so its row is already drawn under the previous bubble when the
    // rotated message arrives carrying the same call. Moving the part would
    // remount the row under the reader; the drawn row keeps it.
    const first = dbMessage('turn-1', 'assistant', [{ type: 'text', text: 'Looking around' }]);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_start', message: first },
    });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: first } });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'tool_start', toolCallId: 'tool-1', toolName: 'view', args: { path: 'src/index.ts' } },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('turn-2', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: { path: 'src/index.ts' } },
          },
          { type: 'text', text: 'Reading the entry point' },
        ]),
      },
    });

    expect(state.entries).toHaveLength(2);
    expect(messageParts(state.entries[0]).filter(isToolInvocationPart)).toHaveLength(1);
    expect(messageParts(state.entries[1])).toEqual([{ type: 'text', text: 'Reading the entry point' }]);

    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'tool_end', toolCallId: 'tool-1', result: 'ok', isError: false },
    });
    const drawn = messageParts(state.entries[0]).filter(isToolInvocationPart);
    expect(drawn[0]).toMatchObject({ toolInvocation: { state: 'result', toolCallId: 'tool-1' } });
  });

  it("folds a dropped copy's result into the drawn row when its tool_end was lost", () => {
    const first = dbMessage('turn-1', 'assistant', [{ type: 'text', text: 'Looking around' }]);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_start', message: first },
    });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: first } });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'tool_start', toolCallId: 'tool-1', toolName: 'view', args: { path: 'src/index.ts' } },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('turn-2', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'view',
              args: { path: 'src/index.ts' },
              result: 'contents',
            },
          },
          { type: 'text', text: 'Found it' },
        ]),
      },
    });

    const drawn = messageParts(state.entries[0]).filter(isToolInvocationPart);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatchObject({ toolInvocation: { state: 'result', result: 'contents' } });
    expect(messageParts(state.entries[1])).toEqual([{ type: 'text', text: 'Found it' }]);
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

  it('stamps isError on the mirrored part when tool_end reports a failure', () => {
    // Without the flag the terminal-state render precedence would read the
    // failed tool as a bare successful `result`.
    const started = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'tool_start', toolCallId: 'tool-1', toolName: 'view', args: {} },
    });
    const ended = transcriptReducer(started, {
      type: 'event',
      event: { type: 'tool_end', toolCallId: 'tool-1', result: 'exploded', isError: true },
    });

    expect(messageParts(ended.entries[0])).toEqual([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tool-1',
          toolName: 'view',
          args: {},
          result: 'exploded',
          isError: true,
        },
      },
    ]);
  });

  it('keeps a tool call in one card when a steer rotates the assistant message mid-stream', () => {
    // A steer closes the running assistant message and opens the next one while
    // the tool arguments are still streaming; the remaining deltas belong to the
    // call that started, not to whatever message is latest.
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: {
        type: 'message_start',
        message: dbMessage('turn-1', 'assistant', [{ type: 'text', text: 'reviewing' }]),
      },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'tool_input_start', toolCallId: 'tool-1', toolName: 'submit_review' },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 'tool-1', argsTextDelta: 'the implementation reuses' },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_start', message: dbMessage('turn-2', 'assistant', [{ type: 'text', text: '' }]) },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 'tool-1', argsTextDelta: ' the backing agent' },
    });

    const cards = state.entries.flatMap(entry =>
      messageParts(entry).filter(part => isToolInvocationPart(part) && part.toolInvocation.toolCallId === 'tool-1'),
    );
    expect(cards).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      runtimeTools: { 'tool-1': { argsText: 'the implementation reuses the backing agent' } },
    });
  });

  it('rewrites the entry when the same turn comes back under a new message id', () => {
    // The engine adopts the run loop's message id only while its own message is
    // still empty, so a turn can start streaming under one identity and keep
    // going under another. Drawing both leaves the first copy stripped of the
    // tool parts the second one claims, next to a full copy of its own text.
    const started = dbMessage('streamed-turn', 'assistant', [
      { type: 'text', text: 'gh is missing here.' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'execute_command', args: {}, result: 'ok' },
      },
    ]);
    const reidentified = dbMessage('adopted-turn', 'assistant', [
      ...started.content.parts,
      { type: 'text', text: 'Installing it now.' },
    ]);

    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_start', message: started },
    });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_update', message: reidentified } });

    expect(state.entries).toHaveLength(1);
    expect(messageParts(state.entries[0])).toEqual(reidentified.content.parts);
  });

  it('draws a rotated turn as its own entry even when its text repeats the last one', () => {
    // The run loop seals one response and opens the next at a step boundary, and
    // the engine announces the new id on its first empty text part. That
    // announcement is what tells a fresh turn apart from a re-identified one
    // when the model happens to open with the same words.
    const first = dbMessage('turn-1', 'assistant', [{ type: 'text', text: 'Let me check' }]);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_start', message: first },
    });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: first } });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_start', message: dbMessage('turn-2', 'assistant', [{ type: 'text', text: '' }]) },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('turn-2', 'assistant', [{ type: 'text', text: 'Let me check the tests too' }]),
      },
    });

    expect(state.entries).toHaveLength(2);
    expect(messageParts(state.entries[0])).toEqual(first.content.parts);
    expect(messageParts(state.entries[1])).toEqual([{ type: 'text', text: 'Let me check the tests too' }]);
  });
});

describe('transcript reducer mergeWindow', () => {
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

    const next = transcriptReducer(onScreen, { type: 'mergeWindow', messages: grown });

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

    const next = transcriptReducer(onScreen, { type: 'mergeWindow', messages: grown });
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

    const next = transcriptReducer(state, { type: 'mergeWindow', messages: grown });
    const ids = next.entries.filter(e => e.kind === 'message').map(e => (e.kind === 'message' ? e.id : ''));

    // Older history joins the front; the live message stays at the tail.
    expect(ids).toEqual(['history-1', 'history-2', 'live-1']);
  });

  it('is a no-op for an empty older window', () => {
    const onScreen = createInitialTranscript({
      messages: [dbMessage('msg-1', 'user', [{ type: 'text', text: 'only' }])],
    });
    const next = transcriptReducer(onScreen, { type: 'mergeWindow', messages: [] });
    expect(next).toBe(onScreen);
  });

  it('is a no-op when the window is already fully on screen', () => {
    const messages = [
      dbMessage('msg-1', 'user', [{ type: 'text', text: 'first' }]),
      dbMessage('msg-2', 'assistant', [{ type: 'text', text: 'second' }]),
    ];
    const onScreen = createInitialTranscript({ messages });
    const next = transcriptReducer(onScreen, { type: 'mergeWindow', messages });
    expect(next).toBe(onScreen);
  });

  it('appends messages the run produced while the transcript was unmounted', () => {
    const onScreen = createInitialTranscript({
      messages: [dbMessage('kickoff', 'user', [{ type: 'text', text: 'review this PR' }])],
    });

    const refreshed = [
      dbMessage('kickoff', 'user', [{ type: 'text', text: 'review this PR' }]),
      dbMessage('reply-1', 'assistant', [{ type: 'text', text: 'reading the diff' }]),
      dbMessage('reply-2', 'assistant', [{ type: 'text', text: 'here is the review' }]),
    ];

    const next = transcriptReducer(onScreen, { type: 'mergeWindow', messages: refreshed });

    expect(next.entries.map(e => (e.kind === 'message' ? e.id : e.kind))).toEqual(['kickoff', 'reply-1', 'reply-2']);
  });

  it('fills a gap between two on-screen messages', () => {
    const onScreen = createInitialTranscript({
      messages: [
        dbMessage('msg-1', 'user', [{ type: 'text', text: 'first' }]),
        dbMessage('msg-3', 'assistant', [{ type: 'text', text: 'third' }]),
      ],
    });

    const refreshed = [
      dbMessage('msg-1', 'user', [{ type: 'text', text: 'first' }]),
      dbMessage('msg-2', 'assistant', [{ type: 'text', text: 'second' }]),
      dbMessage('msg-3', 'assistant', [{ type: 'text', text: 'third' }]),
    ];

    const next = transcriptReducer(onScreen, { type: 'mergeWindow', messages: refreshed });

    expect(next.entries.map(e => (e.kind === 'message' ? e.id : e.kind))).toEqual(['msg-1', 'msg-2', 'msg-3']);
  });

  it('keeps the streaming entry for a message the window also carries', () => {
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('assistant-1', 'assistant', [{ type: 'text', text: 'partial' }]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [dbMessage('assistant-1', 'assistant', [{ type: 'text', text: 'persisted prefix' }])],
    });

    expect(next.entries[0]).toMatchObject({ kind: 'message', id: 'assistant-1', streaming: true });
    expect(messageParts(next.entries[0])).toEqual([{ type: 'text', text: 'partial' }]);
  });

  it('replaces a tool part stuck at call with the terminal copy from the window', () => {
    // A dropped stream can swallow tool_end; the refetched window carries the
    // persisted result and must heal the stuck part.
    const onScreen = createInitialTranscript({
      messages: [
        dbMessage('assistant-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'execute_command', args: {} },
          },
        ]),
      ],
    });

    const next = transcriptReducer(onScreen, {
      type: 'mergeWindow',
      messages: [
        dbMessage('assistant-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'execute_command',
              args: {},
              result: 'ok',
            },
          },
        ]),
      ],
    });

    expect(messageParts(next.entries[0])).toMatchObject([{ toolInvocation: { state: 'result', result: 'ok' } }]);
  });

  it('heals a stuck tool part without touching live-streamed text', () => {
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('assistant-1', 'assistant', [
          { type: 'text', text: 'streamed text' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
          },
        ]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('assistant-1', 'assistant', [
          { type: 'text', text: 'persisted prefix' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'done' },
          },
        ]),
      ],
    });

    expect(messageParts(next.entries[0])).toEqual([
      { type: 'text', text: 'streamed text' },
      expect.objectContaining({
        toolInvocation: expect.objectContaining({ state: 'result', result: 'done' }),
      }),
    ]);
  });

  it('never regresses a terminal tool part to an older call state from the window', () => {
    const onScreen = createInitialTranscript({
      messages: [
        dbMessage('assistant-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
        ]),
      ],
    });

    const next = transcriptReducer(onScreen, {
      type: 'mergeWindow',
      messages: [
        dbMessage('assistant-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
          },
        ]),
      ],
    });

    expect(next).toBe(onScreen);
  });

  it.each(['output-error', 'output-denied'] as const)(
    'replaces a tool part stuck at call with a terminal %s copy from the window',
    state => {
      const onScreen = createInitialTranscript({
        messages: [
          dbMessage('assistant-1', 'assistant', [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
            },
          ]),
        ],
      });

      const next = transcriptReducer(onScreen, {
        type: 'mergeWindow',
        messages: [
          dbMessage('assistant-1', 'assistant', [
            {
              type: 'tool-invocation',
              toolInvocation: { state, toolCallId: 'tool-1', toolName: 'view', args: {}, errorText: 'nope' },
            },
          ]),
        ],
      });

      expect(messageParts(next.entries[0])).toMatchObject([{ toolInvocation: { state, errorText: 'nope' } }]);
    },
  );

  it('adopts trailing parts the gap swallowed when the run ended before reconnect', () => {
    // The stream died mid-turn: the live entry holds a cut-off text and a tool
    // stuck at call. The run finished during the gap, so the refetched window
    // is the only carrier of the extended text, the result and the final text.
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('live-1', 'assistant', [
          { type: 'text', text: 'working' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
          },
        ]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('persisted-1', 'assistant', [
          { type: 'text', text: 'working on it' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
          { type: 'text', text: 'final answer' },
        ]),
      ],
    });

    expect(next.entries).toHaveLength(1);
    expect(messageParts(next.entries[0])).toEqual([
      { type: 'text', text: 'working on it' },
      expect.objectContaining({ toolInvocation: expect.objectContaining({ state: 'result', result: 'ok' }) }),
      { type: 'text', text: 'final answer' },
    ]);
  });

  it('returns the same state when the window matches the on-screen turn exactly', () => {
    // Routine revalidation must stay a referential no-op or every refetch
    // rerenders the whole transcript.
    const parts: MastraMessagePart[] = [
      { type: 'text', text: 'done' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
      },
    ];
    const onScreen = createInitialTranscript({ messages: [dbMessage('assistant-1', 'assistant', parts)] });

    const next = transcriptReducer(onScreen, {
      type: 'mergeWindow',
      messages: [dbMessage('assistant-1', 'assistant', parts)],
    });

    expect(next).toBe(onScreen);
  });

  it('does not duplicate a turn the window carries under its persisted id', () => {
    // A streamed turn keeps its display id; the persisted copy arrives under a
    // different id but shares the toolCallId. Merge must heal in place, not
    // append a second copy of the turn.
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('live-1', 'assistant', [
          { type: 'text', text: 'working on it' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
          },
        ]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('persisted-1', 'assistant', [
          { type: 'text', text: 'working on it' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
        ]),
      ],
    });

    expect(next.entries).toHaveLength(1);
    expect(messageParts(next.entries[0])).toMatchObject([
      { type: 'text' },
      { toolInvocation: { state: 'result', result: 'ok' } },
    ]);
  });

  it('does not redraw the text of a turn the server persisted as its own step', () => {
    // The stream carries one assistant message per run; the server persists one
    // per step, so the trailing text comes back under an id the timeline never
    // saw — and used to land on screen a second time on every revalidation.
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('streamed-turn', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
          { type: 'text', text: 'Almost, but not approvable yet.' },
        ]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('step-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
        ]),
        dbMessage('step-2', 'assistant', [{ type: 'text', text: 'Almost, but not approvable yet.' }]),
      ],
    });

    expect(next.entries).toHaveLength(1);
  });

  it('does not redraw a step the stream has already written further', () => {
    // A focus revalidation lands mid-run: the persisted step holds a prefix of
    // the text still streaming on screen — same step, older snapshot.
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('streamed-turn', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
          { type: 'text', text: 'Almost, but not approvable yet.' },
        ]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('step-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
        ]),
        dbMessage('step-2', 'assistant', [{ type: 'text', text: 'Almost, but not' }]),
      ],
    });

    expect(next.entries).toHaveLength(1);
  });

  it('still inserts a sealed turn whose text merely extends an older one', () => {
    const onScreen = createInitialTranscript({
      messages: [dbMessage('history-turn', 'assistant', [{ type: 'text', text: 'Almost, but' }])],
    });

    const next = transcriptReducer(onScreen, {
      type: 'mergeWindow',
      messages: [
        dbMessage('history-turn', 'assistant', [{ type: 'text', text: 'Almost, but' }]),
        dbMessage('new-turn', 'assistant', [{ type: 'text', text: 'Almost, but not approvable yet.' }]),
      ],
    });

    expect(next.entries).toHaveLength(2);
  });

  it('adopts a window copy that has written the streaming step further', () => {
    // SSE is behind the server: the persisted step extends the text still
    // streaming on screen. One turn, healed in place — never a second bubble.
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('streamed-turn', 'assistant', [{ type: 'text', text: 'Almost' }]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [dbMessage('step-2', 'assistant', [{ type: 'text', text: 'Almost, but not approvable yet.' }])],
    });

    expect(next.entries).toHaveLength(1);
    expect(messageParts(next.entries[0])).toEqual([{ type: 'text', text: 'Almost, but not approvable yet.' }]);
  });

  it('inserts a window copy whose parts prove it is a different turn', () => {
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('streamed-turn', 'assistant', [
          { type: 'text', text: 'Checking.' },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'ok' },
          },
        ]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('other-turn', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'tool-9', toolName: 'view', args: {}, result: 'ok' },
          },
          { type: 'text', text: 'Checking.' },
        ]),
      ],
    });

    expect(next.entries).toHaveLength(2);
  });

  it('inserts a window copy that adds a text part the gap swallowed', () => {
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('streamed-turn', 'assistant', [{ type: 'text', text: 'Almost' }]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('step-2', 'assistant', [
          { type: 'text', text: 'Almost' },
          { type: 'text', text: 'but not approvable yet.' },
        ]),
      ],
    });

    expect(next.entries).toHaveLength(2);
  });

  it('lets the persisted copy claim the local echo of a steer', () => {
    // A steer sent while the tab is hidden loses its live signal event to the
    // SSE gap: the reconnect refetch is the first time the timeline sees it, and
    // the echo it belongs to carries a client-minted `local-…` id.
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, { type: 'localUser', text: 'stop and read the file', steer: true });
    const localId = state.entries[0]?.id;

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        signalMessage({
          id: 'sig-1',
          type: 'user',
          tagName: 'user',
          text: 'stop and read the file',
          attributes: { delivery: 'while-active' },
        }),
      ],
    });

    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]).toMatchObject({
      id: localId,
      steer: true,
      deliveryStatus: 'delivered',
      message: { id: 'sig-1' },
    });
  });

  it('does not redraw a turn whose persisted copy carries tool calls the stream never delivered', () => {
    let state = createInitialTranscript({ messages: [] });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('streamed-turn', 'assistant', [{ type: 'text', text: 'gh is missing here.' }]),
      },
    });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        dbMessage('persisted-turn', 'assistant', [
          { type: 'text', text: 'gh is missing here.' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'execute_command',
              args: {},
              result: 'ok',
            },
          },
        ]),
      ],
    });

    expect(next.entries).toHaveLength(1);
    expect(messageParts(next.entries[0])).toHaveLength(2);
  });

  it('draws both when the same text is sent twice', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, { type: 'localUser', text: 'again' });
    state = transcriptReducer(state, { type: 'localUser', text: 'again' });

    const next = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [
        signalMessage({ id: 'sig-1', type: 'user', tagName: 'user', text: 'again' }),
        signalMessage({ id: 'sig-2', type: 'user', tagName: 'user', text: 'again' }),
      ],
    });

    expect(next.entries).toHaveLength(2);
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

describe('transcript reducer workspace errors', () => {
  function noticeTexts(event: Record<string, unknown> & { type: string }): string[] {
    const state = transcriptReducer(initialTranscript, { type: 'event', event });
    return state.entries.flatMap(entry => (entry.kind === 'notice' ? [entry.text] : []));
  }

  it('surfaces the message of a workspace_error', () => {
    expect(noticeTexts({ type: 'workspace_error', error: { name: 'Error', message: 'clone failed' } })).toEqual([
      'Workspace: clone failed',
    ]);
  });

  it('surfaces the message of a failed workspace_status_changed', () => {
    expect(
      noticeTexts({
        type: 'workspace_status_changed',
        status: 'error',
        error: { name: 'Error', message: 'no disk space left' },
      }),
    ).toEqual(['Workspace: no disk space left']);
  });

  it('stays quiet while the workspace is healthy', () => {
    expect(noticeTexts({ type: 'workspace_status_changed', status: 'ready' })).toEqual([]);
    expect(noticeTexts({ type: 'workspace_ready', workspaceId: 'w1', workspaceName: 'repo' })).toEqual([]);
  });
});

describe('live user-signal events render the same as their persisted copy', () => {
  /**
   * `agent-channels` stamps this on every inbound channel message, and
   * `toDataPart` carries it onto the live event — it is what marks the signal
   * as Slack-origin rather than composer-origin.
   */
  const slackProviderOptions = {
    mastra: { channels: { slack: { author: { userId: 'U123', userName: 'caleb' } } } },
  };

  const payload = {
    id: 'sig-1',
    type: 'user',
    tagName: 'user',
    contents: 'hello from slack',
    createdAt: '2026-07-27T16:00:00.000Z',
    providerOptions: slackProviderOptions,
  };

  /** The live event shape: signal payload as one data part, text inside `data.contents`. */
  function liveUserSignal(): MastraDBMessage {
    return {
      id: 'sig-1',
      role: 'signal',
      createdAt: new Date(payload.createdAt),
      content: {
        format: 2,
        parts: [{ type: 'data-user-message', data: payload }] as unknown as MastraMessagePart[],
        metadata: { signal: payload },
      },
    };
  }

  function liveComposerSignal(attributes?: Record<string, unknown>): MastraDBMessage {
    const composerPayload = {
      id: 'sig-web',
      type: 'user',
      tagName: 'user',
      contents: 'hello from the composer',
      createdAt: '2026-07-27T16:00:00.000Z',
      attributes,
    };
    return {
      id: 'sig-web',
      role: 'signal',
      createdAt: new Date(composerPayload.createdAt),
      content: {
        format: 2,
        parts: [{ type: 'data-user-message', data: composerPayload }] as unknown as MastraMessagePart[],
        metadata: { signal: composerPayload },
      },
    };
  }

  function firstEntryParts(state: ReturnType<typeof createInitialTranscript>) {
    const entry = state.entries.find(e => 'id' in e && e.id === 'sig-1');
    return messageParts(entry);
  }

  it('gives the live data-user-message event a drawable text part', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_start', message: liveUserSignal() } });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: liveUserSignal() } });

    expect(firstEntryParts(state)).toEqual([{ type: 'text', text: 'hello from slack' }]);
  });

  it('does not blank the row when the live event replaces an already-rendered one', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });

    // Persisted-shaped copy first, then the live data-part copy with the same id.
    const persisted = signalMessage({ id: 'sig-1', type: 'user', tagName: 'user', text: 'hello from slack' });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_start', message: persisted } });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: liveUserSignal() } });

    expect(firstEntryParts(state)).toEqual([{ type: 'text', text: 'hello from slack' }]);
  });

  it('leaves a persisted user signal untouched', () => {
    const persisted = signalMessage({ id: 'sig-1', type: 'user', tagName: 'user', text: 'hello from slack' });
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_start', message: persisted } });

    expect(firstEntryParts(state)).toEqual([{ type: 'text', text: 'hello from slack' }]);
  });
  it('keeps a normal composer signal hidden behind its optimistic message', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, { type: 'localUser', text: 'hello from the composer' });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_start', message: liveComposerSignal() },
    });
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_end', message: liveComposerSignal() },
    });

    const drawable = state.entries.filter(
      entry =>
        entry.kind === 'message' &&
        entry.message.content.parts.some(part => part.type === 'text' && part.text.includes('hello from the composer')),
    );
    expect(drawable).toHaveLength(1);
    expect(drawable[0]?.id).toMatch(/^local-/);
  });

  it('confirms the optimistic composer message with the streamed signal', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, {
      type: 'localUser',
      text: 'hello from the composer',
      steer: true,
    });
    expect(state.entries[0]).toMatchObject({ steer: true, deliveryStatus: 'pending' });
    const localId = state.entries[0]?.id;

    const delivered = liveComposerSignal({ delivery: 'while-active' });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_start', message: delivered } });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: delivered } });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      id: localId,
      steer: true,
      deliveryStatus: 'delivered',
      message: {
        id: 'sig-web',
        role: 'user',
        content: { parts: [{ type: 'text', text: 'hello from the composer' }] },
      },
    });
  });

  it('turns an optimistic steer into a normal message when the run ended before delivery', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, {
      type: 'localUser',
      text: 'hello from the composer',
      steer: true,
    });
    const localId = state.entries[0]?.id;

    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'message_start', message: liveComposerSignal() },
    });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      id: localId,
      steer: false,
      deliveryStatus: undefined,
      message: { id: 'sig-web' },
    });
  });

  it('preserves optimistic content when a data-only signal confirms through a server window', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, {
      type: 'localUser',
      text: 'hello from the composer',
      steer: true,
    });
    const localId = state.entries[0]?.id;

    state = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [liveComposerSignal({ delivery: 'while-active' })],
    });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      id: localId,
      steer: true,
      deliveryStatus: 'delivered',
      message: {
        id: 'sig-web',
        role: 'user',
        content: { parts: [{ type: 'text', text: 'hello from the composer' }] },
      },
    });
  });

  it('confirms a failed steer when its streamed signal arrives later', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, {
      type: 'localUser',
      text: 'hello from the composer',
      steer: true,
    });
    const localId = state.entries[0]?.id;
    if (!localId) throw new Error('Expected an optimistic message');
    state = transcriptReducer(state, { type: 'failLocalUser', id: localId });

    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_start',
        message: liveComposerSignal({ delivery: 'while-active' }),
      },
    });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      id: localId,
      steer: true,
      deliveryStatus: 'delivered',
      message: { id: 'sig-web' },
    });
  });

  it('confirms a failed steer when its server-window copy arrives later', () => {
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, {
      type: 'localUser',
      text: 'hello from the composer',
      steer: true,
    });
    const localId = state.entries[0]?.id;
    if (!localId) throw new Error('Expected an optimistic message');
    state = transcriptReducer(state, { type: 'failLocalUser', id: localId });

    state = transcriptReducer(state, {
      type: 'mergeWindow',
      messages: [liveComposerSignal({ delivery: 'while-active' })],
    });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      id: localId,
      steer: true,
      deliveryStatus: 'delivered',
      message: { id: 'sig-web' },
    });
  });

  it('keeps non-user signals alone', () => {
    const reminder = signalMessage({ id: 'sig-2', type: 'system-reminder', tagName: 'reminder', text: 'stay on task' });
    let state = createInitialTranscript({ messages: [], threadId: 't1' });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_start', message: reminder } });

    const entry = state.entries.find(e => 'id' in e && e.id === 'sig-2');
    expect(messageParts(entry)).toEqual([{ type: 'text', text: 'stay on task' }]);
  });

  it('leaves a sealed turn alone when a later turn opens with the same words', () => {
    // A turn only gets re-identified while it is still streaming. Once sealed it
    // is history, and a fresh turn that happens to open on the same words — an
    // SSE gap having swallowed its empty opening event — must not overwrite it.
    const sealed = dbMessage('turn-1', 'assistant', [{ type: 'text', text: 'Done.' }]);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_start', message: sealed },
    });
    state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: sealed } });
    state = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('turn-2', 'assistant', [{ type: 'text', text: 'Done. Now the next thing' }]),
      },
    });

    expect(state.entries).toHaveLength(2);
    expect(messageParts(state.entries[0])).toEqual(sealed.content.parts);
  });
});

describe('transcript reducer entry identity', () => {
  it('keeps the identity a tool-bearing entry was drawn with, and closes it to the next reply', () => {
    const drawn = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'tool_start', toolCallId: 'call-1', toolName: 'view', args: { path: 'a.ts' } },
    });
    const drawnId = drawn.entries[0]?.id;

    expect(drawnId).toMatch(/^assistant-tools-/);

    const claimed = transcriptReducer(drawn, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('assistant-first', 'assistant', [{ type: 'text', text: 'Read it.' }]),
      },
    });

    expect(claimed.entries).toHaveLength(1);
    expect(claimed.entries[0]?.id).toBe(drawnId);

    const next = transcriptReducer(claimed, {
      type: 'event',
      event: {
        type: 'message_update',
        message: dbMessage('assistant-second', 'assistant', [{ type: 'text', text: 'Now the next one.' }]),
      },
    });

    expect(next.entries).toHaveLength(2);
  });
});
