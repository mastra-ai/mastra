import { groupTurns } from '@mastra/playground-ui/components/ThreadRail';
import { describe, expect, it } from 'vitest';

import type { TimelineEntry } from './transcript';
import { replySteps } from './turns';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function message(id: string, role: 'user' | 'assistant'): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: { id, role, createdAt: CREATED_AT, content: { format: 2, parts: [{ type: 'text', text: id }] } },
  };
}

function gap(id: string): TimelineEntry {
  return { kind: 'notice', id, level: 'info', text: id };
}

describe('replySteps', () => {
  it('reads the steps of a reply the server cut in two as one answer', () => {
    const [turn] = groupTurns(
      [
        message('user-1', 'user'),
        message('assistant-1', 'assistant'),
        gap('notice-1'),
        message('assistant-2', 'assistant'),
      ],
      {
        key: entry => entry.id,
        opensTurn: entry => entry.kind === 'message' && entry.message.role === 'user',
        introduces: entry => entry.kind === 'notice',
      },
    );

    expect(replySteps(turn).map(step => step.id)).toEqual(['assistant-1', 'assistant-2']);
  });
});
