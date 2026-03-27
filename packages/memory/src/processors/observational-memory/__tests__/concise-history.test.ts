import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { formatConciseHistory } from '../concise-history';

function createMessage(message: Partial<MastraDBMessage> & Pick<MastraDBMessage, 'id' | 'role'>): MastraDBMessage {
  return {
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date('2025-01-01T10:00:00.000Z'),
    content: { format: 2, parts: [] },
    ...message,
  } as MastraDBMessage;
}

describe('formatConciseHistory', () => {
  it('renders the same low-detail recall transcript format with timestamps, message ids, and part labels', () => {
    const history = formatConciseHistory(
      [
        createMessage({
          id: 'm1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Need the latest status update' }] } as any,
        }),
        createMessage({
          id: 'm2',
          role: 'assistant',
          createdAt: new Date('2025-01-01T10:01:00.000Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'Here is the newest summary.' }] } as any,
        }),
      ],
      { maxTokens: 200 },
    );

    expect(history).toContain('**user (2025-01-01 10:00:00Z)** [m1]:');
    expect(history).toContain('[p0] Need the latest status update');
    expect(history).toContain('**assistant (2025-01-01 10:01:00Z)** [m2]:');
    expect(history).toContain('[p0] Here is the newest summary.');
  });

  it('keeps the newest rendered messages when over budget', () => {
    const history = formatConciseHistory(
      [
        createMessage({
          id: 'old',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'old context' }] } as any,
        }),
        createMessage({
          id: 'mid',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'middle context' }] } as any,
        }),
        createMessage({
          id: 'new',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'newest context to preserve' }] } as any,
        }),
      ],
      { maxTokens: 30 },
    );

    expect(history).not.toContain('old context');
    expect(history).toContain('newest context to preserve');
  });

  it('renders tool calls, tool results, attachments, and skips data parts in recall format', () => {
    const history = formatConciseHistory(
      [
        createMessage({
          id: 'm1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'tool-invocation', toolInvocation: { toolName: 'web_search', state: 'call' } },
              {
                type: 'tool-invocation',
                toolInvocation: { toolName: 'web_search', state: 'result', result: { items: ['a', 'b'] } },
              },
              { type: 'image', filename: 'diagram.png' },
              { type: 'file', filename: 'report.pdf' },
              { type: 'data-internal', data: { hidden: true } },
            ],
          } as any,
        }),
      ],
      { maxTokens: 200 },
    );

    expect(history).toContain('[Tool Call: web_search]');
    expect(history).toContain('[Tool Result: web_search]');
    expect(history).toContain('[Image: diagram.png]');
    expect(history).toContain('[File: report.pdf]');
    expect(history).not.toContain('data-internal');
  });

  it('returns an empty string for empty or invisible history', () => {
    expect(formatConciseHistory([], { maxTokens: 100 })).toBe('');

    const history = formatConciseHistory(
      [
        createMessage({
          id: 'm1',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'data-internal', data: { ignored: true } }] } as any,
        }),
      ],
      { maxTokens: 100 },
    );

    expect(history).toBe('');
  });
});
