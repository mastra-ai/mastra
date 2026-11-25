import { describe, expect, it } from 'vitest';
import { agentThreadStreamKey } from '../agent/thread-stream-topic';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { MockMemory } from './mock';

class SignalCleanupMemory extends MockMemory {
  clearSignals(threadId: string, resourceId?: string): Promise<void> {
    return this.clearThreadSignals(threadId, resourceId);
  }
}

const signal = { type: 'user-message', contents: 'hello' };

describe('clearThreadSignals', () => {
  // The rows are seeded under the key the thread runtime builds, so a change to
  // that key that the cleanup does not follow fails here.
  it('deletes the rows and run markers the runtime keyed by the thread', async () => {
    const storage = new InMemoryStore();
    const memory = new SignalCleanupMemory();
    new Mastra({ logger: false, storage, memory: { chat: memory } });
    const agentSignals = (await storage.getStore('agentSignals'))!;
    const key = agentThreadStreamKey('resource-1', 'thread-1');
    const otherKey = agentThreadStreamKey('resource-1', 'thread-2');
    await agentSignals.enqueue({ id: 'leftover', threadKey: key, runId: null, scope: 'pending', signal });
    await agentSignals.closeRun({ threadKey: key, runId: 'run-1', consumedIds: [] });
    await agentSignals.enqueue({ id: 'other', threadKey: otherKey, runId: null, scope: 'pending', signal });

    await memory.clearSignals('thread-1', 'resource-1');

    expect(await agentSignals.listPending({ threadKey: key })).toEqual([]);
    expect(await agentSignals.enqueue({ id: 'after', threadKey: key, runId: 'run-1', scope: 'pending', signal })).toBe(
      'accepted',
    );
    expect((await agentSignals.listPending({ threadKey: otherKey })).map(row => row.id)).toEqual(['other']);
  });
});
