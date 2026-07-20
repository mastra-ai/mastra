import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import {
  addOptimisticMessage,
  createCanonicalMessageState,
  resetCanonicalMessages,
  upsertCanonicalMessage,
} from './canonicalMessages';

function message(id: string, role: MastraDBMessage['role'], parts: MastraMessagePart[]): MastraDBMessage {
  return { id, role, createdAt: new Date('2026-07-17T12:00:00.000Z'), content: { format: 2, parts } };
}

describe('when controller messages are reconstructed', () => {
  it('initializes from persisted messages without rewriting their parts', () => {
    const persisted = message('assistant-1', 'assistant', [
      { type: 'text', text: 'Before' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'ask_user', args: { question: 'Ready?' } },
      },
    ]);

    const state = createCanonicalMessageState([persisted]);

    expect(state.messages).toEqual([persisted]);
    expect(state.messages[0]).toBe(persisted);
  });

  it('replaces cumulative snapshots in first-seen order', () => {
    const first = message('assistant-1', 'assistant', [{ type: 'text', text: 'Before' }]);
    const later = message('assistant-2', 'assistant', [{ type: 'text', text: 'Later' }]);
    const updated = message('assistant-1', 'assistant', [
      { type: 'text', text: 'Before tool after' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'tool-1', toolName: 'view', args: {}, result: 'Done' },
      },
    ]);

    const state = upsertCanonicalMessage(
      upsertCanonicalMessage(createCanonicalMessageState([first]), later),
      updated,
    );

    expect(state.messages).toEqual([updated, later]);
    expect(state.messages[0]).toBe(updated);
  });

  it('reconciles an optimistic user message when its controller echo arrives', () => {
    const optimistic = message('local-1', 'user', [{ type: 'text', text: 'Inspect this' }]);
    const echoed = message('server-1', 'user', [{ type: 'text', text: 'Inspect this' }]);

    const state = upsertCanonicalMessage(addOptimisticMessage(createCanonicalMessageState([]), optimistic), echoed);

    expect(state.messages).toEqual([echoed]);
    expect(state.optimisticIds.size).toBe(0);
  });

  it('does not reconcile a distinct optimistic user message', () => {
    const optimistic = message('local-1', 'user', [{ type: 'text', text: 'First' }]);
    const server = message('server-1', 'user', [{ type: 'text', text: 'Second' }]);

    const state = upsertCanonicalMessage(addOptimisticMessage(createCanonicalMessageState([]), optimistic), server);

    expect(state.messages).toEqual([optimistic, server]);
  });

  it('resets messages and optimistic state on thread changes', () => {
    const optimistic = message('local-1', 'user', [{ type: 'text', text: 'Pending' }]);
    const persisted = message('persisted-1', 'assistant', [{ type: 'text', text: 'New thread' }]);

    const state = resetCanonicalMessages(
      addOptimisticMessage(createCanonicalMessageState([], 'thread-1'), optimistic),
      'thread-2',
      [persisted],
    );

    expect(state).toEqual({ threadId: 'thread-2', messages: [persisted], optimisticIds: new Set() });
  });
});
