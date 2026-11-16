import { describe, expect, it } from 'vitest';

import { MemoryDSQL } from './index';

describe('MemoryDSQL.listMessages date range', () => {
  const start = new Date('2025-07-01T00:00:00.000Z');
  const end = new Date('2025-07-02T00:00:00.000Z');

  it.each([
    { name: 'inclusive', startExclusive: false, endExclusive: false, startOperator: '>=', endOperator: '<=' },
    { name: 'exclusive start', startExclusive: true, endExclusive: false, startOperator: '>', endOperator: '<=' },
    { name: 'exclusive end', startExclusive: false, endExclusive: true, startOperator: '>=', endOperator: '<' },
    { name: 'both exclusive', startExclusive: true, endExclusive: true, startOperator: '>', endOperator: '<' },
  ])('uses the expected bounds for $name in count and data queries', async range => {
    const queries: { query: string; values: unknown[] }[] = [];
    const client = {
      async one(query: string, values: unknown[]) {
        queries.push({ query, values });
        return { count: '0' };
      },
      async manyOrNone(query: string, values: unknown[]) {
        queries.push({ query, values });
        return [];
      },
    };
    const memory = new MemoryDSQL({ client: client as any });

    await memory.listMessages({
      threadId: 'thread-1',
      filter: { dateRange: { start, end, startExclusive: range.startExclusive, endExclusive: range.endExclusive } },
    });

    expect(queries).toHaveLength(2);
    for (const { query, values } of queries) {
      expect(query).toContain(`"createdAtZ" ${range.startOperator} $2::timestamptz`);
      expect(query).toContain(`"createdAtZ" ${range.endOperator} $3::timestamptz`);
      expect(values.slice(0, 3)).toEqual(['thread-1', start, end]);
    }
  });
});
