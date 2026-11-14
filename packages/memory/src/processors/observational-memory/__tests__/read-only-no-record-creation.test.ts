import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

const THREAD_ID = 'read-only-thread';
const RESOURCE_ID = 'read-only-resource';

function createStorage() {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  const initialize = vi.spyOn(storage, 'initializeObservationalMemory');
  return { storage, initialize };
}

function createOm(storage: InMemoryMemory, scope: 'thread' | 'resource' = 'thread') {
  return new ObservationalMemory({
    storage,
    scope,
    model: new MockLanguageModelV2({}) as any,
    observation: { messageTokens: 100, bufferTokens: false },
    reflection: { observationTokens: 50_000 },
  });
}

function createMessages(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }] },
    createdAt: new Date(Date.UTC(2026, 0, 1, 10, 0, i)),
  })) as MastraDBMessage[];
}

describe('message-only Observational Memory reads do not create a record', () => {
  for (const scope of ['thread', 'resource'] as const) {
    describe(`${scope} scope`, () => {
      const ids = scope === 'thread' ? [THREAD_ID, undefined] : [null, RESOURCE_ID];

      it('loadUnobservedMessages returns the stored history without persisting', async () => {
        const { storage, initialize } = createStorage();
        const om = createOm(storage, scope);
        await storage.saveMessages({ messages: createMessages(6) });

        const loaded = await om.loadUnobservedMessages({ threadId: THREAD_ID, resourceId: RESOURCE_ID });

        expect(loaded.map(m => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5']);
        expect(initialize).not.toHaveBeenCalled();
      });

      it('pruneObserved returns every message when nothing is observed, without persisting', async () => {
        const { storage, initialize } = createStorage();
        const om = createOm(storage, scope);
        const messages = createMessages(4);

        const pruned = await om.pruneObserved({ threadId: THREAD_ID, resourceId: RESOURCE_ID, messages });

        expect(pruned.map(m => m.id)).toEqual(messages.map(m => m.id));
        expect(initialize).not.toHaveBeenCalled();
      });
    });
  }

  it('still reads an existing record', async () => {
    const { storage } = createStorage();
    const om = createOm(storage);
    const created = await om.getOrCreateRecord(THREAD_ID, RESOURCE_ID);
    await storage.saveMessages({ messages: createMessages(3) });

    const status = await om.getStatus({ threadId: THREAD_ID, resourceId: RESOURCE_ID });

    expect(status.record.id).toBe(created.id);
  });

  it('write paths still create the record', async () => {
    const { storage, initialize } = createStorage();
    const om = createOm(storage);

    const record = await om.getOrCreateRecord(THREAD_ID, RESOURCE_ID);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(await storage.getObservationalMemory(THREAD_ID, null as any)).not.toBeNull();
    expect(record.id).not.toMatch(/^unpersisted:/);
  });
});
