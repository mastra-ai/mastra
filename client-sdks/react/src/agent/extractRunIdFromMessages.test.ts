import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';
import type { MastraDBMessageMetadata } from '../lib/mastra-db';
import { extractRunIdFromMessages } from './extractRunIdFromMessages';

const assistantWithMetadata = (id: string, metadata: MastraDBMessageMetadata): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(),
  content: {
    format: 2,
    parts: [],
    metadata,
  },
});

describe('extractRunIdFromMessages', () => {
  it('returns runId from suspendedTools', () => {
    const messages: MastraDBMessage[] = [
      assistantWithMetadata('msg-1', {
        mode: 'stream',
        suspendedTools: {
          'workflow-multi-step': {
            toolCallId: 'tool-1',
            toolName: 'workflow-multi-step',
            args: { step: 2 },
            suspendPayload: { question: 'Continue?' },
            runId: 'run-suspended-123',
          },
        },
      }),
    ];

    expect(extractRunIdFromMessages(messages)).toBe('run-suspended-123');
  });

  it('returns runId from requireApprovalMetadata', () => {
    const messages: MastraDBMessage[] = [
      assistantWithMetadata('msg-1', {
        mode: 'stream',
        requireApprovalMetadata: {
          search: {
            toolCallId: 'tool-1',
            toolName: 'search',
            args: { query: 'test' },
            runId: 'run-approval-123',
          },
        },
      }),
    ];

    expect(extractRunIdFromMessages(messages)).toBe('run-approval-123');
  });

  it('skips entries without runId and returns a later valid runId', () => {
    const messages: MastraDBMessage[] = [
      assistantWithMetadata('msg-1', {
        mode: 'stream',
        suspendedTools: {
          'workflow-first': {
            toolCallId: 'tool-1',
            toolName: 'workflow-first',
            args: {},
            suspendPayload: { question: 'First' },
          },
          'workflow-second': {
            toolCallId: 'tool-2',
            toolName: 'workflow-second',
            args: {},
            suspendPayload: { question: 'Second' },
            runId: 'run-later-123',
          },
        },
      }),
    ];

    expect(extractRunIdFromMessages(messages)).toBe('run-later-123');
  });

  it('returns the latest runId associated with a pending tool call', () => {
    const messages: MastraDBMessage[] = [
      assistantWithMetadata('msg-older', {
        mode: 'stream',
        suspendedTools: {
          'tool-older': {
            toolCallId: 'tool-older',
            toolName: 'submit_plan',
            args: {},
            suspendPayload: { path: '/tmp/older.md' },
            runId: 'run-older',
          },
        },
      }),
      assistantWithMetadata('msg-pending', {
        mode: 'stream',
        suspendedTools: {
          'tool-pending': {
            toolCallId: 'tool-pending',
            toolName: 'submit_plan',
            args: {},
            suspendPayload: { path: '/tmp/pending.md' },
            runId: 'run-pending',
          },
        },
      }),
    ];

    expect(extractRunIdFromMessages(messages, new Set(['tool-older', 'tool-pending']))).toBe('run-pending');
  });
});
