import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../memory/types';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

// No public method returns a row's stored thread or resource, so these read the maps.
describe('InMemoryMemory pending-signal rows', () => {
  async function storeWithRun() {
    const db = new InMemoryDB();
    const memory = new InMemoryMemory({ db });
    const thread = { id: 'thread-1', resourceId: 'resource-1', createdAt: new Date(), updatedAt: new Date() };
    await memory.saveThread({ thread });
    await memory.setSignalRun({ threadId: thread.id, runId: 'run-1' });
    const signal = (id: string, transient = false) =>
      ({
        id,
        threadId: thread.id,
        resourceId: thread.resourceId,
        role: 'signal',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'hello' }],
          ...(transient && { metadata: { signal: { transient: true } } }),
        },
      }) as MastraDBMessage;
    const stored = (id: string) => {
      const row = db.messages.get(id);
      if (!row) return undefined;
      const { thread_id, resourceId, signalClaimedBy, signalState } = row;
      return { thread_id, resourceId, signalClaimedBy, signalState: signalState ?? null };
    };
    return { memory, thread, signal, stored };
  }

  it('keeps a pending row under the pending-signal thread id, then the claim moves it to the thread', async () => {
    const { memory, thread, signal, stored } = await storeWithRun();
    const message = signal('signal-1');

    expect(await memory.enqueuePendingSignal({ message, toRunId: 'run-1' })).toBe('accepted');
    expect(stored(message.id)).toEqual({
      thread_id: 'mastra-pending-signals:thread-1',
      resourceId: null,
      signalClaimedBy: null,
      signalState: null,
    });

    await memory.claimPendingSignals({ threadId: thread.id, runId: 'run-1', consumedIds: [] });
    expect(stored(message.id)).toEqual({
      thread_id: 'thread-1',
      resourceId: 'resource-1',
      signalClaimedBy: 'run-1',
      signalState: 'taken',
    });

    await memory.saveMessages({ messages: [message] });
    expect(stored(message.id)).toEqual({
      thread_id: 'thread-1',
      resourceId: 'resource-1',
      signalClaimedBy: 'run-1',
      signalState: null,
    });
  });

  it('leaves a taken transient row under the pending-signal thread id', async () => {
    const { memory, thread, signal, stored } = await storeWithRun();
    const message = signal('transient-1', true);

    await memory.enqueuePendingSignal({ message, toRunId: 'run-1' });
    await memory.claimPendingSignals({ threadId: thread.id, runId: 'run-1', consumedIds: [] });
    expect(stored(message.id)).toEqual({
      thread_id: 'mastra-pending-signals:thread-1',
      resourceId: null,
      signalClaimedBy: 'run-1',
      signalState: 'transient',
    });

    await memory.closeSignalRun({ threadId: thread.id, runId: 'run-1', consumedIds: [] });
    expect(stored(message.id)).toEqual({
      thread_id: 'mastra-pending-signals:thread-1',
      resourceId: null,
      signalClaimedBy: null,
      signalState: 'transient',
    });
  });

  it('moves a taken row nobody consumed back under the pending-signal thread id at close', async () => {
    const { memory, thread, signal, stored } = await storeWithRun();
    const message = signal('signal-1');

    await memory.enqueuePendingSignal({ message, toRunId: 'run-1' });
    await memory.claimPendingSignals({ threadId: thread.id, runId: 'run-1', consumedIds: [] });
    await memory.closeSignalRun({ threadId: thread.id, runId: 'run-1', consumedIds: [] });

    expect(stored(message.id)).toEqual({
      thread_id: 'mastra-pending-signals:thread-1',
      resourceId: null,
      signalClaimedBy: null,
      signalState: null,
    });
  });
});

// A database filled by code that predates pending signals, such as a snapshot
// loaded into InMemoryDB, has message rows without the signal fields.
describe('InMemoryMemory with message rows that lack the signal fields', () => {
  async function storeWithLegacyRow() {
    const db = new InMemoryDB();
    const memory = new InMemoryMemory({ db });
    const thread = { id: 'thread-1', resourceId: 'resource-1', createdAt: new Date(), updatedAt: new Date() };
    await memory.saveThread({ thread });
    db.messages.set('legacy-1', {
      id: 'legacy-1',
      thread_id: thread.id,
      resourceId: thread.resourceId,
      role: 'user',
      type: 'text',
      content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'hello' }] }),
      createdAt: new Date(),
    });
    return { memory, thread };
  }

  it('reads them as messages', async () => {
    const { memory, thread } = await storeWithLegacyRow();

    const { messages } = await memory.listMessages({ threadId: thread.id });
    expect(messages.map(message => message.id)).toEqual(['legacy-1']);
    expect((await memory.listMessagesById({ messageIds: ['legacy-1'] })).messages).toHaveLength(1);
    expect(await memory.listPendingSignals({ threadId: thread.id })).toEqual([]);
  });

  it('leaves them alone when a run claims or closes', async () => {
    const { memory, thread } = await storeWithLegacyRow();
    await memory.setSignalRun({ threadId: thread.id, runId: 'run-1' });

    expect(await memory.claimPendingSignals({ threadId: thread.id, runId: 'run-1', consumedIds: [] })).toEqual([]);
    await memory.closeSignalRun({ threadId: thread.id, runId: 'run-1', consumedIds: ['legacy-1'] });

    const { messages } = await memory.listMessages({ threadId: thread.id });
    expect(messages.map(message => message.id)).toEqual(['legacy-1']);
  });
});
