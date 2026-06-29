import type { AgentControllerMessage } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { initialTranscript, transcriptReducer } from './transcript';

type MessageEntryFixture = {
  kind: 'message';
  message: { content: { parts: unknown[] } };
};

function messageParts(entry: unknown): unknown[] {
  return isMessageEntry(entry) ? entry.message.content.parts : [];
}

function isMessageEntry(entry: unknown): entry is MessageEntryFixture {
  return (
    typeof entry === 'object' && entry !== null && 'kind' in entry && entry.kind === 'message' && 'message' in entry
  );
}

describe('transcript reducer message entries', () => {
  it('hydrates controller messages as ordered MastraDBMessage entries', () => {
    const messages: AgentControllerMessage[] = [
      { id: 'user-1', role: 'user', content: [{ type: 'text', text: 'Inspect this' }] },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will inspect it.' },
          { type: 'thinking', thinking: 'Need the file first.' },
          { type: 'tool_call', id: 'tool-1', name: 'view', args: { path: 'src/index.ts' } },
          { type: 'tool_result', id: 'tool-1', name: 'view', result: 'export const value = 1;' },
        ],
      },
    ];

    const state = transcriptReducer(initialTranscript, { type: 'hydrate', messages });

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
        message: { id: 'assistant-1', role: 'assistant', content: [{ type: 'text', text: 'Streaming text' }] },
      },
    });

    expect(state.pending).toBe(false);
    expect(state.entries[0]).toMatchObject({ kind: 'notice', text: 'Command handled' });
    expect(state.entries[1]).toMatchObject({ kind: 'message', id: 'assistant-1', streaming: true });
    expect(messageParts(state.entries[1])).toEqual([{ type: 'text', text: 'Streaming text' }]);
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
