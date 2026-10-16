import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { filterObservedMessages } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';

const threadId = 't-tie';
const resourceId = 'r-tie';

function msg(id: string, createdAt: Date, role: 'user' | 'assistant' = 'assistant'): MastraDBMessage {
  return {
    id,
    role,
    threadId,
    resourceId,
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text: id }] },
  } as MastraDBMessage;
}

function run(messages: MastraDBMessage[], record: any) {
  const list = new MessageList({ threadId, resourceId });
  list.add(messages, 'memory');
  filterObservedMessages({ messageList: list, record });
  return list.get.all.db().map(m => m.id);
}

describe('lastObservedAt millisecond ties (#27261)', () => {
  const tie = new Date('2026-01-01T00:00:01.000Z');
  const earlier = new Date('2026-01-01T00:00:00.000Z');

  it('keeps an unobserved message that shares the cursor millisecond', () => {
    const kept = run([msg('old', earlier, 'user'), msg('a', tie), msg('b', tie)], {
      lastObservedAt: tie,
      observedMessageIds: ['old', 'a'],
    });
    expect(kept).toEqual(['b']);
  });

  it('treats the cursor as inclusive when no observed ids are persisted', () => {
    const kept = run([msg('old', earlier, 'user'), msg('b', tie)], { lastObservedAt: tie });
    expect(kept).toEqual([]);
  });

  it('sends a tied unobserved message to the Observer', () => {
    const om = new ObservationalMemory({
      storage: new InMemoryMemory({ db: new InMemoryDB() }),
      scope: 'thread',
      model: 'openai/gpt-4o-mini',
      observation: { messageTokens: 1, bufferTokens: false },
      reflection: { observationTokens: 1 },
    });
    const all = [msg('old', earlier, 'user'), msg('a', tie), msg('b', tie)];
    const withIds = om.getUnobservedMessages(all, { lastObservedAt: tie, observedMessageIds: ['old', 'a'] } as any);
    expect(withIds.map(m => m.id)).toEqual(['b']);
    const withoutIds = om.getUnobservedMessages(all, { lastObservedAt: tie } as any);
    expect(withoutIds.map(m => m.id)).toEqual([]);
  });
});
