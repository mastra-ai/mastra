import { TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStorageClickhouse } from './index';

/**
 * Regression test for #25580.
 *
 * deleteMessages used `ALTER TABLE mastra_threads UPDATE updatedAt = ...` to
 * bump the thread timestamp. Mutations rewrite whole data parts, are often
 * forbidden on managed deployments, and set the SAME updatedAt on every stored
 * version of the thread row — on a ReplacingMergeTree read with
 * `ORDER BY updatedAt DESC LIMIT 1`, the "latest" version becomes ambiguous
 * until parts merge (a just-renamed/archived thread can read back its previous
 * state). The bump must instead insert a strictly newer thread version, like
 * every other thread write in this store.
 */
describe('MemoryStorageClickhouse.deleteMessages thread bump', () => {
  const existingUpdatedAt = '2026-01-01T00:00:00.000Z';

  function buildStore() {
    const query = vi
      .fn()
      // 1st query: SELECT DISTINCT thread_id ... (JSONEachRow format)
      .mockResolvedValueOnce({ json: async () => [{ thread_id: 'thread-1' }] })
      // 2nd query: getLatestThreads (default format with .data)
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 'thread-1',
              resourceId: 'resource-1',
              title: 'Renamed title',
              metadata: '{"archived":true}',
              createdAt: '2025-12-01T00:00:00.000Z',
              updatedAt: existingUpdatedAt,
            },
          ],
        }),
      });
    const command = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockResolvedValue(undefined);
    const store = new MemoryStorageClickhouse({ client: { query, command, insert } as any });
    return { store, query, command, insert };
  }

  it('inserts a strictly newer thread version instead of mutating stored rows', async () => {
    const { store, command, insert } = buildStore();

    await store.deleteMessages(['message-1']);

    // No ALTER TABLE ... UPDATE mutation may be issued.
    const commandQueries = command.mock.calls.map(call => String(call[0]?.query));
    expect(commandQueries.some(q => q.includes('ALTER TABLE'))).toBe(false);
    // The message delete still happens.
    expect(commandQueries.some(q => q.startsWith('DELETE FROM'))).toBe(true);

    // A new thread version is inserted, preserving the latest thread state.
    const threadInsert = insert.mock.calls.find(call => call[0]?.table === TABLE_THREADS)?.[0];
    expect(threadInsert).toBeDefined();
    const [row] = threadInsert.values;
    expect(row).toMatchObject({
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Renamed title',
      metadata: '{"archived":true}',
    });
    // Strictly newer than the version read, so the bump always wins the
    // ReplacingMergeTree "latest row by updatedAt" read.
    expect(new Date(row.updatedAt).getTime()).toBeGreaterThan(new Date(existingUpdatedAt).getTime());
  });

  it('skips the thread bump when the thread rows are already gone', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [{ thread_id: 'thread-1' }] })
      .mockResolvedValueOnce({ json: async () => ({ data: [] }) });
    const command = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockResolvedValue(undefined);
    const store = new MemoryStorageClickhouse({ client: { query, command, insert } as any });

    await store.deleteMessages(['message-1']);

    expect(insert).not.toHaveBeenCalled();
    const commandQueries = command.mock.calls.map(call => String(call[0]?.query));
    expect(commandQueries.some(q => q.includes('ALTER TABLE'))).toBe(false);
  });
});
