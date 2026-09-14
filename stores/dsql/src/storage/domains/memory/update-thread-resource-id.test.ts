import { describe, expect, it } from 'vitest';

import { MemoryDSQL } from './index';

// Aurora DSQL has no SELECT ... FOR UPDATE, so atomicity/serialization for a transfer comes from
// running the thread read plus both updates inside a single transaction (a conflicting concurrent
// transfer is aborted by OCC and retried). These tests use a recording client to pin that the
// override issues its reads/writes inside one `tx` and preserves the thread's createdAt.

type RecordedQuery = { query: string; values: unknown[] };

function createRecordingClient(threadRow: Record<string, unknown> | null) {
  const queries: RecordedQuery[] = [];
  let inTx = false;
  const txClient = {
    async none(query: string, values: unknown[] = []) {
      queries.push({ query, values });
    },
    async oneOrNone(query: string, values: unknown[] = []) {
      queries.push({ query, values });
      return threadRow;
    },
  };
  const client = {
    queries,
    wasInTx: () => inTx,
    async tx(cb: (t: typeof txClient) => Promise<unknown>) {
      inTx = true;
      return cb(txClient);
    },
  };
  return client;
}

describe('MemoryDSQL.updateThreadResourceId', () => {
  it('reads and updates thread + messages inside a single transaction, preserving createdAt', async () => {
    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const client = createRecordingClient({
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Test',
      metadata: '{}',
      createdAtZ: createdAt,
      updatedAtZ: createdAt,
    });
    const memory = new MemoryDSQL({ client: client as any });

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-2' });

    expect(client.wasInTx()).toBe(true);
    expect(result.resourceId).toBe('resource-2');
    expect(result.createdAt).toEqual(createdAt);

    // SELECT, then UPDATE threads, then UPDATE messages — all recorded through the tx client.
    expect(client.queries).toHaveLength(3);
    expect(client.queries[0]!.query).toMatch(/SELECT \* FROM/i);
    expect(client.queries[1]!.query).toMatch(/UPDATE .*SET "resourceId"/i);
    expect(client.queries[2]!.query).toMatch(/UPDATE .*SET "resourceId" = \$1 WHERE thread_id/i);
  });

  it('is a no-op when the thread already belongs to the target resource', async () => {
    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const client = createRecordingClient({
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Test',
      metadata: '{}',
      createdAtZ: createdAt,
      updatedAtZ: createdAt,
    });
    const memory = new MemoryDSQL({ client: client as any });

    const result = await memory.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(result.resourceId).toBe('resource-1');
    // Only the SELECT is issued; no UPDATEs.
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]!.query).toMatch(/SELECT/i);
  });

  it('throws when the thread does not exist', async () => {
    const client = createRecordingClient(null);
    const memory = new MemoryDSQL({ client: client as any });

    await expect(memory.updateThreadResourceId({ threadId: 'missing', resourceId: 'resource-2' })).rejects.toThrow(
      /not found/,
    );
  });
});
