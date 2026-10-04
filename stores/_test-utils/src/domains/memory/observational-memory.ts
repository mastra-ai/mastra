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
      it.each(['thread', 'resource'] as const)(
        'finds buffered groups across retained generations in %s scope without activating',
        async scope => {
          const resourceId = randomUUID();
          const threadId = scope === 'thread' ? randomUUID() : null;
          const first = await memoryStorage.initializeObservationalMemory(
            createSampleOMInput({ resourceId, threadId, scope }),
          );
          const groupId = 'buffered_%.$group';
          const tag = `<observation-group id="${groupId}" range="m1:m2">original</observation-group>`;
          const chunk = {
            cycleId: randomUUID(),
            observations: 'Unicode α and "quotes"\\\n'.repeat(600) + tag,
            tokenCount: 10,
            messageIds: ['m1', 'm2'],
            messageTokens: 100,
            lastObservedAt: new Date(),
          };
          await memoryStorage.updateBufferedObservations({ id: first.id, chunk });
          const second = await memoryStorage.createReflectionGeneration({
            currentRecord: first,
            reflection: 'newer generation',
            tokenCount: 10,
          });
          await memoryStorage.updateBufferedObservations({ id: second.id, chunk: { ...chunk, cycleId: randomUUID() } });
          const before = await memoryStorage.getObservationalMemoryHistory(threadId, resourceId);
          const find = (
            options: {
              sortDirection?: 'ASC' | 'DESC';
              offset?: number;
              beforeGeneration?: number;
              groupId?: string;
            } = {},
          ) => memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, { groupId, ...options });
          // Rollover moves unactivated chunks to the new generation, so the buffered group is
          // found once, on the head, still unactivated.
          expect(before.find(r => r.id === first.id)?.bufferedObservationChunks ?? []).toEqual([]);
          expect(before.find(r => r.id === second.id)?.bufferedObservationChunks).toHaveLength(2);
          expect((await find({ sortDirection: 'ASC' })).map(r => r.id)).toEqual([second.id]);
          expect((await find()).map(r => r.id)).toEqual([second.id]);
          expect(await find({ sortDirection: 'ASC', offset: 1 })).toEqual([]);
          expect(await find({ beforeGeneration: 1 })).toEqual([]);
          expect(await find({ groupId: groupId.toUpperCase() })).toEqual([]);
          expect(await find({ groupId: groupId.slice(0, -1) })).toEqual([]);
          expect(await memoryStorage.getObservationalMemoryHistory(threadId, resourceId)).toEqual(before);
        },
      );
      it.each(['thread', 'resource'] as const)('finds existing groups before paging in %s scope', async scope => {
        const resourceId = randomUUID();
        const threadId = scope === 'thread' ? randomUUID() : null;
        const first = await memoryStorage.initializeObservationalMemory(
          createSampleOMInput({ resourceId, threadId, scope }),
        );
        const groupId = 'literal_%.$group';
        const group = (id: string) => `<observation-group id="${id}" range="m1:m2">body</observation-group>`;
        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: first,
          reflection: group(groupId),
          tokenCount: 10,
        });
        const third = await memoryStorage.createReflectionGeneration({
          currentRecord: second,
          reflection: group(groupId),
          tokenCount: 10,
        });
        await memoryStorage.createReflectionGeneration({
          currentRecord: third,
          reflection: group(`${groupId}-suffix`) + ` mentions ${groupId}`,
          tokenCount: 10,
        });

        expect(memoryStorage.supportsObservationalMemoryHistorySearch).toBe(true);
        const oldest = await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, {
          groupId,
          sortDirection: 'ASC',
        });
        expect(oldest.map(r => r.id)).toEqual([second.id]);
        const newest = await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, { groupId });
        expect(newest.map(r => r.id)).toEqual([third.id]);
        const offset = await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, {
          groupId,
          sortDirection: 'ASC',
          offset: 1,
        });
        expect(offset.map(r => r.id)).toEqual([third.id]);
        const bounded = await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, {
          groupId,
          afterGeneration: 0,
          beforeGeneration: 2,
        });
        expect(bounded.map(r => r.id)).toEqual([second.id]);
        const next = await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, {
          afterGeneration: 1,
          sortDirection: 'ASC',
        });
        expect(next.map(r => r.id)).toEqual([third.id]);
        expect(
          await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, {
            groupId: groupId.toUpperCase(),
          }),
        ).toEqual([]);
        expect(
          await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, { groupId, afterGeneration: 2 }),
        ).toEqual([]);
        expect(
          await memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, { groupId, to: new Date(0) }),
        ).toEqual([]);
        expect(
          await memoryStorage.getObservationalMemoryHistory(scope === 'thread' ? randomUUID() : null, randomUUID(), 1, {
            groupId,
          }),
        ).toEqual([]);

        const byId = (options: { recordId: string; groupId?: string }) =>
          memoryStorage.getObservationalMemoryHistory(threadId, resourceId, 1, options);
        expect((await byId({ recordId: second.id })).map(r => r.id)).toEqual([second.id]);
        expect((await byId({ recordId: second.id, groupId })).map(r => r.id)).toEqual([second.id]);
        expect(await byId({ recordId: first.id, groupId })).toEqual([]);
        expect(await byId({ recordId: randomUUID() })).toEqual([]);
        expect(
          await memoryStorage.getObservationalMemoryHistory(scope === 'thread' ? randomUUID() : null, randomUUID(), 1, {
            recordId: second.id,
          }),
        ).toEqual([]);
      });

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

        // Reflect from the record as stored (the reflection covers 'Initial observations');
        // a stale snapshot is covered by the lifecycle-safety tests.
        const current = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        const reflection = 'Condensed reflection of observations';
        const newRecord = await memoryStorage.createReflectionGeneration({
          currentRecord: current!,
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

      it('should persist extractor data on buffered chunks', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: {
            ...createChunk({ observations: 'Buffered with extraction data', messageTokens: 600 }),
            extractedValues: {
              'working-memory': { name: 'Tyler', location: 'Vancouver' },
              'weather-locations': { locations: ['Vancouver'] },
            },
            extractionFailures: [{ slug: 'failed-extractor', error: 'failed to parse' }],
          },
        });

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        expect(updated?.bufferedObservationChunks).toHaveLength(1);
        expect(updated?.bufferedObservationChunks?.[0]?.extractedValues).toEqual({
          'working-memory': { name: 'Tyler', location: 'Vancouver' },
          'weather-locations': { locations: ['Vancouver'] },
        });
        expect(updated?.bufferedObservationChunks?.[0]?.extractionFailures).toEqual([
          { slug: 'failed-extractor', error: 'failed to parse' },
        ]);
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

      it('preserves every chunk under concurrent buffered-observation appends', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);

        const CONCURRENT_CHUNKS = 8;
        const labels = Array.from({ length: CONCURRENT_CHUNKS }, (_, i) => `concurrent-chunk-${i}`);

        await Promise.all(
          labels.map(label =>
            memoryStorage.updateBufferedObservations({
              id: record.id,
              chunk: createChunk({ observations: label, messageTokens: 100 }),
            }),
          ),
        );

        const updated = await memoryStorage.getObservationalMemory(input.threadId, input.resourceId);
        const chunks = updated?.bufferedObservationChunks ?? [];
        expect(chunks.length).toBe(CONCURRENT_CHUNKS);

        // Every uniquely identified chunk must be present — no lost writes.
        const observations = chunks.map(c => c.observations).sort();
        const expected = [...labels].sort();
        expect(observations).toEqual(expected);
      });
    });

    describe('lifecycle safety', () => {
      const T0 = Date.parse('2026-01-10T12:00:00.000Z');
      const at = (ms: number) => new Date(T0 + ms);
      const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : value);
      type OMInput = ReturnType<typeof createSampleOMInput>;
      const head = async (input: OMInput) =>
        (await memoryStorage.getObservationalMemory(input.threadId, input.resourceId))!;
      const snapshot = async (input: OMInput) => structuredClone(await head(input));
      const rows = (input: OMInput) => memoryStorage.getObservationalMemoryHistory(input.threadId, input.resourceId);
      const row = async (input: OMInput, id: string) => (await rows(input)).find(r => r.id === id)!;
      const liveRows = async (input: OMInput) => (await rows(input)).filter(r => !r.supersededBy);
      const cycleIds = (record: { bufferedObservationChunks?: { cycleId: string }[] | null }) =>
        (record.bufferedObservationChunks ?? []).map(c => c.cycleId);
      /** A chunk whose newest message is at `T0 + endMs` (so its `lastObservedAt` is one ms later). */
      const chunkAt = (label: string, endMs: number, messageTokens = 500) => ({
        cycleId: `cycle-${label}-${randomUUID()}`,
        observations: `- ${label}`,
        tokenCount: 10,
        messageIds: [`msg-${label}-${randomUUID()}`],
        messageTokens,
        lastObservedAt: at(endMs + 1),
      });
      const activateAll = (id: string, currentPendingTokens: number) =>
        memoryStorage.swapBufferedToActive({
          id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens,
        });

      it('C1: rollover from a stale snapshot moves stored chunks and carries buffering state', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- base',
          tokenCount: 10,
          lastObservedAt: at(0),
        });
        const stale = await snapshot(input);

        const one = chunkAt('one', 100);
        const two = chunkAt('two', 200);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: one, lastBufferedAtTime: at(101) });
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: two, lastBufferedAtTime: at(201) });
        await memoryStorage.setPendingMessageTokens(record.id, 1234);
        await memoryStorage.setBufferingObservationFlag(record.id, true, 777);
        await memoryStorage.updateBufferedReflection({
          id: record.id,
          reflection: 'buffered reflection',
          tokenCount: 5,
          inputTokenCount: 10,
          reflectedObservationLineCount: 1,
        });

        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: stale,
          reflection: '- reflected',
          tokenCount: 5,
        });

        const current = await head(input);
        expect(next.id).not.toBe(record.id);
        expect(current.id).toBe(next.id);
        expect(current.activeObservations).toBe('- reflected');
        expect(cycleIds(current)).toEqual([one.cycleId, two.cycleId]);
        expect(iso(current.lastBufferedAtTime)).toBe(iso(at(201)));
        expect(current.lastBufferedAtTokens).toBe(777);
        expect(current.pendingMessageTokens).toBe(1234);
        expect(current.isBufferingObservation).toBe(true);
        expect(iso(current.lastObservedAt)).toBe(iso(at(0)));
        expect(current.bufferedReflection || undefined).toBeUndefined();
        expect(current.reflectedObservationLineCount || undefined).toBeUndefined();

        const retired = await row(input, record.id);
        expect(cycleIds(retired)).toEqual([]);
      });

      it('C2: rollover from a snapshot taken before an activation keeps the activated tail', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- base',
          tokenCount: 10,
          lastObservedAt: at(0),
        });
        const stale = await snapshot(input);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: chunkAt('activated', 100) });
        const activation = await activateAll(record.id, 500);
        expect(activation.chunksActivated).toBe(1);
        const stored = await head(input);
        expect(stored.activeObservations).toContain('- activated');

        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: stale,
          reflection: '- reflected',
          tokenCount: 5,
        });

        expect(next.activeObservations.startsWith('- reflected\n\n')).toBe(true);
        expect(next.activeObservations).toContain('- activated');
        expect(next.activeObservations).not.toContain('- base');
        expect(next.observationTokenCount).toBe(5 + (stored.observationTokenCount - stale.observationTokenCount));
        expect(iso(next.lastObservedAt)).toBe(iso(stored.lastObservedAt));
      });

      it('C2: rollover from an empty snapshot joins the activated tail without gluing text', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        const stale = await snapshot(input);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: chunkAt('activated', 100) });
        await activateAll(record.id, 500);

        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: stale,
          reflection: '- reflected',
          tokenCount: 5,
        });

        expect(next.activeObservations).toBe('- reflected\n\n- activated');
      });

      it('C3/C11: rollover on a retired snapshot returns the head and creates nothing', async () => {
        const input = createSampleOMInput();
        await memoryStorage.initializeObservationalMemory(input);
        const stale = await snapshot(input);
        const firstId = randomUUID();
        const first = await memoryStorage.createReflectionGeneration({
          currentRecord: stale,
          reflection: '- first',
          tokenCount: 1,
          newRecordId: firstId,
        });
        expect(first.id).toBe(firstId);

        const secondId = randomUUID();
        const second = await memoryStorage.createReflectionGeneration({
          currentRecord: stale,
          reflection: '- second',
          tokenCount: 1,
          newRecordId: secondId,
        });

        expect(second.id).toBe(firstId);
        expect(second.id).not.toBe(secondId);
        expect((await head(input)).id).toBe(firstId);
        expect(await rows(input)).toHaveLength(2);
      });

      it('C4: rollover after a non-append rewrite of the snapshot creates nothing', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '<thread id="a">\n- one\n</thread>',
          tokenCount: 10,
          lastObservedAt: at(0),
        });
        const stale = await snapshot(input);
        const merged = '<thread id="a">\n- one\n- two\n</thread>';
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: merged,
          tokenCount: 12,
          lastObservedAt: at(100),
        });

        const returned = await memoryStorage.createReflectionGeneration({
          currentRecord: stale,
          reflection: '- reflected',
          tokenCount: 5,
          newRecordId: randomUUID(),
        });

        expect(returned.id).toBe(record.id);
        expect(returned.activeObservations).toBe(merged);
        expect(await rows(input)).toHaveLength(1);
      });

      it('C5/C11: buffered reflection swap moves chunks, counts appended tokens, and tolerates a retired record', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- L1\n- L2',
          tokenCount: 10,
          lastObservedAt: at(0),
        });
        await memoryStorage.updateBufferedReflection({
          id: record.id,
          reflection: '- condensed',
          tokenCount: 3,
          inputTokenCount: 10,
          reflectedObservationLineCount: 2,
        });
        const stale = await snapshot(input);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: chunkAt('activated', 100) });
        await activateAll(record.id, 500);
        const pending = chunkAt('pending', 200);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: pending });
        const stored = await head(input);

        const newRecordId = randomUUID();
        const next = await memoryStorage.swapBufferedReflectionToActive({
          currentRecord: stale,
          tokenCount: 7,
          newRecordId,
        });

        expect(next.id).toBe(newRecordId);
        expect(next.activeObservations).toContain('- condensed');
        expect(next.activeObservations).toContain('- activated');
        expect(next.activeObservations).not.toContain('- L1');
        expect(next.observationTokenCount).toBe(7 + (stored.observationTokenCount - stale.observationTokenCount));
        expect(cycleIds(next)).toEqual([pending.cycleId]);
        expect(cycleIds(await row(input, record.id))).toEqual([]);

        const again = await memoryStorage.swapBufferedReflectionToActive({ currentRecord: stale, tokenCount: 7 });
        expect(again.id).toBe(newRecordId);
        expect(await rows(input)).toHaveLength(2);
      });

      it('C6: appends land on the head, dedupe by cycleId, skip covered retries, and never move lastBufferedAtTime back', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- base',
          tokenCount: 10,
          lastObservedAt: at(0),
        });
        const one = chunkAt('one', 100);
        const firstAppend = await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: one,
          lastBufferedAtTime: at(101),
        });
        expect(firstAppend).toEqual({ persisted: true, recordId: record.id });

        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: await snapshot(input),
          reflection: '- reflected',
          tokenCount: 5,
        });

        const two = chunkAt('two', 200);
        const lateAppend = await memoryStorage.updateBufferedObservations({
          id: record.id,
          chunk: two,
          lastBufferedAtTime: at(50),
        });
        expect(lateAppend).toEqual({ persisted: true, recordId: next.id });

        let current = await head(input);
        expect(cycleIds(current)).toEqual([one.cycleId, two.cycleId]);
        expect(iso(current.lastBufferedAtTime)).toBe(iso(at(101)));
        expect(cycleIds(await row(input, record.id))).toEqual([]);

        expect(await memoryStorage.updateBufferedObservations({ id: next.id, chunk: one })).toEqual({
          persisted: false,
          recordId: next.id,
        });
        expect(await memoryStorage.updateBufferedObservations({ id: record.id, chunk: two })).toEqual({
          persisted: false,
          recordId: next.id,
        });
        expect(cycleIds(await head(input))).toEqual([one.cycleId, two.cycleId]);

        const activation = await activateAll(next.id, 1000);
        expect(activation.chunksActivated).toBe(2);
        const retry = await memoryStorage.updateBufferedObservations({ id: next.id, chunk: two });
        expect(retry).toEqual({ persisted: false, recordId: next.id });
        current = await head(input);
        expect(cycleIds(current)).toEqual([]);
      });

      it('C7: activation on a retired record reports retired and writes nothing', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: chunkAt('one', 100) });
        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: await snapshot(input),
          reflection: '- reflected',
          tokenCount: 5,
        });
        const oldBefore = structuredClone(await row(input, record.id));
        const headBefore = structuredClone(await head(input));

        const result = await activateAll(record.id, 500);

        expect(result.retired).toBe(true);
        expect(result.chunksActivated).toBe(0);
        expect(result.activatedMessageIds).toEqual([]);
        const oldAfter = await row(input, record.id);
        const headAfter = await head(input);
        expect(headAfter.id).toBe(next.id);
        for (const [before, after] of [
          [oldBefore, oldAfter],
          [headBefore, headAfter],
        ] as const) {
          expect(after.activeObservations).toBe(before.activeObservations);
          expect(cycleIds(after)).toEqual(cycleIds(before));
          expect(iso(after.lastObservedAt)).toBe(iso(before.lastObservedAt));
        }
      });

      it('C8: activation keeps a chunk the caller did not see and honors caller weights', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        const one = chunkAt('one', 100);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: one });
        const stale = await snapshot(input);
        const two = chunkAt('two', 200);
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: two });

        const result = await memoryStorage.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 500,
          bufferedChunks: stale.bufferedObservationChunks,
        });
        expect(result.activatedCycleIds).toEqual([one.cycleId]);
        expect(cycleIds(await head(input))).toEqual([two.cycleId]);

        const weighted = createSampleOMInput();
        const weightedRecord = await memoryStorage.initializeObservationalMemory(weighted);
        await memoryStorage.updateBufferedObservations({ id: weightedRecord.id, chunk: chunkAt('a', 100) });
        await memoryStorage.updateBufferedObservations({ id: weightedRecord.id, chunk: chunkAt('b', 200) });
        const storedChunks = (await head(weighted)).bufferedObservationChunks!;
        const heavyFirst = storedChunks.map((chunk, index) =>
          index === 0 ? { ...chunk, messageTokens: 2000 } : chunk,
        );
        const weightedResult = await memoryStorage.swapBufferedToActive({
          id: weightedRecord.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 1000,
          bufferedChunks: heavyFirst,
        });
        expect(weightedResult.chunksActivated).toBe(1);
        expect((await head(weighted)).bufferedObservationChunks).toHaveLength(1);
      });

      it('C9: active-observation commits reject retired records and stale text, and never move the cursor back', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        expect(
          await memoryStorage.updateActiveObservations({
            id: record.id,
            observations: '- a',
            tokenCount: 1,
            lastObservedAt: at(100),
          }),
        ).toEqual({ applied: true });

        expect(
          await memoryStorage.updateActiveObservations({
            id: record.id,
            observations: '- b',
            tokenCount: 1,
            lastObservedAt: at(200),
            expectedActiveObservations: '- stale',
          }),
        ).toEqual({ applied: false, reason: 'conflict' });
        let current = await head(input);
        expect(current.activeObservations).toBe('- a');
        expect(iso(current.lastObservedAt)).toBe(iso(at(100)));

        expect(
          await memoryStorage.updateActiveObservations({
            id: record.id,
            observations: '- a\n- b',
            tokenCount: 2,
            lastObservedAt: at(200),
            expectedActiveObservations: '- a',
          }),
        ).toEqual({ applied: true });

        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- c',
          tokenCount: 1,
          lastObservedAt: at(50),
        });
        current = await head(input);
        expect(current.activeObservations).toBe('- c');
        expect(iso(current.lastObservedAt)).toBe(iso(at(200)));

        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: await snapshot(input),
          reflection: '- reflected',
          tokenCount: 1,
        });
        expect(
          await memoryStorage.updateActiveObservations({
            id: record.id,
            observations: '- late',
            tokenCount: 1,
            lastObservedAt: at(300),
          }),
        ).toEqual({ applied: false, reason: 'retired' });
        expect((await row(input, record.id)).activeObservations).toBe('- c');
        expect((await head(input)).id).toBe(next.id);
        expect((await head(input)).activeObservations).toBe('- reflected');
      });

      it('C10: a chunk wholly covered by the cursor is skipped, and activation never moves the cursor back', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- sync',
          tokenCount: 1,
          lastObservedAt: at(1000),
        });

        const covered = chunkAt('covered', 1000);
        expect(await memoryStorage.updateBufferedObservations({ id: record.id, chunk: covered })).toEqual({
          persisted: false,
          recordId: record.id,
        });
        const after = chunkAt('after', 1001);
        expect(await memoryStorage.updateBufferedObservations({ id: record.id, chunk: after })).toEqual({
          persisted: true,
          recordId: record.id,
        });
        const partial = chunkAt('partial', 1500);
        expect(await memoryStorage.updateBufferedObservations({ id: record.id, chunk: partial })).toEqual({
          persisted: true,
          recordId: record.id,
        });
        expect(cycleIds(await head(input))).toEqual([after.cycleId, partial.cycleId]);

        const backward = createSampleOMInput();
        const backwardRecord = await memoryStorage.initializeObservationalMemory(backward);
        await memoryStorage.updateBufferedObservations({ id: backwardRecord.id, chunk: chunkAt('early', 100) });
        await memoryStorage.updateActiveObservations({
          id: backwardRecord.id,
          observations: '- sync passed the chunk',
          tokenCount: 1,
          lastObservedAt: at(500),
        });
        await activateAll(backwardRecord.id, 500);
        expect(iso((await head(backward)).lastObservedAt)).toBe(iso(at(500)));
      });

      it('C12: writes aimed at a retired record never change it', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        await memoryStorage.updateActiveObservations({
          id: record.id,
          observations: '- a',
          tokenCount: 1,
          lastObservedAt: at(0),
        });
        await memoryStorage.updateBufferedObservations({ id: record.id, chunk: chunkAt('one', 100) });
        const nextId = randomUUID();
        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: await snapshot(input),
          reflection: '- reflected',
          tokenCount: 1,
          newRecordId: nextId,
        });
        expect(next.id).toBe(nextId);
        const oldBefore = structuredClone(await row(input, record.id));
        expect(oldBefore.supersededBy).toBe(nextId);
        expect((await head(input)).supersededBy ?? null).toBeNull();

        const late = chunkAt('late', 200);
        expect(await memoryStorage.updateBufferedObservations({ id: record.id, chunk: late })).toEqual({
          persisted: true,
          recordId: nextId,
        });
        expect((await activateAll(record.id, 500)).retired).toBe(true);
        expect(
          await memoryStorage.updateActiveObservations({
            id: record.id,
            observations: '- late',
            tokenCount: 1,
            lastObservedAt: at(300),
          }),
        ).toEqual({ applied: false, reason: 'retired' });
        expect(
          (
            await memoryStorage.createReflectionGeneration({
              currentRecord: oldBefore,
              reflection: '- x',
              tokenCount: 1,
            })
          ).id,
        ).toBe(nextId);
        expect(
          (await memoryStorage.swapBufferedReflectionToActive({ currentRecord: oldBefore, tokenCount: 1 })).id,
        ).toBe(nextId);
        await memoryStorage.setPendingMessageTokens(record.id, 999);
        await memoryStorage.setBufferingObservationFlag(record.id, true, 555);

        const oldAfter = await row(input, record.id);
        expect(oldAfter.supersededBy).toBe(nextId);
        expect(oldAfter.activeObservations).toBe(oldBefore.activeObservations);
        expect(cycleIds(oldAfter)).toEqual([]);
        expect(oldAfter.pendingMessageTokens).toBe(oldBefore.pendingMessageTokens);
        expect(oldAfter.isBufferingObservation).toBe(oldBefore.isBufferingObservation);
        expect(oldAfter.lastBufferedAtTokens).toBe(oldBefore.lastBufferedAtTokens);

        const current = await head(input);
        expect(current.id).toBe(nextId);
        expect(cycleIds(current)).toContain(late.cycleId);
        expect(current.pendingMessageTokens).toBe(999);
        expect(current.isBufferingObservation).toBe(true);
        expect(current.lastBufferedAtTokens).toBe(555);
        expect(await rows(input)).toHaveLength(2);
      });

      it('C16: writes aimed at a record several rollovers old land on the head', async () => {
        const input = createSampleOMInput();
        const first = await memoryStorage.initializeObservationalMemory(input);
        const firstSnapshot = await snapshot(input);
        for (let i = 0; i < 5; i++) {
          await memoryStorage.createReflectionGeneration({
            currentRecord: await snapshot(input),
            reflection: `- reflection ${i}`,
            tokenCount: 1,
          });
        }
        const current = await head(input);
        expect(current.generationCount).toBe(5);

        const late = chunkAt('late', 100);
        expect(await memoryStorage.updateBufferedObservations({ id: first.id, chunk: late })).toEqual({
          persisted: true,
          recordId: current.id,
        });
        await memoryStorage.setPendingMessageTokens(first.id, 321);
        await memoryStorage.setBufferingObservationFlag(first.id, true, 654);
        expect((await activateAll(first.id, 500)).retired).toBe(true);
        expect(
          (
            await memoryStorage.createReflectionGeneration({
              currentRecord: firstSnapshot,
              reflection: '- stale',
              tokenCount: 1,
            })
          ).id,
        ).toBe(current.id);

        const after = await head(input);
        expect(after.id).toBe(current.id);
        expect(cycleIds(after)).toEqual([late.cycleId]);
        expect(after.pendingMessageTokens).toBe(321);
        expect(after.isBufferingObservation).toBe(true);
        expect(after.lastBufferedAtTokens).toBe(654);
        expect(await rows(input)).toHaveLength(6);
      });

      it('C17: rollover carries config, metadata, and timezone from the stored record', async () => {
        const input = {
          ...createSampleOMInput(),
          config: { observation: { messageTokens: 1234 } },
          observedTimezone: 'Europe/Berlin',
        };
        await memoryStorage.initializeObservationalMemory(input);
        const next = await memoryStorage.createReflectionGeneration({
          currentRecord: await snapshot(input),
          reflection: '- r',
          tokenCount: 1,
        });
        const current = await head(input);
        expect(current.id).toBe(next.id);
        expect(current.generationCount).toBe(1);
        expect(current.config).toEqual({ observation: { messageTokens: 1234 } });
        expect(current.observedTimezone).toBe('Europe/Berlin');

        // Metadata can only be seeded through the optional raw insert.
        const seeded = { ...createSampleOMInput() };
        const now = new Date();
        try {
          await memoryStorage.insertObservationalMemoryRecord({
            id: randomUUID(),
            scope: seeded.scope,
            threadId: seeded.threadId,
            resourceId: seeded.resourceId,
            createdAt: now,
            updatedAt: now,
            lastObservedAt: at(0),
            originType: 'initial',
            generationCount: 0,
            activeObservations: '- a',
            totalTokensObserved: 0,
            observationTokenCount: 1,
            pendingMessageTokens: 0,
            isReflecting: false,
            isObserving: false,
            isBufferingObservation: false,
            isBufferingReflection: false,
            lastBufferedAtTokens: 0,
            lastBufferedAtTime: null,
            config: {},
            metadata: { origin: 'c17' },
          });
        } catch (error) {
          if (String(error).includes('not implemented')) return;
          throw error;
        }
        await memoryStorage.createReflectionGeneration({
          currentRecord: await snapshot(seeded),
          reflection: '- r',
          tokenCount: 1,
        });
        expect((await head(seeded)).metadata).toEqual({ origin: 'c17' });
      });

      it('C13: a lookup key has exactly one live record and it is the head', async () => {
        const input = createSampleOMInput();
        const expectOneLive = async () => {
          const live = await liveRows(input);
          expect(live.map(r => r.id)).toEqual([(await head(input)).id]);
        };
        const record = await memoryStorage.initializeObservationalMemory(input);
        await expectOneLive();
        const stale = await snapshot(input);
        await memoryStorage.createReflectionGeneration({ currentRecord: stale, reflection: '- one', tokenCount: 1 });
        await expectOneLive();
        const current = await head(input);
        await memoryStorage.updateBufferedReflection({
          id: current.id,
          reflection: '- buffered',
          tokenCount: 1,
          inputTokenCount: 1,
          reflectedObservationLineCount: 1,
        });
        await memoryStorage.swapBufferedReflectionToActive({ currentRecord: current, tokenCount: 1 });
        await expectOneLive();
        await memoryStorage.createReflectionGeneration({ currentRecord: stale, reflection: '- stale', tokenCount: 1 });
        await expectOneLive();
        expect(await memoryStorage.initializeObservationalMemory(input)).toMatchObject({ id: (await head(input)).id });
        await expectOneLive();
        expect((await row(input, record.id)).supersededBy).toBeTruthy();
      });

      it('C14: the head is the newest generation, then earliest createdAt, then lowest id', async () => {
        const input = createSampleOMInput();
        const base = await memoryStorage.initializeObservationalMemory(input);
        const duplicate = (id: string, createdAt: Date) => ({
          ...structuredClone(base),
          id,
          generationCount: 1,
          originType: 'reflection' as const,
          activeObservations: `- ${id}`,
          supersededBy: null,
          createdAt,
          updatedAt: createdAt,
        });
        try {
          await memoryStorage.insertObservationalMemoryRecord(duplicate(`b-${randomUUID()}`, at(2000)));
        } catch (error) {
          if (String(error).includes('not implemented')) return;
          throw error;
        }
        const earliest = duplicate(`c-${randomUUID()}`, at(1000));
        await memoryStorage.insertObservationalMemoryRecord(earliest);
        expect((await head(input)).id).toBe(earliest.id);

        const tie = createSampleOMInput();
        const tieBase = await memoryStorage.initializeObservationalMemory(tie);
        const tied = (id: string) => ({
          ...structuredClone(tieBase),
          id,
          generationCount: 1,
          originType: 'reflection' as const,
          supersededBy: null,
          createdAt: at(1000),
          updatedAt: at(1000),
        });
        const suffix = randomUUID();
        await memoryStorage.insertObservationalMemoryRecord(tied(`b-${suffix}`));
        await memoryStorage.insertObservationalMemoryRecord(tied(`a-${suffix}`));
        expect((await head(tie)).id).toBe(`a-${suffix}`);
      });

      it('C15: after the key is deleted, writes create nothing and initialization is deterministic', async () => {
        const input = createSampleOMInput();
        const record = await memoryStorage.initializeObservationalMemory(input);
        expect((await memoryStorage.initializeObservationalMemory(input)).id).toBe(record.id);
        const stale = await snapshot(input);
        await memoryStorage.clearObservationalMemory(input.threadId, input.resourceId);

        const settle = async (write: () => Promise<unknown>) => {
          try {
            return await write();
          } catch (error) {
            expect(String(error)).toMatch(/not found/i);
            return undefined;
          }
        };
        const append = await settle(() =>
          memoryStorage.updateBufferedObservations({ id: record.id, chunk: chunkAt('gone', 100) }),
        );
        if (append) expect(append).toMatchObject({ persisted: false });
        const swap = (await settle(() => activateAll(record.id, 500))) as { chunksActivated: number } | undefined;
        if (swap) expect(swap.chunksActivated).toBe(0);
        await expect(
          memoryStorage.updateActiveObservations({
            id: record.id,
            observations: '- gone',
            tokenCount: 1,
            lastObservedAt: at(0),
          }),
        ).rejects.toThrow(/not found/);
        await expect(memoryStorage.setPendingMessageTokens(record.id, 1)).rejects.toThrow(/not found/);
        await expect(memoryStorage.setBufferingObservationFlag(record.id, true)).rejects.toThrow(/not found/);
        expect(
          (await memoryStorage.createReflectionGeneration({ currentRecord: stale, reflection: '- x', tokenCount: 1 }))
            .id,
        ).toBe(record.id);
        expect((await memoryStorage.swapBufferedReflectionToActive({ currentRecord: stale, tokenCount: 1 })).id).toBe(
          record.id,
        );
        expect(await rows(input)).toEqual([]);

        const reinitialized = await memoryStorage.initializeObservationalMemory(input);
        expect(reinitialized.id).toBe(record.id);
        expect(await rows(input)).toHaveLength(1);
      });
    });
  });
}
