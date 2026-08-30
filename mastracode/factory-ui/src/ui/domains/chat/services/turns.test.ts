import { describe, expect, it } from 'vitest';

import type { TimelineEntry } from './transcript';
import { groupTurns, replySteps } from './turns';

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

const opensTurn = (entry: TimelineEntry) => entry.kind === 'message' && entry.message.role === 'user';
const isGap = (entry: TimelineEntry | undefined) => entry?.kind === 'notice';

describe('turns', () => {
  it('hangs a run under the message that asked for it', () => {
    const groups = groupTurns(
      [message('user-1', 'user'), message('assistant-1', 'assistant'), message('user-2', 'user')],
      opensTurn,
      isGap,
    );

    expect(groups.map(group => group.entries.map(entry => entry.id))).toEqual([['user-1', 'assistant-1'], ['user-2']]);
    expect(groups.map(group => group.opensTurn)).toEqual([true, true]);
  });

  it('moves a gap down into the turn it introduces', () => {
    const groups = groupTurns([message('user-1', 'user'), gap('gap-1'), message('user-2', 'user')], opensTurn, isGap);

    expect(groups.map(group => group.entries.map(entry => entry.id))).toEqual([['user-1'], ['gap-1', 'user-2']]);
  });

  it('reads the steps of a reply the server cut in two as one answer', () => {
    const [turn] = groupTurns(
      [
        message('user-1', 'user'),
        message('assistant-1', 'assistant'),
        gap('notice-1'),
        message('assistant-2', 'assistant'),
      ],
      opensTurn,
      isGap,
    );

    expect(replySteps(turn).map(step => step.id)).toEqual(['assistant-1', 'assistant-2']);
  });
});
