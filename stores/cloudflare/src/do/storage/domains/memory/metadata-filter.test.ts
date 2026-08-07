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

  it('binds resourceId into the include lookup without shifting the other placeholders', async () => {
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
      resourceId: 'resource-1',
      include: [{ id: 'message-1', withPreviousMessages: 2, withNextMessages: 3 }],
    });

    const includeQuery = queries.find(query => query.sql.includes('target_thread'));
    expect(includeQuery).toBeDefined();
    expect(includeQuery!.sql.match(/resourceId = \?/g)).toHaveLength(2);
    expect(includeQuery!.params).toEqual(['message-1', 'resource-1', 'resource-1', 'message-1', 'message-1', 3, 2]);
    expect(includeQuery!.sql.split('?').length - 1).toBe(includeQuery!.params.length);
  });

  it('leaves the include lookup unbound when no resourceId is given', async () => {
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
      include: [{ id: 'message-1', withPreviousMessages: 2, withNextMessages: 3 }],
    });

    const includeQuery = queries.find(query => query.sql.includes('target_thread'));
    expect(includeQuery).toBeDefined();
    expect(includeQuery!.sql).not.toContain('resourceId = ?');
    expect(includeQuery!.params).toEqual(['message-1', 'message-1', 'message-1', 3, 2]);
    expect(includeQuery!.sql.split('?').length - 1).toBe(includeQuery!.params.length);
  });
});
