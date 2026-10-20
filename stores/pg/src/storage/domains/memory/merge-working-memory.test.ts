import { randomUUID } from 'node:crypto';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';
import { TEST_CONFIG } from '../../test-utils';

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/24756.
 *
 * Each PostgresStore has its own pool, so several stores stand in for several
 * processes sharing one database.
 */
describe('PostgreSQL atomic working memory merge', () => {
  const schemaName = `wm_merge_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const STORE_COUNT = 3;
  let stores: PostgresStore[];
  let memories: MemoryStorage[];

  const addField = (key: string) => (existing: string | undefined) =>
    JSON.stringify({ ...(existing ? JSON.parse(existing) : {}), [key]: true });

  beforeAll(async () => {
    stores = Array.from(
      { length: STORE_COUNT },
      (_, i) => new PostgresStore({ ...TEST_CONFIG, id: `wm-merge-${i}`, schemaName }),
    );
    await stores[0]!.init();
    await Promise.all(stores.slice(1).map(store => store.init()));
    memories = await Promise.all(stores.map(async store => (await store.getStore('memory'))!));
  });

  afterAll(async () => {
    await stores[0]!.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {});
    await Promise.all(stores.map(store => store.close().catch(() => {})));
  });

  it('advertises support', () => {
    expect(memories[0]!.supportsAtomicWorkingMemoryMerge).toBe(true);
  });

  it('keeps every field when many processes merge disjoint fields at once, including the first write', async () => {
    const resourceId = `resource-${randomUUID()}`;
    const keys = Array.from({ length: 24 }, (_, i) => `k${i}`);

    await Promise.all(
      keys.map((key, i) => memories[i % STORE_COUNT]!.mergeResourceWorkingMemory({ resourceId, merge: addField(key) })),
    );

    const resource = await memories[0]!.getResourceById({ resourceId });
    expect(Object.keys(JSON.parse(resource!.workingMemory!)).sort()).toEqual([...keys].sort());
  });

  it('preserves resource metadata', async () => {
    const resourceId = `resource-${randomUUID()}`;
    await memories[0]!.updateResource({ resourceId, workingMemory: '{"a":1}', metadata: { owner: 'x' } });

    const result = await memories[1]!.mergeResourceWorkingMemory({ resourceId, merge: addField('b') });

    const resource = await memories[0]!.getResourceById({ resourceId });
    expect(resource!.metadata).toEqual({ owner: 'x' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ a: 1, b: true });
    expect(result.workingMemory).toBe(resource!.workingMemory);
  });

  it('rolls back when the merge callback throws', async () => {
    const resourceId = `resource-${randomUUID()}`;
    await memories[0]!.updateResource({ resourceId, workingMemory: '{"a":1}' });

    const boom = new Error('boom');
    await expect(
      memories[0]!.mergeResourceWorkingMemory({
        resourceId,
        merge: () => {
          throw boom;
        },
      }),
    ).rejects.toBe(boom);

    const resource = await memories[0]!.getResourceById({ resourceId });
    expect(resource!.workingMemory).toBe('{"a":1}');
  });

  it('does not create a resource when the first merge throws', async () => {
    const resourceId = `resource-${randomUUID()}`;
    await expect(
      memories[0]!.mergeResourceWorkingMemory({
        resourceId,
        merge: () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow('boom');
    expect(await memories[0]!.getResourceById({ resourceId })).toBeNull();
  });
});
