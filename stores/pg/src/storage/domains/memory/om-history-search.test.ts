import { randomUUID } from 'node:crypto';
import type { MemoryStorage } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString, TEST_CONFIG } from '../../test-utils';

describe('PostgreSQL observational memory group search', () => {
  const schemaName = `om_search_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let store: PostgresStore;
  let memory: MemoryStorage;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    store = new PostgresStore({ ...TEST_CONFIG, id: 'om-history-search', schemaName });
    await store.init();
    memory = (await store.getStore('memory'))!;
  });

  afterAll(async () => {
    await store.close().catch(() => {});
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  it('skips buffered chunks that are not stored as an array', async () => {
    const threadId = `thread-${randomUUID()}`;
    const record = await memory.initializeObservationalMemory({
      threadId,
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    await memory.updateActiveObservations({
      id: record.id,
      observations: '<observation-group id="active" range="a:b">kept</observation-group>',
      tokenCount: 1,
      lastObservedAt: new Date(),
    });
    await pool.query(
      `UPDATE "${schemaName}"."mastra_observational_memory" SET "bufferedObservationChunks" = '{}'::jsonb WHERE id = $1`,
      [record.id],
    );

    expect(await memory.getObservationalMemoryHistory(threadId, 'resource', 1, { groupId: 'missing' })).toEqual([]);
    expect(
      (await memory.getObservationalMemoryHistory(threadId, 'resource', 1, { groupId: 'active' })).map(r => r.id),
    ).toEqual([record.id]);
  });
});
