import { describe, expect, it } from 'vitest';
import type { ExtendedMastraUIMessage } from '../lib/ai-sdk';
import { extractRunIdFromMessages } from './extractRunIdFromMessages';

describe('extractRunIdFromMessages', () => {
  it('returns runId from suspendedTools after initial message resolution', () => {
    const messages: ExtendedMastraUIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [],
        metadata: {
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
        },
      },
    ];

    expect(extractRunIdFromMessages(messages)).toBe('run-suspended-123');
  });

  it('returns runId from requireApprovalMetadata when already in stream format', () => {
    const messages: ExtendedMastraUIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [],
        metadata: {
          mode: 'stream',
          requireApprovalMetadata: {
            search: {
              toolCallId: 'tool-1',
              toolName: 'search',
              args: { query: 'test' },
              runId: 'run-approval-123',
            },
          },
        },
      },
    ];

    expect(extractRunIdFromMessages(messages)).toBe('run-approval-123');
  });

  it('skips entries without runId and returns a later valid runId', () => {
    const messages: ExtendedMastraUIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [],
        metadata: {
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
        },
      },
    ];

    expect(extractRunIdFromMessages(messages)).toBe('run-later-123');
  });
});
