import { createClient } from '@clickhouse/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageClickhouse } from './index';

afterEach(() => vi.restoreAllMocks());

describe('thread archive mutations', () => {
  it.each([new Date('2026-01-01T00:00:00.000Z'), null])(
    'waits for all replicas without changing updatedAt (archivedAt: %s)',
    async archivedAt => {
      const client = createClient();
      const command = vi.spyOn(client, 'command').mockResolvedValue({ query_id: 'archive' });
      const memory = new MemoryStorageClickhouse({ client });
      const existingThread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Thread',
        metadata: { key: 'value' },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
        archivedAt: new Date('2025-12-01T00:00:00.000Z'),
      };
      vi.spyOn(memory, 'getThreadById').mockResolvedValue(existingThread);

      try {
        const result = await memory.updateThread({ id: existingThread.id, archivedAt });

        expect(command).toHaveBeenCalledExactlyOnceWith({
          query:
            'ALTER TABLE mastra_threads UPDATE archivedAt = {archivedAt:Nullable(DateTime64(3))} WHERE id = {id:String}',
          query_params: {
            id: existingThread.id,
            archivedAt: archivedAt ? '2026-01-01T00:00:00.000' : null,
          },
          clickhouse_settings: { mutations_sync: '2' },
        });
        expect(result).toEqual({ ...existingThread, archivedAt });
      } finally {
        await client.close();
      }
    },
  );
});
