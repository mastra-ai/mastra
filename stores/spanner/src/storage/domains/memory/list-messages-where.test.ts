import { describe, expect, it, vi } from 'vitest';

import { MemorySpanner } from './index';

type Request = { sql: string; params?: Record<string, unknown> };

function createMockDatabase() {
  const requests: Request[] = [];
  const database = {
    run: vi.fn(async (request: Request) => {
      requests.push(request);
      return request.sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
    }),
  };
  return { database, requests };
}

const whereCount = (statement: string) => statement.match(/\bWHERE\b/g)?.length ?? 0;

function expectCountAndPageQueriesScopedToThread(requests: Request[]) {
  expect(requests.map(request => request.sql.includes('COUNT(*)'))).toEqual([true, false]);
  for (const request of requests) {
    expect(whereCount(request.sql)).toBe(1);
    expect(request.sql).toContain('WHERE `thread_id` = @w0');
    expect(request.params).toMatchObject({ w0: 'thread-1' });
  }
}

describe('MemorySpanner.listMessages', () => {
  it('builds a single WHERE clause without a metadata filter', async () => {
    const { database, requests } = createMockDatabase();
    const memory = new MemorySpanner({ database: database as any });

    await memory.listMessages({ threadId: 'thread-1' });

    expectCountAndPageQueriesScopedToThread(requests);
  });

  it('keeps the thread filter alongside a metadata filter', async () => {
    const { database, requests } = createMockDatabase();
    const memory = new MemorySpanner({ database: database as any });

    await memory.listMessages({ threadId: 'thread-1', filter: { metadata: { topic: 'billing' } } });

    expectCountAndPageQueriesScopedToThread(requests);
    for (const request of requests) {
      expect(request.sql).toContain("JSON_VALUE(SAFE.PARSE_JSON(content), '$.metadata.topic') = @metadataValue0");
      expect(request.params).toMatchObject({ metadataValue0: 'billing' });
    }
  });
});
