import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { QueryValues, TxClient } from '../../client';
import type { RecordedQuery } from './test-utils';
import { RecordingDbClientBase } from './test-utils';
import { MemoryPG } from './index';

class RecordingTxClient implements TxClient {
  queries: RecordedQuery[] = [];

  constructor(private readonly thread: Record<string, unknown> | null) {}

  async none(query: string, values?: QueryValues): Promise<null> {
    this.queries.push({ query, values });
    return null;
  }

  async one<T = any>(): Promise<T> {
    throw new Error('not implemented');
  }

  async oneOrNone<T = any>(query: string, values?: QueryValues): Promise<T | null> {
    this.queries.push({ query, values });
    return this.thread as T | null;
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

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }
}

class RecordingDbClient extends RecordingDbClientBase {
  readonly txClient: RecordingTxClient;

  constructor(thread: Record<string, unknown> | null) {
    super();
    this.txClient = new RecordingTxClient(thread);
  }

  override async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    return callback(this.txClient);
  }
}

const baseThread = {
  id: 'thread-1',
  resourceId: 'resource-1',
  title: 'Test thread',
  metadata: {},
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  createdAtZ: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAtZ: new Date('2025-01-01T00:00:00.000Z'),
};

describe('MemoryPG.updateThreadResourceId', () => {
  it('locks the thread and moves thread + messages inside a single transaction', async () => {
    const client = new RecordingDbClient({ ...baseThread });
    const memory = new MemoryPG({ client });

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-2' });

    const [selectQuery, threadUpdate, messageUpdate] = client.txClient.queries;

    // The row lock serializes concurrent transfers of the same thread.
    expect(selectQuery!.query).toContain('FOR UPDATE');
    expect(selectQuery!.values).toEqual(['thread-1']);

    // Both writes happen in the same transaction, so the move is all-or-nothing.
    expect(threadUpdate!.query).toContain('UPDATE "public"."mastra_threads"');
    expect(threadUpdate!.values).toEqual(['resource-2', 'thread-1']);
    expect(messageUpdate!.query).toContain('UPDATE "public"."mastra_messages"');
    expect(messageUpdate!.query).toContain('WHERE thread_id = $2');
    expect(messageUpdate!.values).toEqual(['resource-2', 'thread-1']);

    // createdAt is preserved; ownership reflects the new resource.
    expect(result.resourceId).toBe('resource-2');
    expect(result.createdAt).toEqual(baseThread.createdAt);
  });

  it('is a no-op when the thread already belongs to the target resource', async () => {
    const client = new RecordingDbClient({ ...baseThread });
    const memory = new MemoryPG({ client });

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-1' });

    // Only the locking select runs; no update statements are issued.
    expect(client.txClient.queries).toHaveLength(1);
    expect(client.txClient.queries[0]!.query).toContain('FOR UPDATE');
    expect(result.resourceId).toBe('resource-1');
  });

  it('throws when the thread does not exist', async () => {
    const client = new RecordingDbClient(null);
    const memory = new MemoryPG({ client });

    await expect(memory.updateThreadResourceId({ threadId: 'missing', resourceId: 'resource-2' })).rejects.toThrow(
      /not found/,
    );
  });
});
