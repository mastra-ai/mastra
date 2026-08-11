import { describe, expect, it } from 'vitest';

import { MemoryStorageDO } from './index';

describe('MemoryStorageDO message metadata filters', () => {
  it('adds exact scalar predicates to data and count queries', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const sql = {
      exec(query: string, ...params: unknown[]) {
        queries.push({ sql: query, params });
        return { toArray: () => (query.includes('count() as count') ? [{ count: 0 }] : []) };
      },
    };
    const memory = new MemoryStorageDO({ sql: sql as never });

    await memory.listMessages({
      threadId: 'thread-1',
      filter: { metadata: { source: 'chat', attempt: 2, reviewed: true, archived: false, deletedAt: null } },
    });

    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.sql).toContain(`json_type(content, ?) = 'text'`);
      expect(query.sql).toContain(`json_type(content, ?) IN ('integer', 'real')`);
      expect(query.sql).toContain(`json_type(content, ?) = 'null'`);
      expect(query.params).toEqual(
        expect.arrayContaining([
          '$.metadata.source',
          '$.metadata.attempt',
          '$.metadata.reviewed',
          '$.metadata.archived',
        ]),
      );
    }
  });
});
