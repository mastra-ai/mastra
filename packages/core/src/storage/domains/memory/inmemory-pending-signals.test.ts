import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../memory/types';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

// No public method returns a row's stored thread or resource, so these read the maps.
describe('InMemoryMemory pending-signal rows', () => {
  it('keeps a signal under the pending id, then the taken id, without a resource, until the save', async () => {
    const db = new InMemoryDB();
    const memory = new InMemoryMemory({ db });
    const thread = { id: 'thread-1', resourceId: 'resource-1', createdAt: new Date(), updatedAt: new Date() };
    await memory.saveThread({ thread });
    await memory.setSignalRun({ threadId: thread.id, runId: 'run-1' });
    const message = {
      id: 'signal-1',
      threadId: thread.id,
      resourceId: thread.resourceId,
      role: 'signal',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    } as MastraDBMessage;
    const stored = () => {
      const { thread_id, resourceId } = db.messages.get(message.id)!;
      return { thread_id, resourceId };
    };

    expect(await memory.enqueuePendingSignal({ message, toRunId: 'run-1' })).toBe('accepted');
    expect(stored()).toEqual({ thread_id: 'mastra-queue:pending:thread-1', resourceId: null });

    await memory.claimPendingSignals({ threadId: thread.id, runId: 'run-1', consumedIds: [] });
    expect(stored()).toEqual({ thread_id: 'mastra-queue:taken:thread-1', resourceId: null });

    await memory.saveMessages({ messages: [message] });
    expect(stored()).toEqual({ thread_id: 'thread-1', resourceId: 'resource-1' });
  });
});
