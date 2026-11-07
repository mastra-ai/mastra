import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString } from '../../test-utils';
import type { MemoryPG } from '.';

describe('thread metadata filter on a resource with many threads', () => {
  const schemaName = `thread_meta_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const resourceId = 'factory-project';
  let store: PostgresStore;
  let memory: MemoryPG;

  beforeAll(async () => {
    store = new PostgresStore({ id: 'thread-metadata-index-store', connectionString, schemaName });
    await store.init();
    memory = (await store.getStore('memory')) as MemoryPG;

    await store.db.none(
      `INSERT INTO "${schemaName}".mastra_threads (id, "resourceId", title, metadata, "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
       SELECT 'thread-' || g, $1, 'Thread ' || g,
              jsonb_build_object('projectPath', '/work/worktree-' || (g % 500), 'tokenUsage', jsonb_build_object('input', g)),
              now(), now(), now(), now()
       FROM generate_series(1, 5000) g`,
      [resourceId],
    );
    await store.db.none(`ANALYZE "${schemaName}".mastra_threads`);
  }, 60000);

  afterAll(async () => {
    await store?.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await store?.close();
  });

  it('answers the tag filter from an index instead of reading every thread of the resource', async () => {
    const readSpy = vi.spyOn(store.readDb, 'manyOrNone');

    const { threads } = await memory.listThreads({
      filter: { resourceId, metadata: { projectPath: '/work/worktree-42' } },
      perPage: false,
    });
    const [query, values] = readSpy.mock.calls.find(([sql]) => String(sql).includes('mastra_threads'))!;
    readSpy.mockRestore();

    expect(threads).toHaveLength(10);
    const plan = await store.db.manyOrNone<{ 'QUERY PLAN': string }>(`EXPLAIN ${String(query)}`, values);
    expect(plan.map(row => row['QUERY PLAN']).join('\n')).toMatch(/Index Cond: \(metadata @> /);
  });
});
