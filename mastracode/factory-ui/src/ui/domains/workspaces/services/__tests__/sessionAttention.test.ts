import { describe, expect, it } from 'vitest';

import type { FactoryAttentionItem } from '../../../factory/services/attention';
import { unreadItemsForSession } from '../sessionAttention';

function parked(overrides: Partial<FactoryAttentionItem> & { sessionId?: string } = {}): FactoryAttentionItem {
  const sessionId = overrides.sessionId ?? 'session-1';
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}:${overrides.occurrence ?? 1}`,
    occurrence: 1,
    workItemId: null,
    title: 'Waiting on you',
    detail: 'Agent is waiting for an answer',
    occurredAt: '2026-07-20T00:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: sessionId },
    sessionId,
    threadId: sessionId,
    role: 'user',
    toolName: 'ask_user',
    ...overrides,
  } as FactoryAttentionItem;
}

describe('unreadItemsForSession', () => {
  it('picks the unread items aimed at this session', () => {
    const mine = parked({ sessionId: 'session-a' });
    expect(unreadItemsForSession([mine], 'session-a')).toEqual([mine]);
  });

  it('leaves another session alone', () => {
    expect(unreadItemsForSession([parked({ sessionId: 'session-b' })], 'session-a')).toEqual([]);
  });

  it('skips items already seen or settled', () => {
    expect(unreadItemsForSession([parked({ read: true })], 'session-1')).toEqual([]);
    expect(unreadItemsForSession([parked({ archived: true })], 'session-1')).toEqual([]);
  });

  it('skips targets that name no session', () => {
    const card = parked({ target: { kind: 'work-item', workItemId: 'item-1', board: 'work' } });
    const rules = parked({ target: { kind: 'rules' } });
    expect(unreadItemsForSession([card, rules], 'session-1')).toEqual([]);
  });

  it('returns every unread item the session owes, not just the newest', () => {
    const items = [parked({ occurrence: 1 }), parked({ occurrence: 2 })];
    expect(unreadItemsForSession(items, 'session-1')).toHaveLength(2);
  });
});
