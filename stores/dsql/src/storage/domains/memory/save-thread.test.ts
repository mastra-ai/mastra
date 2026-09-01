import type { StorageThreadType } from '@mastra/core/memory';
import { describe, expect, it } from 'vitest';
import { MemoryDSQL } from './index';

type QueryValues = any[] | undefined;

interface RecordedQuery {
  query: string;
  values: QueryValues;
}

/**
 * node-postgres renders a Date parameter in the process's local timezone, so a raw Date bound to a
 * TIMESTAMP column stores the local wall clock rather than the instant. Recording the bound values
 * is enough to pin that; it does not need a live database.
 */
class RecordingDbClient {
  readonly queries: RecordedQuery[] = [];

  async none(query: string, values?: QueryValues): Promise<null> {
    this.queries.push({ query, values });
    return null;
  }

  async manyOrNone<T = any>(): Promise<T[]> {
    return [] as T[];
  }

  async oneOrNone<T = any>(): Promise<T | null> {
    return null;
  }

  async tx<T>(cb: (t: RecordingDbClient) => Promise<T>): Promise<T> {
    return cb(this);
  }
}

/** A minimal thread whose only interesting fields are the two timestamps under test. */
function makeThread(createdAt: Date, updatedAt: Date): StorageThreadType {
  return {
    id: 'thread-1',
    resourceId: 'resource-1',
    title: 'Test thread',
    metadata: {},
    createdAt,
    updatedAt,
  };
}

describe('MemoryDSQL.saveThread', () => {
  it('binds UTC strings for both timestamp column variants', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryDSQL({ client } as any);
    const createdAt = new Date('2026-07-01T12:34:56.789Z');
    const updatedAt = new Date('2026-07-02T01:02:03.456Z');

    await memory.saveThread({ thread: makeThread(createdAt, updatedAt) });

    const insert = client.queries.find(q => q.query.includes('INSERT INTO'));
    expect(insert).toBeDefined();
    expect(insert!.values![4]).toBe(createdAt.toISOString());
    expect(insert!.values![5]).toBe(createdAt.toISOString());
    expect(insert!.values![6]).toBe(updatedAt.toISOString());
    expect(insert!.values![7]).toBe(updatedAt.toISOString());
  });

  it('keeps the instant when the server runs behind UTC', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryDSQL({ client } as any);
    // 00:30Z renders as the previous calendar day west of UTC.
    const createdAt = new Date('2026-08-29T00:30:00.000Z');

    await memory.saveThread({ thread: makeThread(createdAt, createdAt) });

    const insert = client.queries.find(q => q.query.includes('INSERT INTO'));
    expect(insert!.values![4]).toBe('2026-08-29T00:30:00.000Z');
    expect(String(insert!.values![4])).toMatch(/Z$/);
  });
});

describe('MemoryDSQL.saveResource', () => {
  /**
   * saveResource does not bind its own parameters — it hands the record to
   * db.insert, whose prepareValuesForInsert passed values through untouched, so
   * a resource's Date timestamps reached the driver raw exactly as saveThread's
   * did. addTimestampZColumns copies the same values into the Z columns, so both
   * variants were affected.
   */
  it('binds UTC strings for the resource timestamps', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryDSQL({ client } as any);
    const createdAt = new Date('2026-08-29T00:30:00.000Z');
    const updatedAt = new Date('2026-08-29T01:45:00.000Z');

    await memory.saveResource({
      resource: { id: 'resource-1', workingMemory: 'wm', metadata: {}, createdAt, updatedAt },
    });

    const insert = client.queries.find(q => q.query.includes('INSERT INTO'));
    expect(insert).toBeDefined();

    const bound = insert!.values!;
    expect(bound.some(v => v instanceof Date)).toBe(false);
    expect(bound).toContain(createdAt.toISOString());
    expect(bound).toContain(updatedAt.toISOString());
    for (const value of bound) {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        expect(value).toMatch(/Z$/);
      }
    }
  });
});
