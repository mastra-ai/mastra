import { describe, expect, it } from 'vitest';

import type { FactoryAttentionItem } from '../../../factory/services/attention';
import { unreadSessionIds } from '../unreadSessions';

function parked(overrides: Partial<FactoryAttentionItem> & { sessionId?: string } = {}): FactoryAttentionItem {
  const sessionId = overrides.sessionId ?? 'session-1';
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}`,
    occurrence: 1,
    workItemId: 'item-1',
    title: 'Waiting on a plan',
    detail: 'submit_plan',
    occurredAt: '2026-07-20T00:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: `${sessionId}-thread` },
    sessionId,
    threadId: `${sessionId}-thread`,
    role: 'plan',
    toolName: 'submit_plan',
    ...overrides,
  } as FactoryAttentionItem;
}

describe('unreadSessionIds', () => {
  it('names the session an unread thread item is owed on', () => {
    expect([...unreadSessionIds([parked({ sessionId: 'session-a' })])]).toEqual(['session-a']);
  });

  it('drops items already seen or settled', () => {
    expect(unreadSessionIds([parked({ read: true })]).size).toBe(0);
    expect(unreadSessionIds([parked({ archived: true })]).size).toBe(0);
  });

  it('ignores targets that name no session', () => {
    const card = parked({ target: { kind: 'work-item', workItemId: 'item-1', board: 'work' } });
    const rules = parked({ target: { kind: 'rules' } });
    expect(unreadSessionIds([card, rules]).size).toBe(0);
  });

  it('marks a session once however much it is owed', () => {
    const items = [parked({ occurrence: 1 }), parked({ occurrence: 2 })];
    expect([...unreadSessionIds(items)]).toEqual(['session-1']);
  });
});
