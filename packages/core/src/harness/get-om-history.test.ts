import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import type { ObservationalMemoryRecord } from '../storage/types';
import { Harness } from './harness';

function createHarness(storage: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

function omRecord(overrides: Partial<ObservationalMemoryRecord> & { id: string }): ObservationalMemoryRecord {
  return {
    scope: 'thread',
    threadId: '',
    resourceId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    originType: 'initial',
    generationCount: 0,
    activeObservations: '',
    totalTokensObserved: 0,
    observationTokenCount: 0,
    pendingMessageTokens: 0,
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: {},
    ...overrides,
  };
}

describe('Harness.getObservationalMemoryHistory', () => {
  let storage: InMemoryStore;
  let harness: ReturnType<typeof createHarness>;

  beforeEach(async () => {
    storage = new InMemoryStore();
    harness = createHarness(storage);
    await harness.init();
  });

  it('returns [] when no thread is selected', async () => {
    const history = await harness.getObservationalMemoryHistory();
    expect(history).toEqual([]);
  });

  it('returns [] when no OM record exists for the thread', async () => {
    await harness.createThread();
    const history = await harness.getObservationalMemoryHistory();
    expect(history).toEqual([]);
  });

  it('returns [] when only the current OM record exists (no prior generations)', async () => {
    const thread = await harness.createThread();
    const resourceId = harness.getResourceId();
    const memoryStorage = (await storage.getStore('memory'))!;

    // Initialize OM — this creates the "current" record at generationCount 0
    const current = await memoryStorage.initializeObservationalMemory({
      threadId: thread.id,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await memoryStorage.updateActiveObservations({
      id: current.id,
      observations: 'current observations',
      tokenCount: 20,
      lastObservedAt: new Date(),
    });

    const history = await harness.getObservationalMemoryHistory();
    expect(history).toEqual([]);
  });

  it('excludes the current OM record and returns only prior generations', async () => {
    const thread = await harness.createThread();
    const resourceId = harness.getResourceId();
    const memoryStorage = (await storage.getStore('memory'))!;

    // Create the "current" OM record (generationCount = 0, stored at index 0)
    const current = await memoryStorage.initializeObservationalMemory({
      threadId: thread.id,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await memoryStorage.updateActiveObservations({
      id: current.id,
      observations: 'current observations',
      tokenCount: 20,
      lastObservedAt: new Date(),
    });

    // Insert older records with lower generationCounts
    await memoryStorage.insertObservationalMemoryRecord(
      omRecord({
        id: 'gen-2',
        threadId: thread.id,
        resourceId,
        generationCount: -2,
        activeObservations: 'generation -2',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      }),
    );
    await memoryStorage.insertObservationalMemoryRecord(
      omRecord({
        id: 'gen-1',
        threadId: thread.id,
        resourceId,
        generationCount: -1,
        activeObservations: 'generation -1',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
      }),
    );

    const history = await harness.getObservationalMemoryHistory();
    // Should include only gen-1 and gen-2, not the current record
    expect(history).toHaveLength(2);
    // Should be newest-first: gen-1 (genCount -1) comes before gen-2 (genCount -2)
    expect(history[0]!.id).toBe('gen-1');
    expect(history[1]!.id).toBe('gen-2');
  });

  it('preserves newest-first order regardless of insertion order', async () => {
    const thread = await harness.createThread();
    const resourceId = harness.getResourceId();
    const memoryStorage = (await storage.getStore('memory'))!;

    const current = await memoryStorage.initializeObservationalMemory({
      threadId: thread.id,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await memoryStorage.updateActiveObservations({
      id: current.id,
      observations: 'current',
      tokenCount: 10,
      lastObservedAt: new Date(),
    });

    // Insert out of order
    await memoryStorage.insertObservationalMemoryRecord(
      omRecord({
        id: 'gen-oldest',
        threadId: thread.id,
        resourceId,
        generationCount: -10,
        activeObservations: 'oldest',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }),
    );
    await memoryStorage.insertObservationalMemoryRecord(
      omRecord({
        id: 'gen-middle',
        threadId: thread.id,
        resourceId,
        generationCount: -5,
        activeObservations: 'middle',
        createdAt: new Date('2025-06-01'),
        updatedAt: new Date('2025-06-01'),
      }),
    );
    await memoryStorage.insertObservationalMemoryRecord(
      omRecord({
        id: 'gen-recent',
        threadId: thread.id,
        resourceId,
        generationCount: -2,
        activeObservations: 'recent',
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
      }),
    );

    const history = await harness.getObservationalMemoryHistory();
    expect(history).toHaveLength(3);
    expect(history[0]!.id).toBe('gen-recent');
    expect(history[1]!.id).toBe('gen-middle');
    expect(history[2]!.id).toBe('gen-oldest');
  });

  it('honors limit after filtering out the current record', async () => {
    const thread = await harness.createThread();
    const resourceId = harness.getResourceId();
    const memoryStorage = (await storage.getStore('memory'))!;

    const current = await memoryStorage.initializeObservationalMemory({
      threadId: thread.id,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await memoryStorage.updateActiveObservations({
      id: current.id,
      observations: 'current',
      tokenCount: 10,
      lastObservedAt: new Date(),
    });

    // Insert 3 older records
    for (let i = 1; i <= 3; i++) {
      await memoryStorage.insertObservationalMemoryRecord(
        omRecord({
          id: `gen-${i}`,
          threadId: thread.id,
          resourceId,
          generationCount: -i,
          activeObservations: `generation ${i}`,
          createdAt: new Date(`2026-0${i}-01`),
          updatedAt: new Date(`2026-0${i}-01`),
        }),
      );
    }

    // Request limit of 2 — should return only the 2 most recent prior records
    const history = await harness.getObservationalMemoryHistory({ limit: 2 });
    expect(history).toHaveLength(2);
    // Newest-first: gen-1, gen-2 (current gen-0 is excluded)
    expect(history[0]!.id).toBe('gen-1');
    expect(history[1]!.id).toBe('gen-2');
  });

  it('returns thread-specific history after switching threads', async () => {
    const threadA = await harness.createThread();
    const threadB = await harness.createThread();
    const resourceId = harness.getResourceId();
    const memoryStorage = (await storage.getStore('memory'))!;

    // Seed OM for thread A
    const currentA = await memoryStorage.initializeObservationalMemory({
      threadId: threadA.id,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await memoryStorage.updateActiveObservations({
      id: currentA.id,
      observations: 'thread A current',
      tokenCount: 10,
      lastObservedAt: new Date(),
    });
    await memoryStorage.insertObservationalMemoryRecord(
      omRecord({
        id: 'a-gen-old',
        threadId: threadA.id,
        resourceId,
        generationCount: -1,
        activeObservations: 'thread A old',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }),
    );

    // Seed OM for thread B
    const currentB = await memoryStorage.initializeObservationalMemory({
      threadId: threadB.id,
      resourceId,
      scope: 'thread',
      config: {},
    });
    await memoryStorage.updateActiveObservations({
      id: currentB.id,
      observations: 'thread B current',
      tokenCount: 10,
      lastObservedAt: new Date(),
    });

    // Should be on thread B
    const historyB = await harness.getObservationalMemoryHistory();
    expect(historyB).toEqual([]);

    // Switch to thread A
    await harness.switchThread({ threadId: threadA.id });
    const historyA = await harness.getObservationalMemoryHistory();
    expect(historyA).toHaveLength(1);
    expect(historyA[0]!.id).toBe('a-gen-old');
  });
});
