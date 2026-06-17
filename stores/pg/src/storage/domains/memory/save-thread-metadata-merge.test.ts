import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { DbClient, QueryValues, TxClient } from '../../client';
import { MemoryPG } from './index';

type RecordedQuery = {
  query: string;
  values?: QueryValues;
};

class RecordingDbClient implements DbClient {
  readonly $pool = {} as DbClient['$pool'];
  readonly queries: RecordedQuery[] = [];

  connect(): Promise<never> {
    throw new Error('not implemented');
  }

  async none(query: string, values?: QueryValues): Promise<null> {
    this.queries.push({ query, values });
    return null;
  }

  async one<T = any>(): Promise<T> {
    throw new Error('not implemented');
  }

  async oneOrNone<T = any>(): Promise<T | null> {
    return null;
  }

  async any<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async manyOrNone<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async many<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async query(): Promise<QueryResult> {
    throw new Error('not implemented');
  }

  async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    throw new Error('not implemented');
  }
}

describe('MemoryPG.saveThread', () => {
  it('uses COALESCE merge instead of replacing metadata on conflict', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test thread',
        metadata: { key: 'value' },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

    expect(client.queries).toHaveLength(1);
    const [upsertQuery] = client.queries;
    expect(upsertQuery!.query).toContain('COALESCE');
    expect(upsertQuery!.query).toContain('||');
    expect(upsertQuery!.query).not.toContain('metadata = EXCLUDED.metadata');
  });

  it('passes null metadata through without clobbering existing keys', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test thread',
        metadata: null as any,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

    expect(client.queries).toHaveLength(1);
    const [upsertQuery] = client.queries;
    // COALESCE handles the null incoming metadata, preserving existing keys
    expect(upsertQuery!.query).toContain("COALESCE(EXCLUDED.metadata, '{}'::jsonb)");
  });
});
