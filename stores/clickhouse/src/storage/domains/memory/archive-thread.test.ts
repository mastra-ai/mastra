import { createClient } from '@clickhouse/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageClickhouse } from './index';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const existingThread = {
  id: 'thread-1',
  resourceId: 'resource-1',
  title: 'Thread',
  metadata: { key: 'value' },
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  archivedAt: null as Date | null,
};

async function withMemory(thread: typeof existingThread, fn: (ctx: any) => Promise<void>) {
  const client = createClient();
  const command = vi.spyOn(client, 'command').mockResolvedValue({ query_id: 'q' } as any);
  const insert = vi.spyOn(client, 'insert').mockResolvedValue({ executed: true, query_id: 'q' } as any);
  const memory = new MemoryStorageClickhouse({ client });
  vi.spyOn(memory, 'getThreadById').mockResolvedValue(thread);
  try {
    await fn({ memory, command, insert });
  } finally {
    await client.close();
  }
}

describe('thread archiving on ClickHouse', () => {
  it.each([new Date('2026-01-01T00:00:00.000Z'), null])(
    'inserts a new thread version instead of mutating (archivedAt: %s)',
    async archivedAt => {
      vi.useFakeTimers({ now: new Date('2026-02-01T00:00:00.000Z') });
      await withMemory(
        { ...existingThread, archivedAt: archivedAt ? null : new Date('2025-12-01') },
        async ({ memory, command, insert }) => {
          const result = await memory.updateThread({ id: existingThread.id, archivedAt });

          expect(command).not.toHaveBeenCalled();
          expect(insert).toHaveBeenCalledOnce();
          const row = insert.mock.calls[0]![0].values[0];
          expect(insert.mock.calls[0]![0].table).toBe('mastra_threads');
          expect(row.archivedAt).toBe(archivedAt ? archivedAt.toISOString() : null);
          expect(row.updatedAt).toBe('2026-02-01T00:00:00.000Z');
          expect(row.title).toBe('Thread');
          expect(result.archivedAt).toEqual(archivedAt);
        },
      );
    },
  );

  it('keeps the new version strictly newer than the existing one when clocks collide', async () => {
    vi.useFakeTimers({ now: existingThread.updatedAt });
    await withMemory(existingThread, async ({ memory, insert }) => {
      const result = await memory.updateThread({ id: existingThread.id, archivedAt: new Date() });

      expect(result.updatedAt.getTime()).toBe(existingThread.updatedAt.getTime() + 1);
      expect(insert.mock.calls[0]![0].values[0].updatedAt).toBe('2025-01-02T00:00:00.001Z');
    });
  });
});
