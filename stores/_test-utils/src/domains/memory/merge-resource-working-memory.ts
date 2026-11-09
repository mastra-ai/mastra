import { randomUUID } from 'node:crypto';
import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Self-contained (no closures), so it can run in a child process store too. */
const increment = (existing: string | undefined) => String(Number(existing ?? 0) + 1);

const addField = (key: string) => (existing: string | undefined) =>
  JSON.stringify({ ...(existing ? JSON.parse(existing) : {}), [key]: true });

/**
 * Conformance tests for `mergeResourceWorkingMemory` on adapters that set
 * `supportsAtomicWorkingMemoryMerge`. Skipped on adapters that don't.
 */
export function createMergeResourceWorkingMemoryTest({ storage }: { storage: MastraStorage }) {
  let memory: MemoryStorage;

  beforeAll(async () => {
    const store = await storage.getStore('memory');
    if (!store) throw new Error('Memory storage not found');
    memory = store;
  });

  describe('mergeResourceWorkingMemory', () => {
    it('keeps every field when many merges run at once, including the first write', async ctx => {
      if (!memory.supportsAtomicWorkingMemoryMerge) return ctx.skip();
      const resourceId = `resource-${randomUUID()}`;
      const keys = Array.from({ length: 24 }, (_, i) => `k${i}`);

      const results = await Promise.all(
        keys.map(key => memory.mergeResourceWorkingMemory({ resourceId, merge: addField(key) })),
      );

      const resource = await memory.getResourceById({ resourceId });
      expect(Object.keys(JSON.parse(resource!.workingMemory!)).sort()).toEqual([...keys].sort());
      expect(results.every(result => result.id === resourceId)).toBe(true);
    });

    it('passes undefined to merge for a missing resource and creates it', async ctx => {
      if (!memory.supportsAtomicWorkingMemoryMerge) return ctx.skip();
      const resourceId = `resource-${randomUUID()}`;
      const seen: (string | undefined)[] = [];

      const result = await memory.mergeResourceWorkingMemory({
        resourceId,
        merge: existing => {
          seen.push(existing);
          return '{"a":1}';
        },
      });

      expect(seen).toEqual([undefined]);
      expect(result.workingMemory).toBe('{"a":1}');
      const resource = await memory.getResourceById({ resourceId });
      expect(resource!.workingMemory).toBe('{"a":1}');
    });

    it('preserves resource metadata and returns the stored working memory', async ctx => {
      if (!memory.supportsAtomicWorkingMemoryMerge) return ctx.skip();
      const resourceId = `resource-${randomUUID()}`;
      await memory.updateResource({ resourceId, workingMemory: '{"a":1}', metadata: { owner: 'x' } });

      const result = await memory.mergeResourceWorkingMemory({ resourceId, merge: addField('b') });

      const resource = await memory.getResourceById({ resourceId });
      expect(resource!.metadata).toEqual({ owner: 'x' });
      expect(JSON.parse(resource!.workingMemory!)).toEqual({ a: 1, b: true });
      expect(result.workingMemory).toBe(resource!.workingMemory);
    });

    it('writes nothing when the merge callback throws', async ctx => {
      if (!memory.supportsAtomicWorkingMemoryMerge) return ctx.skip();
      const resourceId = `resource-${randomUUID()}`;
      await memory.updateResource({ resourceId, workingMemory: '{"a":1}' });

      const boom = new Error('boom');
      await expect(
        memory.mergeResourceWorkingMemory({
          resourceId,
          merge: () => {
            throw boom;
          },
        }),
      ).rejects.toBe(boom);

      const resource = await memory.getResourceById({ resourceId });
      expect(resource!.workingMemory).toBe('{"a":1}');
    });

    it('does not create a resource when the first merge throws', async ctx => {
      if (!memory.supportsAtomicWorkingMemoryMerge) return ctx.skip();
      const resourceId = `resource-${randomUUID()}`;
      await expect(
        memory.mergeResourceWorkingMemory({
          resourceId,
          merge: () => {
            throw new Error('boom');
          },
        }),
      ).rejects.toThrow('boom');
      expect(await memory.getResourceById({ resourceId })).toBeNull();
    });
  });
}

export interface MergeResourceWorkingMemoryConcurrencyStores {
  /** Independent store instances (separate clients, connections or processes) on the same database. */
  stores: MemoryStorage[];
  cleanup?: () => Promise<void>;
}

/**
 * Cross-connection race for `mergeResourceWorkingMemory`: every store increments the same
 * resource's counter at once, so any lost update shows up as a final count below the total.
 */
export function createMergeResourceWorkingMemoryConcurrencyTests({
  label,
  createStores,
  mergesPerStore = 12,
  timeout = 120_000,
}: {
  label: string;
  createStores: () => Promise<MergeResourceWorkingMemoryConcurrencyStores>;
  mergesPerStore?: number;
  timeout?: number;
}) {
  describe(`${label} mergeResourceWorkingMemory concurrency`, () => {
    let setup: MergeResourceWorkingMemoryConcurrencyStores;

    beforeAll(async () => {
      setup = await createStores();
    }, timeout);

    afterAll(async () => {
      await setup?.cleanup?.();
    }, timeout);

    it(
      'loses no update when several stores merge into the same resource, including the first write',
      async () => {
        const resourceId = `resource-${randomUUID()}`;

        await Promise.all(
          setup.stores.flatMap(store =>
            Array.from({ length: mergesPerStore }, () =>
              store.mergeResourceWorkingMemory({ resourceId, merge: increment }),
            ),
          ),
        );

        const resource = await setup.stores[0]!.getResourceById({ resourceId });
        expect(resource!.workingMemory).toBe(String(setup.stores.length * mergesPerStore));
      },
      timeout,
    );
  });
}
