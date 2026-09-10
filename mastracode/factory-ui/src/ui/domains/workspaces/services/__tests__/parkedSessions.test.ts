import { describe, expect, it } from 'vitest';

import type { FactoryAttentionItem } from '../../../factory/services/attention';
import { parkedSessionIdsFrom } from '../parkedSessions';

function parked(overrides: Partial<FactoryAttentionItem> & { sessionId?: string } = {}): FactoryAttentionItem {
  const sessionId = overrides.sessionId ?? 'session-1';
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}`,
    occurrence: 1,
    workItemId: null,
    title: 'Waiting on a plan',
    detail: 'submit_plan',
    occurredAt: '2026-07-20T00:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: sessionId, list: 'user' },
    sessionId,
    threadId: sessionId,
    role: 'user',
    toolName: 'submit_plan',
    ...overrides,
  } as FactoryAttentionItem;
}

describe('parkedSessionIdsFrom', () => {
  it('names the session an agent is parked in', () => {
    expect([...parkedSessionIdsFrom([parked({ sessionId: 'session-a' })])]).toEqual(['session-a']);
  });

  it('keeps a read park: the answer is still owed until the park lifts', () => {
    expect([...parkedSessionIdsFrom([parked({ read: true })])]).toEqual(['session-1']);
  });

  it('drops an archived park: that one has been settled', () => {
    expect(parkedSessionIdsFrom([parked({ archived: true })]).size).toBe(0);
  });

  it('ignores kinds that are not a park', () => {
    const mention = parked({
      kind: 'mention',
      commentId: '11111111-1111-4111-8111-111111111111',
      authorId: 'user-2',
    } as Partial<FactoryAttentionItem>);
    expect(parkedSessionIdsFrom([mention]).size).toBe(0);
  });

  it('names a session once however many parks it carries', () => {
    expect([...parkedSessionIdsFrom([parked({ occurrence: 1 }), parked({ occurrence: 2 })])]).toEqual(['session-1']);
  });
});
