import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage, ObservationalMemoryRecord, BufferedObservationChunk } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Memory } from './index';

/**
 * Helper to get the InMemoryMemory storage domain from a Memory instance.
 */
async function getMemoryStore(memory: Memory): Promise<MemoryStorage> {
  return (await memory.storage.getStore('memory'))!;
}

describe('cloneThread – Observational Memory', () => {
  let memory: Memory;
  const resourceId = 'om-test-resource';

  beforeEach(() => {
    memory = new Memory({
      storage: new InMemoryStore(),
    });
  });

  /**
   * Helper: create a thread with messages and return the IDs.
   */
  async function seedThread(threadId: string, messageCount: number) {
    const thread = await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'OM Test Thread',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });

    const messages: MastraDBMessage[] = [];
    for (let i = 0; i < messageCount; i++) {
      messages.push({
        id: `msg-${threadId}-${i}`,
        threadId,
        resourceId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: `Message ${i}` }] },
        createdAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      });
    }
    await memory.saveMessages({ messages });
    return { thread, messages };
  }

  /**
   * Helper: seed a thread-scoped OM record with data.
   */
  async function seedThreadScopedOM(
    memoryStore: MemoryStorage,
    threadId: string,
    overrides: Partial<ObservationalMemoryRecord> = {},
  ) {
    const record = await memoryStore.initializeObservationalMemory({
      threadId,
      resourceId,
      scope: 'thread',
      config: {},
    });
    // Apply overrides to the stored record (InMemory stores by reference)
    Object.assign(record, overrides);
    return record;
  }

  /**
   * Helper: seed a resource-scoped OM record with data.
   */
  async function seedResourceScopedOM(memoryStore: MemoryStorage, overrides: Partial<ObservationalMemoryRecord> = {}) {
    const record = await memoryStore.initializeObservationalMemory({
      threadId: null,
      resourceId,
      scope: 'resource',
      config: {},
    });
    Object.assign(record, overrides);
    return record;
  }

  describe('thread-scoped OM', () => {
    it('should clone OM with remapped observedMessageIds', async () => {
      await seedThread('src-thread-1', 4);
      const memoryStore = await getMemoryStore(memory);

      // Seed OM with some observed message IDs
      const seededOM = await seedThreadScopedOM(memoryStore, 'src-thread-1', {
        activeObservations: '* User asked about weather\n* Assistant provided forecast',
        observationTokenCount: 20,
        totalTokensObserved: 100,
        lastObservedAt: new Date('2024-01-01T10:02:00Z'),
        observedMessageIds: ['msg-src-thread-1-0', 'msg-src-thread-1-1', 'msg-src-thread-1-2'],
      });

      // Clone the thread
      const { thread: clonedThread, messageIdMap } = await memory.cloneThread({
        sourceThreadId: 'src-thread-1',
      });

      // Verify cloned OM exists on the new thread
      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).not.toBeNull();
      expect(clonedOM!.id).not.toBe(seededOM.id); // New ID
      expect(clonedOM!.threadId).toBe(clonedThread.id);
      expect(clonedOM!.resourceId).toBe(resourceId);
      expect(clonedOM!.scope).toBe('thread');
      expect(clonedOM!.activeObservations).toBe('* User asked about weather\n* Assistant provided forecast');
      expect(clonedOM!.observationTokenCount).toBe(20);
      expect(clonedOM!.totalTokensObserved).toBe(100);

      // Verify observedMessageIds are remapped
      expect(clonedOM!.observedMessageIds).toHaveLength(3);
      for (const id of clonedOM!.observedMessageIds!) {
        // None of the IDs should be source IDs
        expect(id).not.toMatch(/^msg-src-thread-1-/);
      }
      // Each remapped ID should match via the returned messageIdMap
      expect(messageIdMap).toBeDefined();
      expect(clonedOM!.observedMessageIds).toEqual([
        messageIdMap!['msg-src-thread-1-0'],
        messageIdMap!['msg-src-thread-1-1'],
        messageIdMap!['msg-src-thread-1-2'],
      ]);

      // Source OM should still exist unmodified
      const sourceOM = await memoryStore.getObservationalMemory('src-thread-1', resourceId);
      expect(sourceOM).not.toBeNull();
      expect(sourceOM!.observedMessageIds).toEqual(['msg-src-thread-1-0', 'msg-src-thread-1-1', 'msg-src-thread-1-2']);
    });

    it('should clone OM with remapped bufferedObservationChunks messageIds', async () => {
      await seedThread('src-thread-2', 4);
      const memoryStore = await getMemoryStore(memory);

      const chunks: BufferedObservationChunk[] = [
        {
          id: 'chunk-1',
          cycleId: 'cycle-1',
          observations: '* Chunk 1 observation',
          tokenCount: 10,
          messageIds: ['msg-src-thread-2-0', 'msg-src-thread-2-1'],
          messageTokens: 50,
          lastObservedAt: new Date('2024-01-01T10:01:00Z'),
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'chunk-2',
          cycleId: 'cycle-2',
          observations: '* Chunk 2 observation',
          tokenCount: 12,
          messageIds: ['msg-src-thread-2-2', 'msg-src-thread-2-3'],
          messageTokens: 60,
          lastObservedAt: new Date('2024-01-01T10:03:00Z'),
          createdAt: new Date('2024-01-01T10:03:00Z'),
        },
      ];

      await seedThreadScopedOM(memoryStore, 'src-thread-2', {
        activeObservations: '* Active observations',
        bufferedObservationChunks: chunks,
        observedMessageIds: ['msg-src-thread-2-0', 'msg-src-thread-2-1'],
      });

      const { thread: clonedThread, messageIdMap } = await memory.cloneThread({
        sourceThreadId: 'src-thread-2',
      });

      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).not.toBeNull();

      // Verify chunks are present and messageIds are remapped
      expect(clonedOM!.bufferedObservationChunks).toHaveLength(2);
      expect(messageIdMap).toBeDefined();

      const clonedChunk1 = clonedOM!.bufferedObservationChunks![0]!;
      expect(clonedChunk1.observations).toBe('* Chunk 1 observation');
      expect(clonedChunk1.messageIds).toEqual([
        messageIdMap!['msg-src-thread-2-0'],
        messageIdMap!['msg-src-thread-2-1'],
      ]);

      const clonedChunk2 = clonedOM!.bufferedObservationChunks![1]!;
      expect(clonedChunk2.observations).toBe('* Chunk 2 observation');
      expect(clonedChunk2.messageIds).toEqual([
        messageIdMap!['msg-src-thread-2-2'],
        messageIdMap!['msg-src-thread-2-3'],
      ]);
    });

    it('should reset transient state flags on cloned OM', async () => {
      await seedThread('src-thread-3', 2);
      const memoryStore = await getMemoryStore(memory);

      await seedThreadScopedOM(memoryStore, 'src-thread-3', {
        activeObservations: '* Some observation',
        isObserving: true,
        isReflecting: true,
        isBufferingObservation: true,
        isBufferingReflection: true,
      });

      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: 'src-thread-3',
      });

      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).not.toBeNull();
      expect(clonedOM!.isObserving).toBe(false);
      expect(clonedOM!.isReflecting).toBe(false);
      expect(clonedOM!.isBufferingObservation).toBe(false);
      expect(clonedOM!.isBufferingReflection).toBe(false);
    });

    it('should handle malformed observedMessageIds without throwing', async () => {
      await seedThread('src-thread-3b', 2);
      const memoryStore = await getMemoryStore(memory);

      await seedThreadScopedOM(memoryStore, 'src-thread-3b', {
        activeObservations: '* Some observation',
        observedMessageIds: 'msg-src-thread-3b-0' as any,
        bufferedMessageIds: { bad: true } as any,
        bufferedObservationChunks: [
          {
            id: 'chunk-malformed',
            cycleId: 'cycle-malformed',
            observations: '* malformed chunk',
            tokenCount: 1,
            messageIds: 'msg-src-thread-3b-1' as any,
            messageTokens: 1,
            lastObservedAt: new Date('2024-01-01T10:01:00Z'),
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
        ] as any,
      });

      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: 'src-thread-3b',
      });

      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).not.toBeNull();
      expect(clonedOM!.observedMessageIds).toBeUndefined();
      expect(clonedOM!.bufferedMessageIds).toBeUndefined();
      expect(clonedOM!.bufferedObservationChunks?.[0]?.messageIds).toEqual([]);
    });
  });

  describe('multi-generation OM history', () => {
    it('should clone only the current OM generation (not old history)', async () => {
      await seedThread('src-thread-gen', 4);
      const memoryStore = await getMemoryStore(memory);

      // Seed generation 0 (initial)
      const gen0 = await seedThreadScopedOM(memoryStore, 'src-thread-gen', {
        activeObservations: '* Generation 0 observations',
        observationTokenCount: 30,
        totalTokensObserved: 200,
        lastObservedAt: new Date('2024-01-01T10:03:00Z'),
        observedMessageIds: ['msg-src-thread-gen-0', 'msg-src-thread-gen-1'],
      });

      // Create generation 1 (reflection) via the storage API
      await memoryStore.createReflectionGeneration({
        currentRecord: gen0,
        reflection: '* Reflected observations from gen 0',
        tokenCount: 15,
      });

      // Verify we have 2 generations before cloning
      const historyBefore = await memoryStore.getObservationalMemoryHistory('src-thread-gen', resourceId);
      expect(historyBefore).toHaveLength(2);

      // Clone — only the current (most recent) generation should be cloned
      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: 'src-thread-gen',
      });

      // Verify cloned OM has only the current generation
      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).not.toBeNull();
      expect(clonedOM!.originType).toBe('reflection');
      expect(clonedOM!.generationCount).toBe(1);
      expect(clonedOM!.activeObservations).toBe('* Reflected observations from gen 0');
      expect(clonedOM!.threadId).toBe(clonedThread.id);
      expect(clonedOM!.id).not.toBe(historyBefore[0]!.id);

      // Old generations are NOT cloned
      const clonedHistory = await memoryStore.getObservationalMemoryHistory(clonedThread.id, clonedThread.resourceId);
      expect(clonedHistory).toHaveLength(1);
    });
  });

  describe('no OM present', () => {
    it('should clone thread successfully when no OM exists', async () => {
      await seedThread('src-thread-no-om', 3);

      const { thread: clonedThread, clonedMessages } = await memory.cloneThread({
        sourceThreadId: 'src-thread-no-om',
      });

      expect(clonedThread.id).not.toBe('src-thread-no-om');
      expect(clonedMessages).toHaveLength(3);

      // Verify no OM was created
      const memoryStore = await getMemoryStore(memory);
      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).toBeNull();
    });
  });

  describe('resource-scoped OM – same resourceId', () => {
    it('should NOT duplicate resource-scoped OM when resourceId is unchanged', async () => {
      await seedThread('src-thread-res-same', 3);
      const memoryStore = await getMemoryStore(memory);

      // Seed resource-scoped OM (threadId = null)
      await seedResourceScopedOM(memoryStore, {
        activeObservations: '<thread id="abc123">\n* Shared observations\n</thread>',
        observationTokenCount: 15,
      });

      // Clone without changing resourceId
      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: 'src-thread-res-same',
      });

      // Resource-scoped OM should still exist (shared)
      const resourceOM = await memoryStore.getObservationalMemory(null, resourceId);
      expect(resourceOM).not.toBeNull();

      // No thread-scoped OM should have been created on the clone
      const threadOM = await memoryStore.getObservationalMemory(clonedThread.id, resourceId);
      expect(threadOM).toBeNull();
    });
  });

  describe('resource-scoped OM – different resourceId', () => {
    it('should clone resource-scoped OM with remapped thread tags when resourceId changes', async () => {
      await seedThread('src-thread-res-diff', 3);
      const memoryStore = await getMemoryStore(memory);

      // Seed resource-scoped OM with thread tags using raw thread IDs
      // (In production these would be xxhash-obscured, but the logic replaces any matching tag)
      await seedResourceScopedOM(memoryStore, {
        activeObservations: '<thread id="placeholder">\n* Observations about user\n</thread>',
        observedMessageIds: ['msg-src-thread-res-diff-0', 'msg-src-thread-res-diff-1'],
        observationTokenCount: 20,
      });

      const newResourceId = 'new-om-test-resource';
      const { messageIdMap } = await memory.cloneThread({
        sourceThreadId: 'src-thread-res-diff',
        resourceId: newResourceId,
      });

      // Verify a new resource-scoped OM was created for the new resource
      const clonedOM = await memoryStore.getObservationalMemory(null, newResourceId);
      expect(clonedOM).not.toBeNull();
      expect(clonedOM!.scope).toBe('resource');
      expect(clonedOM!.resourceId).toBe(newResourceId);
      expect(clonedOM!.threadId).toBeNull();

      // Verify observedMessageIds are remapped
      expect(messageIdMap).toBeDefined();
      expect(clonedOM!.observedMessageIds).toEqual([
        messageIdMap!['msg-src-thread-res-diff-0'],
        messageIdMap!['msg-src-thread-res-diff-1'],
      ]);

      // Source OM should be unmodified
      const sourceOM = await memoryStore.getObservationalMemory(null, resourceId);
      expect(sourceOM).not.toBeNull();
      expect(sourceOM!.observedMessageIds).toEqual(['msg-src-thread-res-diff-0', 'msg-src-thread-res-diff-1']);
    });

    it('should remap xxhash-obscured thread tags in activeObservations', async () => {
      await seedThread('src-thread-tag-remap', 2);
      const memoryStore = await getMemoryStore(memory);

      // We need to get the actual xxhash values that the code will use.
      // Seed OM with a tag using the xxhash of 'src-thread-tag-remap'
      // We'll use the Memory's internal hasher via a round-trip.
      // First, let the clone happen and inspect what the source obscured ID is.

      // Seed with a known source thread ID tag — the code will xxhash 'src-thread-tag-remap'
      // and look for that hash. We need to put that hash in the OM record.
      // Let's compute it by importing xxhash directly.
      const xxhash = await import('xxhash-wasm');
      const hasher = await xxhash.default();
      const sourceObscured = hasher.h32ToString('src-thread-tag-remap');

      await seedResourceScopedOM(memoryStore, {
        activeObservations: `<thread id="${sourceObscured}">\nDate: 2024-01-01\n* User discussed topic X\n</thread>`,
        observationTokenCount: 15,
      });

      const newResourceId = 'remap-resource';
      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: 'src-thread-tag-remap',
        resourceId: newResourceId,
      });

      const clonedOM = await memoryStore.getObservationalMemory(null, newResourceId);
      expect(clonedOM).not.toBeNull();

      // The cloned OM should have the thread tag remapped to the cloned thread's obscured ID
      const clonedObscured = hasher.h32ToString(clonedThread.id);
      expect(clonedOM!.activeObservations).toContain(`<thread id="${clonedObscured}">`);
      expect(clonedOM!.activeObservations).not.toContain(`<thread id="${sourceObscured}">`);

      // Verify the observation content is preserved
      expect(clonedOM!.activeObservations).toContain('* User discussed topic X');
    });

    it('should remap thread tags in bufferedObservationChunks and bufferedReflection', async () => {
      await seedThread('src-thread-chunks-remap', 2);
      const memoryStore = await getMemoryStore(memory);

      const xxhash = await import('xxhash-wasm');
      const hasher = await xxhash.default();
      const sourceObscured = hasher.h32ToString('src-thread-chunks-remap');

      const chunks: BufferedObservationChunk[] = [
        {
          id: 'chunk-remap-1',
          cycleId: 'cycle-1',
          observations: `<thread id="${sourceObscured}">\n* Buffered chunk obs\n</thread>`,
          tokenCount: 10,
          messageIds: ['msg-src-thread-chunks-remap-0'],
          messageTokens: 30,
          lastObservedAt: new Date('2024-01-01T10:01:00Z'),
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      await seedResourceScopedOM(memoryStore, {
        activeObservations: `<thread id="${sourceObscured}">\n* Active obs\n</thread>`,
        bufferedObservationChunks: chunks,
        bufferedReflection: `<thread id="${sourceObscured}">\n* Buffered reflection\n</thread>`,
        observedMessageIds: ['msg-src-thread-chunks-remap-0'],
      });

      const newResourceId = 'chunks-remap-resource';
      const { thread: clonedThread } = await memory.cloneThread({
        sourceThreadId: 'src-thread-chunks-remap',
        resourceId: newResourceId,
      });

      const clonedOM = await memoryStore.getObservationalMemory(null, newResourceId);
      expect(clonedOM).not.toBeNull();

      const clonedObscured = hasher.h32ToString(clonedThread.id);

      // activeObservations remapped
      expect(clonedOM!.activeObservations).toContain(`<thread id="${clonedObscured}">`);
      expect(clonedOM!.activeObservations).not.toContain(`<thread id="${sourceObscured}">`);

      // bufferedReflection remapped
      expect(clonedOM!.bufferedReflection).toContain(`<thread id="${clonedObscured}">`);
      expect(clonedOM!.bufferedReflection).not.toContain(`<thread id="${sourceObscured}">`);

      // bufferedObservationChunks observations remapped
      expect(clonedOM!.bufferedObservationChunks).toHaveLength(1);
      expect(clonedOM!.bufferedObservationChunks![0]!.observations).toContain(`<thread id="${clonedObscured}">`);
      expect(clonedOM!.bufferedObservationChunks![0]!.observations).not.toContain(`<thread id="${sourceObscured}">`);
    });
  });

  describe('harness dynamic memory factory', () => {
    it('clones OM records with observedMessageIds via Harness.cloneThread', async () => {
      await seedThread('src-thread-harness-dynamic', 3);
      const memoryStore = await getMemoryStore(memory);

      await seedThreadScopedOM(memoryStore, 'src-thread-harness-dynamic', {
        activeObservations: '* Harness dynamic clone path observation',
        observedMessageIds: [
          'msg-src-thread-harness-dynamic-0',
          'msg-src-thread-harness-dynamic-1',
          'msg-src-thread-harness-dynamic-2',
        ],
      });

      const memoryFactory = vi.fn().mockResolvedValue(memory);
      const harness = new Harness({
        id: 'clone-thread-dynamic-memory-test',
        resourceId,
        memory: memoryFactory,
        modes: [
          {
            id: 'default',
            name: 'Default',
            default: true,
            agent: new Agent({
              id: 'test-agent',
              name: 'test-agent',
              instructions: 'You are a test agent.',
              model: 'openai/gpt-4o',
            }),
          },
        ],
      });

      await harness.init();
      const clonedThread = await harness.cloneThread({ sourceThreadId: 'src-thread-harness-dynamic' });

      expect(memoryFactory).toHaveBeenCalledTimes(1);

      const clonedOM = await memoryStore.getObservationalMemory(clonedThread.id, clonedThread.resourceId);
      expect(clonedOM).not.toBeNull();
      expect(Array.isArray(clonedOM!.observedMessageIds)).toBe(true);
      expect(clonedOM!.observedMessageIds).toHaveLength(3);

      const clonedMessages = await memoryStore.listMessages({ threadId: clonedThread.id });
      const clonedMessageIds = clonedMessages.messages.map(m => m.id);
      expect(clonedOM!.observedMessageIds!.every(id => clonedMessageIds.includes(id))).toBe(true);
    });
  });
});
