import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { MemoryMySQL } from './index';

type Recorded = { sql: string; params: unknown[] };

/**
 * Builds a mock pool whose single pooled connection records every statement and
 * transaction call, and returns the given thread row for the locking SELECT.
 */
function createMockPool({ threadRow }: { threadRow: Record<string, any> | null }) {
  const statements: Recorded[] = [];
  const calls: string[] = [];

  const execute = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params });
    if (/mastra_threads/i.test(sql) && /FOR UPDATE/i.test(sql)) {
      return [threadRow ? [threadRow] : [], []];
    }
    return [[], []];
  };

  const connection = {
    execute,
    query: execute,
    beginTransaction: vi.fn(async () => {
      calls.push('begin');
    }),
    commit: vi.fn(async () => {
      calls.push('commit');
    }),
    rollback: vi.fn(async () => {
      calls.push('rollback');
    }),
    release: vi.fn(() => {
      calls.push('release');
    }),
  };

  const pool = {
    execute,
    query: execute,
    getConnection: async () => connection,
  } as unknown as Pool;

  return { pool, statements, calls, connection };
}

function makeMemory(pool: Pool) {
  const operations = new StoreOperationsMySQL({ pool, database: 'mastra' });
  return new MemoryMySQL({ pool, operations, skipDefaultIndexes: true });
}

const baseThreadRow = {
  id: 'thread-1',
  resourceId: 'resource-a',
  title: 'Test',
  metadata: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('MemoryMySQL.updateThreadResourceId', () => {
  it('moves the thread and its messages inside a single locked transaction', async () => {
    const { pool, statements, calls } = createMockPool({ threadRow: { ...baseThreadRow } });
    const memory = makeMemory(pool);

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-b' });

    // Runs inside a single committed transaction.
    expect(calls).toEqual(['begin', 'commit', 'release']);

    // Locks the thread row.
    expect(statements.some(s => /mastra_threads/i.test(s.sql) && /FOR UPDATE/i.test(s.sql))).toBe(true);
    // Updates the thread's resourceId.
    expect(statements.some(s => /UPDATE\s+`?mastra_threads/i.test(s.sql) && /resourceId/i.test(s.sql))).toBe(true);
    // Updates the messages' resourceId by thread.
    expect(statements.some(s => /UPDATE\s+`?mastra_messages/i.test(s.sql) && /thread_id/i.test(s.sql))).toBe(true);

    expect(result.resourceId).toBe('resource-b');
    // createdAt is preserved from the original row.
    expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
  });

  it('is a no-op when the resourceId is unchanged (no writes)', async () => {
    const { pool, statements, calls } = createMockPool({ threadRow: { ...baseThreadRow } });
    const memory = makeMemory(pool);

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-a' });

    expect(calls).toEqual(['begin', 'commit', 'release']);
    // No UPDATE statements were issued.
    expect(statements.some(s => /^\s*UPDATE/i.test(s.sql))).toBe(false);
    expect(result.resourceId).toBe('resource-a');
  });

  it('rolls back and throws when the thread does not exist', async () => {
    const { pool, calls } = createMockPool({ threadRow: null });
    const memory = makeMemory(pool);

    await expect(memory.updateThreadResourceId({ threadId: 'missing', resourceId: 'resource-b' })).rejects.toThrow(
      /not found/i,
    );
    expect(calls).toEqual(['begin', 'rollback', 'release']);
  });
});
