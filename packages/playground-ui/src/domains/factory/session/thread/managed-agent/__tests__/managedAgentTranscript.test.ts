import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import { managedAgentTranscript } from '../managedAgentTranscript';

const user: MastraDBMessage = {
  id: 'm1',
  role: 'user',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  threadId: 't1',
  content: { format: 2, parts: [{ type: 'text', text: 'write a file' }] },
};

const awaitingApproval: MastraDBMessage = {
  id: 'm2',
  role: 'assistant',
  createdAt: new Date('2026-01-01T00:00:01Z'),
  threadId: 't1',
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'writeFile', args: { path: 'a.txt' } },
      },
    ],
    metadata: { pendingToolApprovals: { 'call-1': { toolCallId: 'call-1', toolName: 'writeFile', args: {} } } },
  },
};

const kinds = (state: ReturnType<typeof managedAgentTranscript>) => state.entries.map(entry => entry.kind);

describe('managedAgentTranscript', () => {
  it('builds message entries and pending approval prompts from stored messages', () => {
    const state = managedAgentTranscript({ messages: [user, awaitingApproval], threadId: 't1', running: false });
    expect(kinds(state)).toEqual(['message', 'message', 'approval']);
    expect(state.threadId).toBe('t1');
    expect(state.pending).toBe(false);
  });

  it('drops prompts the user already answered', () => {
    const state = managedAgentTranscript({
      messages: [user, awaitingApproval],
      running: true,
      resolvedPrompts: new Set(['approval-call-1']),
    });
    expect(kinds(state)).toEqual(['message', 'message']);
    expect(state.pending).toBe(true);
  });

  it('appends local notices after the thread', () => {
    const state = managedAgentTranscript({
      messages: [user],
      running: false,
      notices: [{ kind: 'notice', id: 'n1', level: 'error', text: 'Send failed' }],
    });
    expect(kinds(state)).toEqual(['message', 'notice']);
  });
});
