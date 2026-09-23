import { randomUUID } from 'node:crypto';
import type { MemoryTokenBoundary, StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

export type MemoryBoundaryConformanceStores = {
  first: MemoryStorage;
  second: MemoryStorage;
  cleanup?: () => Promise<void> | void;
};

export type MemoryBoundaryConformanceOptions = {
  createStores: () => Promise<MemoryBoundaryConformanceStores> | MemoryBoundaryConformanceStores;
  repetitions?: number;
};

const boundary = (
  seconds: number,
  messageIds: string[],
  maxTokens = 100,
  atMaxRemoveTokens = 25,
): MemoryTokenBoundary => ({
  createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, seconds)).toISOString(),
  messageIds,
  maxTokens,
  atMaxRemoveTokens,
});

async function startTogether<T>(first: () => Promise<T>, second: () => Promise<T>): Promise<[T, T]> {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const firstRun = gate.then(first);
  const secondRun = gate.then(second);
  release();
  return Promise.all([firstRun, secondRun]);
}

export function createMemoryTokenBoundaryConformanceTest({
  createStores,
  repetitions = 5,
}: MemoryBoundaryConformanceOptions) {
  describe('memory token boundary conformance', () => {
    let first: MemoryStorage;
    let second: MemoryStorage;
    let cleanup: MemoryBoundaryConformanceStores['cleanup'];

    beforeEach(async () => {
      ({ first, second, cleanup } = await createStores());
      expect(first).not.toBe(second);
    });

    afterEach(async () => {
      await cleanup?.();
    });

    const saveThread = async (metadata: Record<string, unknown> = { unrelated: true }) => {
      const thread: StorageThreadType = {
        id: `boundary-${randomUUID()}`,
        resourceId: `resource-${randomUUID()}`,
        title: 'Preserve title',
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await first.saveThread({ thread });
      return thread;
    };

    it('keeps the newest same-configuration boundary across independent instances', async () => {
      for (let iteration = 0; iteration < repetitions; iteration++) {
        const thread = await saveThread();
        const older = boundary(1, [`older-${iteration}`]);
        const newer = boundary(2, [`newer-${iteration}`]);
        const stores = iteration % 2 === 0 ? [first, second] : [second, first];

        const results = await startTogether(
          () =>
            stores[0]!.advanceMemoryTokenBoundary({ id: thread.id, resourceId: thread.resourceId, candidate: newer }),
          () =>
            stores[1]!.advanceMemoryTokenBoundary({ id: thread.id, resourceId: thread.resourceId, candidate: older }),
        );

        expect(results.every(result => result.supported)).toBe(true);
        const persisted = await first.getThreadById({ threadId: thread.id, resourceId: thread.resourceId });
        expect(persisted?.metadata?.memoryTokenLimiter).toEqual(newer);
        expect(persisted?.metadata?.unrelated).toBe(true);
        expect(persisted?.title).toBe('Preserve title');
      }
    });

    it('unions equal-timestamp message IDs', async () => {
      const thread = await saveThread();
      await startTogether(
        () =>
          first.advanceMemoryTokenBoundary({
            id: thread.id,
            resourceId: thread.resourceId,
            candidate: boundary(2, ['first']),
          }),
        () =>
          second.advanceMemoryTokenBoundary({
            id: thread.id,
            resourceId: thread.resourceId,
            candidate: boundary(2, ['second']),
          }),
      );

      const persisted = await first.getThreadById({ threadId: thread.id, resourceId: thread.resourceId });
      expect((persisted?.metadata?.memoryTokenLimiter as MemoryTokenBoundary).messageIds.sort()).toEqual([
        'first',
        'second',
      ]);
    });

    it('preserves resource isolation', async () => {
      const thread = await saveThread();
      const result = await second.advanceMemoryTokenBoundary({
        id: thread.id,
        resourceId: 'another-resource',
        candidate: boundary(2, ['foreign']),
      });

      expect(result).toEqual({ supported: true, thread: null, boundary: undefined });
      expect((await first.getThreadById({ threadId: thread.id }))?.metadata).toEqual({ unrelated: true });
    });

    it('treats different normalized configurations as separate epochs', async () => {
      const thread = await saveThread();
      const firstEpoch = boundary(3, ['first-epoch'], 100, 25);
      const secondEpoch = boundary(1, ['second-epoch'], 200, 50);

      await first.advanceMemoryTokenBoundary({ id: thread.id, resourceId: thread.resourceId, candidate: firstEpoch });
      await second.advanceMemoryTokenBoundary({ id: thread.id, resourceId: thread.resourceId, candidate: secondEpoch });
      expect((await first.getThreadById({ threadId: thread.id }))?.metadata?.memoryTokenLimiter).toEqual(secondEpoch);

      const concurrent = await saveThread();
      await startTogether(
        () =>
          first.advanceMemoryTokenBoundary({
            id: concurrent.id,
            resourceId: concurrent.resourceId,
            candidate: firstEpoch,
          }),
        () =>
          second.advanceMemoryTokenBoundary({
            id: concurrent.id,
            resourceId: concurrent.resourceId,
            candidate: secondEpoch,
          }),
      );
      const persisted = (await first.getThreadById({ threadId: concurrent.id }))?.metadata
        ?.memoryTokenLimiter as MemoryTokenBoundary;
      expect([firstEpoch, secondEpoch]).toContainEqual(persisted);
    });
  });
}
