import type { AgentControllerMessage } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { createInitialTranscript, initialTranscript, transcriptReducer } from '../transcript';

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
  it('creates initial transcript entries from ordered controller messages', () => {
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
