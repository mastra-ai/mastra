import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
    // Skip all OM tests for adapters that don't support it
    beforeEach(ctx => {
      if (!memoryStorage.supportsObservationalMemory) {
        ctx.skip();
      }
    });

    const createChunk = ({ observations, messageTokens }: { observations: string; messageTokens: number }) => ({
      cycleId: `cycle-${randomUUID()}`,
      observations,
      tokenCount: Math.round(messageTokens / 2),
      messageIds: [`msg-${randomUUID()}`],
      messageTokens,
      lastObservedAt: new Date(),
    });

    it('should create a new observational memory record', async () => {
      const input = createSampleOMInput();

      const record = await memoryStorage.initializeObservationalMemory(input);

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.resourceId).toBe(input.resourceId);
      expect(record.threadId).toBeNull();
      expect(record.scope).toBe('resource');
    });
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

      it('should filter by from date', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record
        const first = await memoryStorage.initializeObservationalMemory(input);

        // Small delay to ensure distinct timestamps
        await new Promise(r => setTimeout(r, 50));
        const midpoint = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Create reflection generation after midpoint
        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection after midpoint',
          tokenCount: 100,
        });

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          from: midpoint,
        });

        expect(history.length).toBe(1);
        expect(history[0]!.id).toBe(second.id);
      });

      it('should filter by to date', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record
        const first = await memoryStorage.initializeObservationalMemory(input);

        // Small delay to ensure distinct timestamps
        await new Promise(r => setTimeout(r, 50));
        const midpoint = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Create reflection generation after midpoint
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection after midpoint',
          tokenCount: 100,
        });

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          to: midpoint,
        });

        expect(history.length).toBe(1);
        expect(history[0]!.id).toBe(first.id);
      });

      it('should filter by from and to date combined', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record
        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const rangeStart = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Create 2nd record inside the range
        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection in range',
          tokenCount: 100,
        });

        await new Promise(r => setTimeout(r, 50));
        const rangeEnd = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Create 3rd record outside the range
        await memoryStorage.createReflectionGeneration({
          currentRecord: second,
          reflection: 'Reflection after range',
          tokenCount: 100,
        });

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          from: rangeStart,
          to: rangeEnd,
        });

        expect(history.length).toBe(1);
        expect(history[0]!.id).toBe(second.id);
      });

      it('should support offset', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record + 3 reflections = 4 records total
        const first = await memoryStorage.initializeObservationalMemory(input);
        let current = first;
        for (let i = 0; i < 3; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        // Offset 2 should skip the 2 newest records (reverse chronological order)
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, { offset: 2 });

        expect(history.length).toBe(2);
        // Should have the 2 oldest records (generationCount 1 and 0)
        expect(history[0]!.generationCount).toBe(1);
        expect(history[1]!.generationCount).toBe(0);
      });

      it('should support offset with limit', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create initial record + 3 reflections = 4 records total
        const first = await memoryStorage.initializeObservationalMemory(input);
        let current = first;
        for (let i = 0; i < 3; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        // Offset 1, limit 2: skip newest, take next 2
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, 2, { offset: 1 });

        expect(history.length).toBe(2);
        expect(history[0]!.generationCount).toBe(2);
        expect(history[1]!.generationCount).toBe(1);
      });

      it('should return all records when empty options object is passed', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection 1',
          tokenCount: 100,
        });

        const withEmptyOptions = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {});
        const withoutOptions = await memoryStorage.getObservationalMemoryHistory(null, resourceId);

        expect(withEmptyOptions.length).toBe(2);
        expect(withEmptyOptions.length).toBe(withoutOptions.length);
        expect(withEmptyOptions.map(r => r.id)).toEqual(withoutOptions.map(r => r.id));
      });

      it('should return empty array when from is in the future', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection 1',
          tokenCount: 100,
        });

        const futureDate = new Date(Date.now() + 86_400_000); // +1 day
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          from: futureDate,
        });

        expect(history).toEqual([]);
      });

      it('should return empty array when to is far in the past', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection 1',
          tokenCount: 100,
        });

        const pastDate = new Date('2000-01-01T00:00:00Z');
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          to: pastDate,
        });

        expect(history).toEqual([]);
      });

      it('should return empty array when offset exceeds total records', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection 1',
          tokenCount: 100,
        });

        // 2 records total, offset 10 should return nothing
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, { offset: 10 });

        expect(history).toEqual([]);
      });

      it('should treat offset 0 the same as no offset', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);
        let current = first;
        for (let i = 0; i < 2; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        const withOffset0 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          offset: 0,
        });
        const withoutOffset = await memoryStorage.getObservationalMemoryHistory(null, resourceId);

        expect(withOffset0.length).toBe(3);
        expect(withOffset0.map(r => r.id)).toEqual(withoutOffset.map(r => r.id));
      });

      it('should preserve reverse chronological order when filtering by from', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const midpoint = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Create 3 more records after midpoint
        let current = first;
        const afterIds: string[] = [];
        for (let i = 0; i < 3; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
          afterIds.push(current.id);
        }

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          from: midpoint,
        });

        expect(history.length).toBe(3);
        // Newest first (generationCount descending)
        expect(history[0]!.generationCount).toBeGreaterThan(history[1]!.generationCount);
        expect(history[1]!.generationCount).toBeGreaterThan(history[2]!.generationCount);
      });

      it('should preserve reverse chronological order when using offset', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create 5 records total
        const first = await memoryStorage.initializeObservationalMemory(input);
        let current = first;
        for (let i = 0; i < 4; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, { offset: 1 });

        expect(history.length).toBe(4);
        for (let i = 0; i < history.length - 1; i++) {
          expect(history[i]!.generationCount).toBeGreaterThan(history[i + 1]!.generationCount);
        }
      });

      it('should combine from + to + limit correctly', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Record before range
        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const rangeStart = new Date();
        await new Promise(r => setTimeout(r, 50));

        // 3 records inside range
        let current = first;
        for (let i = 0; i < 3; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        await new Promise(r => setTimeout(r, 50));
        const rangeEnd = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Record after range
        await memoryStorage.createReflectionGeneration({
          currentRecord: current,
          reflection: 'After range',
          tokenCount: 100,
        });

        // 3 records in range, but limit to 2
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, 2, {
          from: rangeStart,
          to: rangeEnd,
        });

        expect(history.length).toBe(2);
        // Should be the 2 newest within the range
        expect(history[0]!.generationCount).toBe(3);
        expect(history[1]!.generationCount).toBe(2);
      });

      it('should combine from + to + offset correctly', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Record before range
        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const rangeStart = new Date();
        await new Promise(r => setTimeout(r, 50));

        // 3 records inside range
        let current = first;
        for (let i = 0; i < 3; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        await new Promise(r => setTimeout(r, 50));
        const rangeEnd = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Record after range
        await memoryStorage.createReflectionGeneration({
          currentRecord: current,
          reflection: 'After range',
          tokenCount: 100,
        });

        // 3 records in range, skip the newest 1
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          from: rangeStart,
          to: rangeEnd,
          offset: 1,
        });

        expect(history.length).toBe(2);
        // Skipped gen 3 (newest in range), should have gen 2 and gen 1
        expect(history[0]!.generationCount).toBe(2);
        expect(history[1]!.generationCount).toBe(1);
      });

      it('should combine from + to + offset + limit for full pagination', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Record before range
        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const rangeStart = new Date();
        await new Promise(r => setTimeout(r, 50));

        // 4 records inside range (gen 1..4)
        let current = first;
        for (let i = 0; i < 4; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        await new Promise(r => setTimeout(r, 50));
        const rangeEnd = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Record after range
        await memoryStorage.createReflectionGeneration({
          currentRecord: current,
          reflection: 'After range',
          tokenCount: 100,
        });

        // 4 records in range (gen 4,3,2,1 in desc order), offset 1, limit 2 => gen 3, gen 2
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, 2, {
          from: rangeStart,
          to: rangeEnd,
          offset: 1,
        });

        expect(history.length).toBe(2);
        expect(history[0]!.generationCount).toBe(3);
        expect(history[1]!.generationCount).toBe(2);
      });

      it('should work with thread-scoped records (non-null threadId)', async () => {
        const scopedThreadId = `thread-${randomUUID()}`;
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ threadId: scopedThreadId, resourceId, scope: 'thread' });

        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const midpoint = new Date();
        await new Promise(r => setTimeout(r, 50));

        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Thread-scoped reflection',
          tokenCount: 100,
        });

        // from filter with thread-scoped lookup
        const fromHistory = await memoryStorage.getObservationalMemoryHistory(scopedThreadId, resourceId, undefined, {
          from: midpoint,
        });
        expect(fromHistory.length).toBe(1);
        expect(fromHistory[0]!.id).toBe(second.id);

        // to filter with thread-scoped lookup
        const toHistory = await memoryStorage.getObservationalMemoryHistory(scopedThreadId, resourceId, undefined, {
          to: midpoint,
        });
        expect(toHistory.length).toBe(1);
        expect(toHistory[0]!.id).toBe(first.id);

        // offset with thread-scoped lookup
        const offsetHistory = await memoryStorage.getObservationalMemoryHistory(scopedThreadId, resourceId, undefined, {
          offset: 1,
        });
        expect(offsetHistory.length).toBe(1);
        expect(offsetHistory[0]!.id).toBe(first.id);
      });

      it('should not return records from a different resource when filtering', async () => {
        const resourceIdA = `resource-a-${randomUUID()}`;
        const resourceIdB = `resource-b-${randomUUID()}`;

        // Create records for resource A
        const firstA = await memoryStorage.initializeObservationalMemory(
          createSampleOMInput({ resourceId: resourceIdA }),
        );
        await memoryStorage.createReflectionGeneration({
          currentRecord: firstA,
          reflection: 'Resource A reflection',
          tokenCount: 100,
        });

        // Create records for resource B
        const firstB = await memoryStorage.initializeObservationalMemory(
          createSampleOMInput({ resourceId: resourceIdB }),
        );
        await memoryStorage.createReflectionGeneration({
          currentRecord: firstB,
          reflection: 'Resource B reflection',
          tokenCount: 100,
        });

        // Query resource A — should only get resource A's records
        const historyA = await memoryStorage.getObservationalMemoryHistory(null, resourceIdA, undefined, { offset: 0 });
        expect(historyA.length).toBe(2);
        expect(historyA.every(r => r.resourceId === resourceIdA)).toBe(true);

        // Query resource B with date filter — should only get resource B's records
        const pastDate = new Date('2000-01-01T00:00:00Z');
        const historyB = await memoryStorage.getObservationalMemoryHistory(null, resourceIdB, undefined, {
          from: pastDate,
        });
        expect(historyB.length).toBe(2);
        expect(historyB.every(r => r.resourceId === resourceIdB)).toBe(true);
      });

      it('should return empty array when from equals to and no record has that exact timestamp', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        await memoryStorage.initializeObservationalMemory(input);

        // Use a timestamp that definitely doesn't match any record
        const exactDate = new Date('2099-06-15T12:00:00.000Z');
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          from: exactDate,
          to: exactDate,
        });

        expect(history).toEqual([]);
      });

      it('should handle offset on a single record', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Only 1 record
        await memoryStorage.initializeObservationalMemory(input);

        // offset 0 on single record returns it
        const withOffset0 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          offset: 0,
        });
        expect(withOffset0.length).toBe(1);

        // offset 1 on single record returns nothing
        const withOffset1 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, undefined, {
          offset: 1,
        });
        expect(withOffset1).toEqual([]);
      });

      it('should paginate correctly using offset + limit across multiple pages', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // Create 6 records total (gen 0..5)
        const first = await memoryStorage.initializeObservationalMemory(input);
        let current = first;
        for (let i = 0; i < 5; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        const pageSize = 2;

        // Page 1: offset 0, limit 2 => gen 5, 4
        const page1 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, pageSize, { offset: 0 });
        expect(page1.length).toBe(2);
        expect(page1[0]!.generationCount).toBe(5);
        expect(page1[1]!.generationCount).toBe(4);

        // Page 2: offset 2, limit 2 => gen 3, 2
        const page2 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, pageSize, { offset: 2 });
        expect(page2.length).toBe(2);
        expect(page2[0]!.generationCount).toBe(3);
        expect(page2[1]!.generationCount).toBe(2);

        // Page 3: offset 4, limit 2 => gen 1, 0
        const page3 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, pageSize, { offset: 4 });
        expect(page3.length).toBe(2);
        expect(page3[0]!.generationCount).toBe(1);
        expect(page3[1]!.generationCount).toBe(0);

        // Page 4: offset 6, limit 2 => empty
        const page4 = await memoryStorage.getObservationalMemoryHistory(null, resourceId, pageSize, { offset: 6 });
        expect(page4).toEqual([]);

        // All pages combined should cover all 6 records with no duplicates
        const allIds = [...page1, ...page2, ...page3].map(r => r.id);
        expect(new Set(allIds).size).toBe(6);
      });

      it('should return correct results when limit exceeds available records after offset', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        // 3 records total
        const first = await memoryStorage.initializeObservationalMemory(input);
        let current = first;
        for (let i = 0; i < 2; i++) {
          current = await memoryStorage.createReflectionGeneration({
            currentRecord: current,
            reflection: `Reflection ${i + 1}`,
            tokenCount: 100,
          });
        }

        // offset 2 leaves only 1 record, but limit is 10
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, 10, { offset: 2 });
        expect(history.length).toBe(1);
        expect(history[0]!.generationCount).toBe(0);
      });

      it('should return correct results when limit exceeds available records after date filtering', async () => {
        const resourceId = `resource-${randomUUID()}`;
        const input = createSampleOMInput({ resourceId });

        const first = await memoryStorage.initializeObservationalMemory(input);

        await new Promise(r => setTimeout(r, 50));
        const midpoint = new Date();
        await new Promise(r => setTimeout(r, 50));

        // Only 1 record after midpoint
        await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'After midpoint',
          tokenCount: 100,
        });

        // Limit 100 but only 1 record matches
        const history = await memoryStorage.getObservationalMemoryHistory(null, resourceId, 100, {
          from: midpoint,
        });
        expect(history.length).toBe(1);
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
          newRecord.lastObservedAt instanceof Date ? newRecord.lastObservedAt : new Date(newRecord.lastObservedAt ?? 0);
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

    describe('setBufferingObservationFlag', () => {
      it('should set isBufferingObservation to true and capture token count', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setBufferingObservationFlag(record.id, true, 5000);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isBufferingObservation).toBe(true);
        expect(updated?.lastBufferedAtTokens).toBe(5000);
      });

      it('should set isBufferingObservation to false', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setBufferingObservationFlag(record.id, true, 5000);
        await memoryStorage.setBufferingObservationFlag(record.id, false);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isBufferingObservation).toBe(false);
      });

      it('should throw error for non-existent record', async () => {
        await expect(memoryStorage.setBufferingObservationFlag('non-existent-id', true)).rejects.toThrow(/not found/);
      });
    });

    describe('setBufferingReflectionFlag', () => {
      it('should set isBufferingReflection to true', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setBufferingReflectionFlag(record.id, true);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isBufferingReflection).toBe(true);
      });

      it('should set isBufferingReflection to false', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setBufferingReflectionFlag(record.id, true);
        await memoryStorage.setBufferingReflectionFlag(record.id, false);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isBufferingReflection).toBe(false);
      });

      it('should throw error for non-existent record', async () => {
        await expect(memoryStorage.setBufferingReflectionFlag('non-existent-id', true)).rejects.toThrow(/not found/);
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

    describe('setPendingMessageTokens', () => {
      it('should set pending tokens on the record', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setPendingMessageTokens(record.id, 100);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.pendingMessageTokens).toBe(100);
      });

      it('should overwrite pending tokens on subsequent calls', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.setPendingMessageTokens(record.id, 50);
        await memoryStorage.setPendingMessageTokens(record.id, 75);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.pendingMessageTokens).toBe(75);
      });

      it('should throw error for non-existent record', async () => {
        await expect(memoryStorage.setPendingMessageTokens('non-existent-id', 100)).rejects.toThrow(/not found/);
      });

      it('should reset pending tokens when observations are updated', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        // Set pending tokens
        await memoryStorage.setPendingMessageTokens(record.id, 100);

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
        await memoryStorage.initializeObservationalMemory(
          createSampleOMInput({ resourceId, threadId, scope: 'thread' }),
        );

        const resourceRecord = await memoryStorage.getObservationalMemory(null, resourceId);
        const threadRecord = await memoryStorage.getObservationalMemory(threadId, resourceId);

        expect(resourceRecord).toBeDefined();
        expect(threadRecord).toBeDefined();
        expect(resourceRecord?.id).not.toBe(threadRecord?.id);
        expect(resourceRecord?.scope).toBe('resource');
        expect(threadRecord?.scope).toBe('thread');
      });
    });

    describe('Buffered Observations', () => {
      it('should treat swapBufferedToActive as a no-op when no buffered observations exist', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const result = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 0,
        });

        expect(result.chunksActivated).toBe(0);
        expect(result.observationTokensActivated).toBe(0);
        expect(result.messagesActivated).toBe(0);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.activeObservations).toBe('');
        expect(updated?.bufferedObservationChunks?.length ?? 0).toBe(0);
      });

      it('should make swapBufferedToActive idempotent after activation', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: createChunk({ observations: 'Buffered A', messageTokens: 600 }),
        });

        const firstSwap = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 600,
        });

        const afterFirstSwap = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        const activeAfterFirstSwap = afterFirstSwap?.activeObservations;

        const secondSwap = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 0,
        });

        const afterSecondSwap = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);

        expect(firstSwap.chunksActivated).toBe(1);
        expect(secondSwap.chunksActivated).toBe(0);
        expect(afterSecondSwap?.activeObservations).toBe(activeAfterFirstSwap);
      });

      it('should activate buffered chunks at activation ratio boundaries', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: createChunk({ observations: 'Chunk 1', messageTokens: 700 }),
        });
        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: createChunk({ observations: 'Chunk 2', messageTokens: 700 }),
        });

        const lowRatio = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 0,
          messageTokensThreshold: 1000,
          currentPendingTokens: 1400,
        });

        expect(lowRatio.chunksActivated).toBe(1);

        const refreshed = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(refreshed?.bufferedObservationChunks?.length ?? 0).toBe(1);

        const highRatio = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 700,
        });

        expect(highRatio.chunksActivated).toBe(1);
        const finalRecord = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(finalRecord?.bufferedObservationChunks?.length ?? 0).toBe(0);
      });

      it('should retain observed message IDs across buffered activation', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        const observedMessageIds = [`msg-${randomUUID()}`, `msg-${randomUUID()}`];

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'Active observations',
          tokenCount: 50,
          lastObservedAt: new Date(),
          observedMessageIds,
        });

        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: createChunk({ observations: 'Buffered observations', messageTokens: 500 }),
        });

        await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 500,
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.observedMessageIds).toEqual(observedMessageIds);
      });

      it('should keep remaining buffered chunks after partial activation', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: createChunk({ observations: 'Chunk A', messageTokens: 600 }),
        });
        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: createChunk({ observations: 'Chunk B', messageTokens: 600 }),
        });

        const partial = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 0.5,
          messageTokensThreshold: 1000,
          currentPendingTokens: 1200,
        });

        expect(partial.chunksActivated).toBe(1);
        const afterPartial = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(afterPartial?.bufferedObservationChunks?.length ?? 0).toBe(1);

        const finalSwap = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 600,
        });

        expect(finalSwap.chunksActivated).toBe(1);
        const finalRecord = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(finalRecord?.bufferedObservationChunks?.length ?? 0).toBe(0);
      });
    });

    describe('Reflection Generations', () => {
      it('should increment generation counts and keep history newest-first', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const first = await memoryStorage.createReflectionGeneration({
          currentRecord: record,
          reflection: 'Reflection 1',
          tokenCount: 10,
        });

        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: 'Reflection 2',
          tokenCount: 12,
        });

        expect(first.generationCount).toBe(record.generationCount + 1);
        expect(second.generationCount).toBe(first.generationCount + 1);

        const history = await memoryStorage.getObservationalMemoryHistory(input.threadId, input.resourceId);
        expect(history[0]?.id).toBe(second.id);
        expect(history[1]?.id).toBe(first.id);
        expect(history[2]?.id).toBe(record.id);
      });

      it('should preserve prior generations when new reflections are created', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'Original observations',
          tokenCount: 25,
          lastObservedAt: new Date(),
        });

        const reflection = await memoryStorage.createReflectionGeneration({
          currentRecord: record,
          reflection: 'Reflected observations',
          tokenCount: 12,
        });

        const history = await memoryStorage.getObservationalMemoryHistory(input.threadId, input.resourceId);
        const originalRecord = history.find(item => item.id === record.id);

        expect(reflection.id).not.toBe(record.id);
        expect(originalRecord?.activeObservations).toBe('Original observations');
        expect(originalRecord?.observationTokenCount).toBe(25);
      });
    });

    describe('Buffered Reflection', () => {
      it('should buffer reflection content and update token counts', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateBufferedReflection({
          id: record.id,
          reflection: 'Reflected content from observations',
          tokenCount: 50,
          inputTokenCount: 120,
          reflectedObservationLineCount: 5,
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.bufferedReflection).toContain('Reflected content from observations');
        expect(updated?.bufferedReflectionTokens).toBe(50);
        expect(updated?.bufferedReflectionInputTokens).toBe(120);
        expect(updated?.reflectedObservationLineCount).toBe(5);
      });

      it('should swap buffered reflection to active and create new generation', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7',
          tokenCount: 30,
          lastObservedAt: new Date(),
        });

        await memoryStorage.updateBufferedReflection({
          id: record.id,
          reflection: 'Condensed reflection',
          tokenCount: 20,
          inputTokenCount: 50,
          reflectedObservationLineCount: 5,
        });

        const reflection = await memoryStorage.swapBufferedReflectionToActive({
          currentRecord: record,
          tokenCount: 25,
        });

        expect(reflection.generationCount).toBe(record.generationCount + 1);
        expect(reflection.activeObservations).toContain('Condensed reflection');
        expect(reflection.activeObservations).toContain('Line 6');
        expect(reflection.activeObservations).toContain('Line 7');
        expect(reflection.bufferedReflection).toBeUndefined();
        expect(reflection.bufferedReflectionTokens).toBeUndefined();
      });

      it('should throw when swapping buffered reflection with no buffered content', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await expect(
          memoryStorage.swapBufferedReflectionToActive({
            currentRecord: record,
            tokenCount: 10,
          }),
        ).rejects.toThrow('No buffered reflection to swap');
      });
    });

    describe('Concurrent Updates', () => {
      it('should tolerate concurrent flag and buffer updates', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await Promise.all([
          memoryStorage.setObservingFlag(record.id, true),
          memoryStorage.updateBufferedObservations({
            id: record.id,
            chunk: createChunk({ observations: 'Concurrent chunk', messageTokens: 400 }),
          }),
        ]);

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.isObserving).toBe(true);
        expect(updated?.bufferedObservationChunks?.length ?? 0).toBe(1);
      });
    });
  });
}
