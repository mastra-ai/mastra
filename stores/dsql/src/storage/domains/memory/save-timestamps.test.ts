import { describe, expect, it } from 'vitest';

import { MemoryDSQL } from './index';

// node-postgres serializes Date parameters using the process's local timezone, so
// TIMESTAMP (without time zone) columns end up storing the local wall clock. These
// tests pin that we bind UTC ISO strings instead.

type RecordedQuery = { query: string; values: unknown[] };

function createRecordingClient() {
  const queries: RecordedQuery[] = [];
  const client = {
    queries,
    async none(query: string, values: unknown[] = []) {
      queries.push({ query, values });
    },
  };
  return client;
}

function columnsOf(query: string): string[] {
  const match = query.match(/\(([^)]*)\)\s*VALUES/i);
  return (match?.[1] ?? '')
    .split(',')
    .map(c => c.trim().replace(/"/g, ''))
    .filter(Boolean);
}

describe('MemoryDSQL.saveThread', () => {
  it('binds UTC strings for both timestamp column variants', async () => {
    const client = createRecordingClient();
    const memory = new MemoryDSQL({ client: client as any });
    const createdAt = new Date('2025-07-01T12:34:56.789Z');
    const updatedAt = new Date('2025-07-02T01:02:03.456Z');

    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test thread',
        metadata: {},
        createdAt,
        updatedAt,
      },
    });

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]!.values).toEqual([
      'thread-1',
      'resource-1',
      'Test thread',
      '{}',
      createdAt.toISOString(),
      createdAt.toISOString(),
      updatedAt.toISOString(),
      updatedAt.toISOString(),
    ]);
  });
});

describe('MemoryDSQL.saveResource', () => {
  it('binds UTC strings for both timestamp column variants', async () => {
    const client = createRecordingClient();
    const memory = new MemoryDSQL({ client: client as any });
    const createdAt = new Date('2025-07-01T12:34:56.789Z');
    const updatedAt = new Date('2025-07-02T01:02:03.456Z');

    await memory.saveResource({
      resource: {
        id: 'resource-1',
        workingMemory: 'Test memory',
        metadata: {},
        createdAt,
        updatedAt,
      },
    });

    expect(client.queries).toHaveLength(1);
    const { query, values } = client.queries[0]!;
    const columns = columnsOf(query);
    const valueFor = (column: string) => values[columns.indexOf(column)];

    expect(values.some(v => v instanceof Date)).toBe(false);
    expect(valueFor('createdAt')).toBe(createdAt.toISOString());
    expect(valueFor('createdAtZ')).toBe(createdAt.toISOString());
    expect(valueFor('updatedAt')).toBe(updatedAt.toISOString());
    expect(valueFor('updatedAtZ')).toBe(updatedAt.toISOString());
  });
});
