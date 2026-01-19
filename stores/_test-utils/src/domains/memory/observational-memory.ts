import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * Helper to create sample OM initialization input
 */
function createSampleOMInput({
  threadId = null,
  resourceId = `resource-${randomUUID()}`,
  scope = 'resource' as const,
}: {
  threadId?: string | null;
  resourceId?: string;
  scope?: 'thread' | 'resource';
} = {}) {
  return {
    threadId,
    resourceId,
    scope,
    config: {
      observationThreshold: 5000,
      reflectionThreshold: 40000,
    },
  };
}

export function createObservationalMemoryTest({ storage }: { storage: MastraStorage }) {
  let memoryStorage: MemoryStorage;

  beforeAll(async () => {
    const store = await storage.getStore('memory');
    if (!store) {
      throw new Error('Memory storage not found');
    }
    memoryStorage = store;
  });

  describe('Observational Memory', () => {
    describe('initializeObservationalMemory', () => {
      it('should create a new observational memory record', async () => {
        const input = createSampleOMInput();

        const record = await memoryStorage.initializeObservationalMemory(input);

        expect(record).toBeDefined();
        expect(record.id).toBeDefined();
        expect(record.resourceId).toBe(input.resourceId);
        expect(record.threadId).toBeNull();
        expect(record.scope).toBe('resource');
        expect(record.originType).toBe('initial');
        expect(record.activeObservations).toBe('');
        expect(record.isObserving).toBe(false);
        expect(record.isReflecting).toBe(false);
        expect(record.totalTokensObserved).toBe(0);
        expect(record.observationTokenCount).toBe(0);
        expect(record.pendingMessageTokens).toBe(0);
        expect(record.createdAt).toBeInstanceOf(Date);
        expect(record.updatedAt).toBeInstanceOf(Date);
      });

      it('should create a thread-scoped observational memory record', async () => {
        const threadId = `thread-${randomUUID()}`;
        const input = createSampleOMInput({ threadId, scope: 'thread' });

        const record = await memoryStorage.initializeObservationalMemory(input);

        expect(record.threadId).toBe(threadId);
        expect(record.scope).toBe('thread');
      });

      it('should store config in the record', async () => {
        const input = createSampleOMInput();

        const record = await memoryStorage.initializeObservationalMemory(input);

        expect(record.config).toEqual(input.config);
      });
    });

    describe('getObservationalMemory', () => {
      it('should retrieve an existing observational memory record', async () => {
        const input = createSampleOMInput();
        const created = await memoryStorage.initializeObservationalMemory(input);

        const retrieved = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.resourceId).toBe(input.resourceId);
      });

      it('should return null for non-existent record', async () => {
        const result = await memoryStorage.getObservationalMemory(null, 'non-existent-resource');

        expect(result).toBeNull();
      });

      it('should retrieve thread-scoped record with threadId', async () => {
        const threadId = `thread-${randomUUID()}`;
        const input = createSampleOMInput({ threadId, scope: 'thread' });
        const created = await memoryStorage.initializeObservationalMemory(input);

        const retrieved = await memoryStorage.getObservationalMemory(threadId, input.resourceId);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
      });
    });

    describe('getObservationalMemoryHistory', () => {
      it('should return empty array for non-existent resource', async () => {
        const history = await memoryStorage.getObservationalMemoryHistory(null, 'non-existent-resource');

        expect(history).toEqual([]);
      });

      it('should return history in reverse chronological order', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record
        const first = await memoryStorage.initializeObservationalMemory(input);

        // Create reflection generation
        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'First reflection',
          tokenCount: 100,
        });

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId);

        expect(history.length).toBe(2);
        expect(history[0]!.id).toBe(second.id); // Most recent first
        expect(history[1]!.id).toBe(first.id);
      });

      it('should respect limit parameter', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record
        const first = await memoryStorage.initializeObservationalMemory(input);

        // Create multiple reflection generations
        let current = first;
        for (let i = 0; i < 3; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, 2);

        expect(history.length).toBe(2);
      });
    });

    describe('updateActiveObservations', () => {
      it('should update observations and token counts', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const observations = '- User mentioned preference for dark mode\n- User works in tech industry';
        const tokenCount = 50;
        const lastObservedAt = new Date();

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations,
          tokenCount,
          lastObservedAt,
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        expect(updated?.activeObservations).toBe(observations);
        expect(updated?.observationTokenCount).toBe(tokenCount);
        expect(updated?.totalTokensObserved).toBe(tokenCount);
        expect(updated?.pendingMessageTokens).toBe(0); // Should be reset
      });

      it('should accumulate totalTokensObserved across multiple updates', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        // First observation
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'First observations',
          tokenCount: 100,
          lastObservedAt: new Date(),
        });

        // Second observation
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'Second observations',
          tokenCount: 150,
          lastObservedAt: new Date(),
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        expect(updated?.observationTokenCount).toBe(150); // Latest token count
        expect(updated?.totalTokensObserved).toBe(250); // Accumulated
      });

      it('should throw error for non-existent record', async () => {
        await expect(
          memoryStorage.updateActiveObservations({
            id: 'non-existent-id',
            observations: 'test',
            tokenCount: 10,
            lastObservedAt: new Date(),
          }),
        ).rejects.toThrow(/not found/);
      });

      it('should update lastObservedAt timestamp', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const lastObservedAt = new Date('2024-01-15T10:00:00Z');

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'Test observation',
          tokenCount: 25,
          lastObservedAt,
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        // Date comparison - handle both Date objects and ISO strings
        const updatedLastObserved =
          updated?.lastObservedAt instanceof Date ? updated.lastObservedAt : new Date(updated?.lastObservedAt ?? 0);
        expect(updatedLastObserved.toISOString()).toBe(lastObservedAt.toISOString());
      });
    });

    describe('createReflectionGeneration', () => {
      it('should create a new record with reflection content', async () => {
        const input = createSampleOMInput();
        const initial = await memoryStorage.initializeObservationalMemory(input);

        // First add some observations
        await memoryStorage.updateActiveObservations({
          id: initial.id,
          observations: 'Initial observations',
          tokenCount: 100,
          lastObservedAt: new Date(),
        });

        const reflection = 'Condensed reflection of observations';
        const newRecord = await memoryStorage.createReflectionGeneration({
          currentRecord: initial,
          reflection,
          tokenCount: 50,
        });

        expect(newRecord).toBeDefined();
        expect(newRecord.id).not.toBe(initial.id);
        expect(newRecord.originType).toBe('reflection');
        expect(newRecord.activeObservations).toBe(reflection);
        expect(newRecord.resourceId).toBe(input.resourceId);
        expect(newRecord.scope).toBe(input.scope);
      });

      it('should carry over lastObservedAt from current record', async () => {
        const input = createSampleOMInput();
        const initial = await memoryStorage.initializeObservationalMemory(input);

        const observedAt = new Date('2024-01-15T10:00:00Z');
        await memoryStorage.updateActiveObservations({
          id: initial.id,
          observations: 'Test observations',
          tokenCount: 100,
          lastObservedAt: observedAt,
        });

        // Re-fetch to get the updated record
        const updatedInitial = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        const newRecord = await memoryStorage.createReflectionGeneration({
          currentRecord: updatedInitial!,
          reflection: 'Reflection',
          tokenCount: 50,
        });

        // Date comparison - handle both Date objects and ISO strings
        const newLastObserved =
          newRecord.lastObservedAt instanceof Date
            ? newRecord.lastObservedAt
            : new Date(newRecord.lastObservedAt ?? 0);
        expect(newLastObserved.toISOString()).toBe(observedAt.toISOString());
      });

      it('should reset isReflecting and isObserving flags', async () => {
        const input = createSampleOMInput();
        const initial = await memoryStorage.initializeObservationalMemory(input);

        const newRecord = await memoryStorage.createReflectionGeneration({
          currentRecord: initial,
          reflection: 'Reflection',
          tokenCount: 50,
        });

        expect(newRecord.isReflecting).toBe(false);
        expect(newRecord.isObserving).toBe(false);
      });

      it('should be retrievable via getObservationalMemory', async () => {
        const input = createSampleOMInput();
        const initial = await memoryStorage.initializeObservationalMemory(input);

        const newRecord = await memoryStorage.createReflectionGeneration({
          currentRecord: initial,
          reflection: 'Reflection',
          tokenCount: 50,
        });

        const retrieved = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        expect(retrieved?.id).toBe(newRecord.id);
        expect(retrieved?.originType).toBe('reflection');
      });
    });

    describe('setReflectingFlag', () => {
      it('should set isReflecting to true', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setReflectingFlag(record.id, true);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isReflecting).toBe(true);
      });

      it('should set isReflecting to false', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setReflectingFlag(record.id, true);
        await memoryStorage.setReflectingFlag(record.id, false);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isReflecting).toBe(false);
      });

      it('should throw error for non-existent record', async () => {
        await expect(memoryStorage.setReflectingFlag('non-existent-id', true)).rejects.toThrow(/not found/);
      });
    });

    describe('setObservingFlag', () => {
      it('should set isObserving to true', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setObservingFlag(record.id, true);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isObserving).toBe(true);
      });

      it('should set isObserving to false', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setObservingFlag(record.id, true);
        await memoryStorage.setObservingFlag(record.id, false);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isObserving).toBe(false);
      });

      it('should throw error for non-existent record', async () => {
        await expect(memoryStorage.setObservingFlag('non-existent-id', true)).rejects.toThrow(/not found/);
      });
    });

    describe('clearObservationalMemory', () => {
      it('should clear all observational memory for a resource', async () => {
        const input = createSampleOMInput();
        await memoryStorage.initializeObservationalMemory(input);

        // Verify it exists
        const before = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(before).toBeDefined();

        await memoryStorage.clearObservationalMemory(input.threadId, input.resourceId);

        const after = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(after).toBeNull();
      });

      it('should clear all history for a resource', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record
        const first = await memoryStorage.initializeObservationalMemory(input);

        // Create reflection generation
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection',
          tokenCount: 100,
        });

        // Verify history exists
        const historyBefore = await memoryStorage.getObservationalMemoryHistory(null, resourceId);
        expect(historyBefore.length).toBe(2);

        await memoryStorage.clearObservationalMemory(null, resourceId);

        const historyAfter = await memoryStorage.getObservationalMemoryHistory(null, resourceId);
        expect(historyAfter).toEqual([]);
      });

      it('should not throw error for non-existent resource', async () => {
        // Should not throw
        await memoryStorage.clearObservationalMemory(null, 'non-existent-resource');
      });
    });

    describe('addPendingMessageTokens', () => {
      it('should add pending tokens to the record', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.addPendingMessageTokens(record.id, 100);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.pendingMessageTokens).toBe(100);
      });

      it('should accumulate pending tokens across multiple calls', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.addPendingMessageTokens(record.id, 50);
        await memoryStorage.addPendingMessageTokens(record.id, 75);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.pendingMessageTokens).toBe(125);
      });

      it('should throw error for non-existent record', async () => {
        await expect(memoryStorage.addPendingMessageTokens('non-existent-id', 100)).rejects.toThrow(/not found/);
      });

      it('should reset pending tokens when observations are updated', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        // Add pending tokens
        await memoryStorage.addPendingMessageTokens(record.id, 100);

        // Update observations
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'New observations',
          tokenCount: 50,
          lastObservedAt: new Date(),
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.pendingMessageTokens).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty observations', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '',
          tokenCount: 0,
          lastObservedAt: new Date(),
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.activeObservations).toBe('');
      });

      it('should handle large observations', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const largeObservations = 'A'.repeat(100000); // 100KB of content

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: largeObservations,
          tokenCount: 25000,
          lastObservedAt: new Date(),
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.activeObservations).toBe(largeObservations);
      });

      it('should handle special characters in observations', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const observations = '- User said "Hello, world!" 🌍\n- Temperature: 25°C\n- Unicode: 中文 العربية';

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations,
          tokenCount: 50,
          lastObservedAt: new Date(),
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.activeObservations).toBe(observations);
      });

      it('should maintain separate records for different resources', async () => {
        const resource1 = `resource-${randomUUID()}`;
        const resource2 = `resource-${randomUUID()}`;

        await memoryStorage.initializeObservationalMemory(createSampleOMInput({ resourceId: resource1 }));
        await memoryStorage.initializeObservationalMemory(createSampleOMInput({ resourceId: resource2 }));

        const record1 = await memoryStorage.getObservationalMemory(null, resource1);
        const record2 = await memoryStorage.getObservationalMemory(null, resource2);

        expect(record1?.resourceId).toBe(resource1);
        expect(record2?.resourceId).toBe(resource2);
        expect(record1?.id).not.toBe(record2?.id);
      });

      it('should maintain separate records for thread-scoped vs resource-scoped', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const threadId = `thread-${randomUUID()}`;

        // Create resource-scoped record
        await memoryStorage.initializeObservationalMemory(
          createSampleOMInput({ resourceId, threadId: null, scope: 'resource' }),
        );

        // Create thread-scoped record for same resource but different thread
        await memoryStorage.initializeObservationalMemory(createSampleOMInput({ resourceId, threadId, scope: 'thread' }));

        const resourceRecord = await memoryStorage.getObservationalMemory(null, resourceId);
        const threadRecord = await memoryStorage.getObservationalMemory(threadId, resourceId);

        expect(resourceRecord).toBeDefined();
        expect(threadRecord).toBeDefined();
        expect(resourceRecord?.id).not.toBe(threadRecord?.id);
        expect(resourceRecord?.scope).toBe('resource');
        expect(threadRecord?.scope).toBe('thread');
      });
    });
  });
}
