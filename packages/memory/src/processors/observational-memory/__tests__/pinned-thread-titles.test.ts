import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationStrategy } from '../observation-strategies';
import { ObservationalMemory } from '../observational-memory';

describe.each(['sync', 'async-buffer', 'resource-scoped'] as const)('%s title persistence', mode => {
  it.each([undefined, false, true])('respects titlePinned=%s without dropping observer metadata', async titlePinned => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const threadId = 'title-thread';
    const resourceId = 'title-resource';
    const scope = mode === 'resource-scoped' ? 'resource' : 'thread';
    const createdAt = new Date('2025-01-01T08:00:00Z');
    const lastObservedAt = new Date('2025-01-01T09:00:00Z');
    const threadTitle = '  Generated title  ';
    for (const id of [threadId, 'other-thread']) {
      await storage.saveThread({
        thread: { id, resourceId, title: 'Initial title', createdAt, updatedAt: createdAt },
      });
    }
    const record = await storage.initializeObservationalMemory({ threadId, resourceId, scope, config: {} });
    const om = new ObservationalMemory({
      storage,
      scope,
      model: new MockLanguageModelV2(),
      observation: { threadTitle: true },
    });
    const custom = vi.fn().mockResolvedValue(undefined);
    const strategy = ObservationStrategy.create(om, {
      record,
      threadId,
      resourceId,
      messages: [],
      ...(mode === 'async-buffer' ? { cycleId: 'title-cycle' } : {}),
      writer: { custom },
    });

    // Rename after creating the strategy, as a user can do while the observer is running.
    await storage.patchThread({
      id: threadId,
      title: 'My chosen title',
      metadata: {
        custom: 'keep',
        mastra: { ...(titlePinned === undefined ? {} : { titlePinned }), om: { extracted: { prior: 'keep' } } },
      },
    });
    await strategy.persist({
      observations: '- User is building a dashboard',
      observationTokens: 10,
      cycleObservationTokens: 10,
      observedMessageIds: [],
      lastObservedAt,
      threadTitle,
      threadMetadataUpdates: [threadId, 'other-thread'].map(id => ({
        threadId: id,
        threadTitle,
        lastObservedAt: lastObservedAt.toISOString(),
      })),
    });

    expect(await storage.getThreadById({ threadId })).toMatchObject({
      title: titlePinned ? 'My chosen title' : 'Generated title',
      metadata: { custom: 'keep', mastra: { om: { threadTitle, extracted: { prior: 'keep' } } } },
    });
    const titleUpdates = custom.mock.calls
      .map(([part]) => part)
      .filter(part => part.type === 'data-om-thread-update' && part.data.threadId === threadId);
    expect(titleUpdates).toHaveLength(titlePinned ? 0 : 1);

    if (mode === 'resource-scoped') {
      // Pinning one thread must not disable automatic titles for another thread in the resource.
      expect((await storage.getThreadById({ threadId: 'other-thread' }))?.title).toBe('Generated title');
    }
  });
});
