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

    let state = transcriptReducer({ ...initialTranscript, pending: true }, {
      type: 'event',
      event: { type: 'message_update', message: firstAssistant },
    });
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

  it('strips ANSI escape sequences from streamed shell output', () => {
    const started = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'tool_start', toolCallId: 'tool-1', toolName: 'execute_command', args: { command: 'gh pr view' } },
    });

    const state = transcriptReducer(started, {
      type: 'event',
      event: {
        type: 'shell_output',
        toolCallId: 'tool-1',
        output: '\u001b[1;38m{\u001b[m\n  \u001b[1;34m"title"\u001b[m: \u001b[32m"Fix bug"\u001b[m\n',
      },
    });

    const entry = state.entries[0];
    if (!entry || entry.kind !== 'message') throw new Error('expected a message entry');
    expect(entry.runtimeTools?.['tool-1']?.output).toBe('{\n  "title": "Fix bug"\n');
  });

  it('ignores active mode and model events because focused providers own that state', () => {
    const state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'mode_changed', modeId: 'plan' },
    });
    const nextState = transcriptReducer(state, {
      type: 'event',
      event: { type: 'model_changed', modelId: 'openai/gpt-4o' },
    });

    expect(nextState).toBe(initialTranscript);
  });

  it('preserves non-message state while using message entries', () => {
    const withTask = transcriptReducer(initialTranscript, {
      type: 'event',
      event: {
        type: 'task_updated',
        tasks: [
          { id: 'task-1', content: 'Refactor transcript', status: 'in_progress', activeForm: 'Refactoring transcript' },
        ],
      },
    });
    const state = transcriptReducer(withTask, {
      type: 'event',
      event: {
        type: 'display_state_changed',
        displayState: {
          tokenUsage: { totalTokens: 42 },
          omProgress: { msgTokens: 10, maxMsgTokens: 100, memTokens: 5, maxMemTokens: 50 },
        },
      },
    });
    const withSummary = transcriptReducer(state, {
      type: 'event',
      event: {
        type: 'notification_summary',
        message: '2 pending notifications',
        pending: 2,
        bySource: { agent: 2 },
        byPriority: { medium: 2 },
        notificationIds: ['n1', 'n2'],
      },
    });
    const withApproval = transcriptReducer(withSummary, {
      type: 'event',
      event: { type: 'tool_approval_required', toolCallId: 'tool-1', toolName: 'edit', args: { path: 'src/index.ts' } },
    });

    expect(withApproval.tasks).toEqual([
      { id: 'task-1', content: 'Refactor transcript', status: 'in_progress', activeForm: 'Refactoring transcript' },
    ]);
    expect(withApproval.usage).toEqual({ totalTokens: 42 });
    expect(withApproval.omProgress).toEqual({ msgTokens: 10, maxMsgTokens: 100, memTokens: 5, maxMemTokens: 50 });
    expect(withApproval.entries).toEqual([
      expect.objectContaining({ kind: 'notification_summary', pending: 2 }),
      expect.objectContaining({ kind: 'approval', toolCallId: 'tool-1' }),
    ]);
  });
});

describe('transcript reducer run flag', () => {
  it('hydrates running from the initial session snapshot', () => {
    expect(createInitialTranscript({ running: true }).running).toBe(true);
    expect(createInitialTranscript({}).running).toBe(false);
  });

  it('folds isRunning from display_state_changed into running', () => {
    const started = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: { isRunning: true } },
    });
    expect(started.running).toBe(true);

    // A snapshot without the flag must not clear a live indicator.
    const unchanged = transcriptReducer(started, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: {} },
    });
    expect(unchanged.running).toBe(true);

    const ended = transcriptReducer(unchanged, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: { isRunning: false } },
    });
    expect(ended.running).toBe(false);
  });

  it('applies running from syncState only when present', () => {
    const synced = transcriptReducer(initialTranscript, { type: 'syncState', running: true });
    expect(synced.running).toBe(true);

    // Older servers omit running from the state snapshot — keep the local flag.
    const preserved = transcriptReducer(synced, { type: 'syncState' });
    expect(preserved.running).toBe(true);
  });

  it('preserves live OM progress and usage when syncState omits them', () => {
    const omProgress = { status: 'idle', pendingTokens: 10 } as never;
    const usage = { input: 5, output: 7 };
    const live = transcriptReducer(
      { ...initialTranscript, omProgress, usage },
      // A running-only sync (or a stale snapshot) must not roll back
      // newer SSE-driven progress/usage.
      { type: 'syncState', running: true },
    );
    expect(live.omProgress).toBe(omProgress);
    expect(live.usage).toBe(usage);
    expect(live.running).toBe(true);
  });

  it('resets running from the provided snapshot', () => {
    const running = transcriptReducer(initialTranscript, { type: 'reset', running: true });
    expect(running.running).toBe(true);
    expect(transcriptReducer(running, { type: 'reset' }).running).toBe(false);
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
