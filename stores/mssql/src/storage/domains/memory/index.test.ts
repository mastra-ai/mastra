import { describe, expect, it, vi } from 'vitest';
import { MemoryMSSQL } from '.';

describe('MemoryMSSQL.listMessages', () => {
  it('keeps the WHERE prefix returned by prepareWhereClause', async () => {
    const queries: string[] = [];
    const request = () => ({
      input: vi.fn(),
      query: vi.fn(async (query: string) => {
        queries.push(query);
        return query.startsWith('SELECT COUNT') ? { recordset: [{ total: 1 }] } : { recordset: [] };
      }),
    });
    const storage = new MemoryMSSQL({ pool: { request } as any });

    await storage.listMessages({
      threadId: 'thread-1',
      filter: { metadata: { tag: 'alpha' } },
      perPage: 1,
    });

    expect(queries).toHaveLength(2);
    expect(queries.every(query => !/\bWHERE\s+WHERE\b/i.test(query))).toBe(true);
    expect(queries[0]).toContain('FROM [mastra_messages] WHERE [thread_id] = @p1 AND ISJSON(content) = 1');
  });
});
