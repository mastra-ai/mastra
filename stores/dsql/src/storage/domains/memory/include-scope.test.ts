import { describe, expect, it } from 'vitest';

import { MemoryDSQL } from './index';

/**
 * Records every statement the memory domain sends so the include lookup can be
 * inspected without a live Aurora DSQL cluster.
 */
function createRecordingClient() {
  const queries: { sql: string; params: unknown[] }[] = [];
  const record = async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    return [];
  };
  const client = {
    manyOrNone: record,
    any: record,
    oneOrNone: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      return { count: '0' };
    },
    one: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      return { count: '0' };
    },
    none: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      return undefined;
    },
  };
  return { client, queries };
}

/** Highest `$n` placeholder used by a statement. */
function highestPlaceholder(sql: string): number {
  const placeholders = [...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
  return placeholders.length === 0 ? 0 : Math.max(...placeholders);
}

describe('MemoryDSQL include scoping', () => {
  it('binds resourceId as the last placeholder of each include block', async () => {
    const { client, queries } = createRecordingClient();
    const memory = new MemoryDSQL({ client } as never);

    await memory.listMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      include: [{ id: 'message-1', withPreviousMessages: 2, withNextMessages: 3 }],
    });

    const includeQuery = queries.find(query => query.sql.includes('target_thread'));
    expect(includeQuery).toBeDefined();
    expect(includeQuery!.sql.match(/"resourceId" = \$4/g)).toHaveLength(2);
    expect(includeQuery!.params).toEqual(['message-1', 2, 3, 'resource-1']);
    expect(highestPlaceholder(includeQuery!.sql)).toBe(includeQuery!.params.length);
  });

  it('keeps placeholders contiguous across multiple include items', async () => {
    const { client, queries } = createRecordingClient();
    const memory = new MemoryDSQL({ client } as never);

    await memory.listMessages({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      include: [
        { id: 'message-1', withPreviousMessages: 1, withNextMessages: 1 },
        { id: 'message-2', withPreviousMessages: 2, withNextMessages: 2 },
      ],
    });

    const includeQuery = queries.find(query => query.sql.includes('target_thread'));
    expect(includeQuery).toBeDefined();
    expect(includeQuery!.params).toEqual(['message-1', 1, 1, 'resource-1', 'message-2', 2, 2, 'resource-1']);
    expect(highestPlaceholder(includeQuery!.sql)).toBe(includeQuery!.params.length);
  });

  it('omits the resource predicate when no resourceId is given', async () => {
    const { client, queries } = createRecordingClient();
    const memory = new MemoryDSQL({ client } as never);

    await memory.listMessages({
      threadId: 'thread-1',
      include: [{ id: 'message-1', withPreviousMessages: 2, withNextMessages: 3 }],
    });

    const includeQuery = queries.find(query => query.sql.includes('target_thread'));
    expect(includeQuery).toBeDefined();
    expect(includeQuery!.sql).not.toContain('"resourceId" =');
    expect(includeQuery!.params).toEqual(['message-1', 2, 3]);
    expect(highestPlaceholder(includeQuery!.sql)).toBe(includeQuery!.params.length);
  });
});
