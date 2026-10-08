import { describe, expect, it, vi } from 'vitest';

import { MemorySpanner } from './index';

function createMockDatabase() {
  const sql: string[] = [];
  const database = {
    run: vi.fn(async (request: { sql: string }) => {
      sql.push(request.sql);
      return request.sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
    }),
  };
  return { database, sql };
}

const whereCount = (statement: string) => statement.match(/\bWHERE\b/g)?.length ?? 0;

describe('MemorySpanner.listMessages', () => {
  it('builds a single WHERE clause without a metadata filter', async () => {
    const { database, sql } = createMockDatabase();
    const memory = new MemorySpanner({ database: database as any });

    await memory.listMessages({ threadId: 'thread-1' });

    expect(sql.length).toBeGreaterThan(0);
    for (const statement of sql) {
      expect(whereCount(statement)).toBe(1);
    }
  });

  it('builds a single WHERE clause with a metadata filter', async () => {
    const { database, sql } = createMockDatabase();
    const memory = new MemorySpanner({ database: database as any });

    await memory.listMessages({ threadId: 'thread-1', filter: { metadata: { topic: 'billing' } } });

    expect(sql.length).toBeGreaterThan(0);
    for (const statement of sql) {
      expect(whereCount(statement)).toBe(1);
      expect(statement).toContain('JSON_VALUE');
    }
  });
});
