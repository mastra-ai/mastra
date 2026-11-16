import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

describe('MemoryLibSQL.updateThread metadata', () => {
  let client: Client;
  let store: MemoryLibSQL;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    store = new MemoryLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Original title',
        metadata: { seeded: true },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await client.execute(`DELETE FROM mastra_threads`);
    client.close();
  });

  it('keeps a metadata write that lands while a title-only update is in flight', async () => {
    // Another process commits new metadata just before updateThread's UPDATE runs.
    const otherProcess = createClient({ url: TEST_DB_URL });
    const execute = client.execute.bind(client);
    const spy = vi.spyOn(client, 'execute').mockImplementation((async (statement: any) => {
      if (typeof statement === 'object' && /^UPDATE mastra_threads SET title/.test(statement.sql)) {
        spy.mockImplementation(execute as any);
        await otherProcess.execute({
          sql: `UPDATE mastra_threads SET metadata = jsonb(?) WHERE id = ?`,
          args: [JSON.stringify({ seeded: true, progress: 'observed' }), 'thread-1'],
        });
      }
      return execute(statement);
    }) as any);

    const updated = await store.updateThread({ id: 'thread-1', title: 'New title' });

    expect(spy).toHaveBeenCalled();
    vi.restoreAllMocks();
    otherProcess.close();
    const stored = await store.getThreadById({ threadId: 'thread-1' });
    expect(stored?.title).toBe('New title');
    expect(stored?.metadata).toEqual({ seeded: true, progress: 'observed' });
    expect(updated.title).toBe('New title');
    expect(updated.metadata).toEqual({ seeded: true, progress: 'observed' });
  });

  it('still merges metadata when it is passed', async () => {
    const updated = await store.updateThread({ id: 'thread-1', metadata: { added: 1 } });

    expect(updated.metadata).toEqual({ seeded: true, added: 1 });
    expect(updated.title).toBe('Original title');
    expect((await store.getThreadById({ threadId: 'thread-1' }))?.metadata).toEqual({ seeded: true, added: 1 });
  });

  it('throws not found for a title-only update of a missing thread', async () => {
    await expect(store.updateThread({ id: 'missing', title: 'x' })).rejects.toThrow('Thread missing not found');
  });
});
