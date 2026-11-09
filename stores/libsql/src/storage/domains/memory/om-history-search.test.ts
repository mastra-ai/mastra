import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

describe('MemoryLibSQL observational memory group search', () => {
  it('skips buffered chunks that are not stored as an array', async () => {
    const client = createClient({ url: 'file::memory:' });
    const store = new MemoryLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    const record = await store.initializeObservationalMemory({
      threadId: 'thread',
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    await store.updateActiveObservations({
      id: record.id,
      observations: '<observation-group id="active" range="a:b">kept</observation-group>',
      tokenCount: 1,
      lastObservedAt: new Date(),
    });
    await client.execute({
      sql: `UPDATE mastra_observational_memory SET "bufferedObservationChunks" = '{}' WHERE id = ?`,
      args: [record.id],
    });

    expect(await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId: 'missing' })).toEqual([]);
    expect(
      (await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId: 'active' })).map(r => r.id),
    ).toEqual([record.id]);
  });
});
