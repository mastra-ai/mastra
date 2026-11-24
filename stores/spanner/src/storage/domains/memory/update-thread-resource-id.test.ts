import { describe, expect, it, vi } from 'vitest';

import { MemorySpanner } from './index';

type Recorded = { sql: string; params?: Record<string, any> };

/**
 * Builds a mock Spanner `database` whose `runTransactionAsync` invokes the
 * callback with a transaction that records `run` (SELECT) and `runUpdate` (DML)
 * calls, so we can assert the transfer runs thread + message updates inside a
 * single transaction without a live backend.
 */
function createMockDatabase({ threadRow }: { threadRow: Record<string, any> | null }) {
  const runs: Recorded[] = [];
  const updates: Recorded[] = [];
  const calls: string[] = [];

  const tx = {
    run: vi.fn(async (request: Recorded) => {
      runs.push(request);
      return [threadRow ? [threadRow] : []];
    }),
    runUpdate: vi.fn(async (request: Recorded) => {
      updates.push(request);
      return [1];
    }),
    commit: vi.fn(async () => {
      calls.push('commit');
    }),
    rollback: vi.fn(async () => {
      calls.push('rollback');
    }),
  };

  const database = {
    // Column-metadata lookup used by SpannerDB.update; returning empty makes the
    // update pass the record through unfiltered.
    run: vi.fn(async () => [[]]),
    runTransactionAsync: vi.fn(async (cb: (t: typeof tx) => Promise<void>) => {
      calls.push('begin');
      await cb(tx);
    }),
  };

  return { database, runs, updates, calls };
}

function makeMemory(database: any) {
  return new MemorySpanner({ database });
}

const baseThreadRow = {
  id: 'thread-1',
  resourceId: 'resource-a',
  title: 'Test',
  metadata: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('MemorySpanner.updateThreadResourceId', () => {
  it('moves the thread and its messages inside a single transaction', async () => {
    const { database, runs, updates, calls } = createMockDatabase({ threadRow: { ...baseThreadRow } });
    const memory = makeMemory(database);

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-b' });

    // A single transaction was opened and committed.
    expect(calls).toEqual(['begin', 'commit']);
    // The thread row is read inside the transaction (acquiring a lock).
    expect(runs.some(r => /mastra_threads/i.test(r.sql))).toBe(true);
    // Both the thread and the messages are moved via DML inside the transaction.
    expect(updates.some(u => /UPDATE\b[^;]*mastra_threads/i.test(u.sql) && /resourceId/i.test(u.sql))).toBe(true);
    expect(updates.some(u => /UPDATE\b[^;]*mastra_messages/i.test(u.sql) && /thread_id/i.test(u.sql))).toBe(true);

    expect(result.resourceId).toBe('resource-b');
    // createdAt is preserved.
    expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
  });

  it('is a no-op when the resourceId is unchanged (no DML)', async () => {
    const { database, updates, calls } = createMockDatabase({ threadRow: { ...baseThreadRow } });
    const memory = makeMemory(database);

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-a' });

    expect(calls).toEqual(['begin', 'commit']);
    expect(updates.length).toBe(0);
    expect(result.resourceId).toBe('resource-a');
  });

  it('rolls back and throws when the thread does not exist', async () => {
    const { database, calls } = createMockDatabase({ threadRow: null });
    const memory = makeMemory(database);

    await expect(memory.updateThreadResourceId({ threadId: 'missing', resourceId: 'resource-b' })).rejects.toThrow(
      /not found/i,
    );
    expect(calls).toContain('rollback');
  });
});
