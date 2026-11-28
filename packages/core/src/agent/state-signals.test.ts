import { describe, expect, it } from 'vitest';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { MessageList } from './message-list';
import { createSignal } from './signals';
import { applyStateSignal, resolveStateSignalHistory } from './state-signals';

const threadId = 'thread-1';
const resourceId = 'resource-1';
const stateId = 'browser';

function stateSnapshot(id: string, createdAt: string) {
  return createSignal({
    id,
    type: 'state',
    contents: `state ${id}`,
    createdAt,
    metadata: { state: { id: stateId, threadId, cacheKey: `browser:${id}`, mode: 'snapshot', version: 1 } },
  });
}

describe('resolveStateSignalHistory', () => {
  // A state signal tracked in the thread's metadata can still be queued for the thread, not yet
  // saved. A read by id returns its row under the thread's reserved queue id; it is not part of
  // the thread's history until a run saves it.
  it('leaves a state signal that is still queued for the thread out of its stored history', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const memoryStore = (await storage.getStore('memory'))!;
    await memoryStore.saveThread({
      thread: { id: threadId, resourceId, title: '', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
    });

    const saved = stateSnapshot('saved-snapshot', '2026-01-01T00:00:00.000Z');
    const queued = stateSnapshot('queued-snapshot', '2026-01-01T00:00:01.000Z');
    await memoryStore.saveMessages({ messages: [saved.toDBMessage({ threadId, resourceId })] });
    await memoryStore.enqueuePendingSignal({ message: queued.toDBMessage({ threadId, resourceId }) });

    const history = await resolveStateSignalHistory({
      messageList: new MessageList({ threadId, resourceId }),
      memory,
      threadId,
      stateId,
      tracking: { lastSnapshotSignalId: queued.id, activeCopies: [{ id: saved.id }, { id: queued.id }] },
    });

    expect(history.activeStateSignals.map(signal => signal.id)).toEqual([saved.id]);
    expect(history.lastSnapshot?.id).toBe(saved.id);
  });
});

describe('applyStateSignal', () => {
  // A message list built without a thread id holds signals without one.
  it('skips a state signal identical to the one already in a message list without a thread id', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const thread = await memory.saveThread({
      thread: { id: threadId, resourceId, title: '', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
    });
    const messageList = new MessageList();
    const input = { id: stateId, cacheKey: 'browser:v1', contents: 'the browser state' };

    const first = await applyStateSignal({ input, memory, thread, resourceId, threadId, messageList });
    expect(first.skipped).toBe(false);

    const saved = (await memory.getThreadById({ threadId }))!;
    const second = await applyStateSignal({ input, memory, thread: saved, resourceId, threadId, messageList });
    expect(second).toMatchObject({ skipped: true, reason: 'unchanged' });
  });
});
