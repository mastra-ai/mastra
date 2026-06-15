import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadStateLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

const createTestClient = () => createClient({ url: TEST_DB_URL });

interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

const tasks = (): Task[] => [
  { id: 't1', content: 'First', status: 'pending', activeForm: 'Doing first' },
  { id: 't2', content: 'Second', status: 'in_progress', activeForm: 'Doing second' },
];

describe('ThreadStateLibSQL', () => {
  let client: Client;
  let store: ThreadStateLibSQL;

  beforeEach(async () => {
    client = createTestClient();
    store = new ThreadStateLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(() => {
    client.close();
  });

  it('returns undefined for an unset (threadId, type)', async () => {
    expect(await store.getState({ threadId: 'thread-1', type: 'task' })).toBeUndefined();
  });

  it('round-trips a JSON value', async () => {
    await store.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    expect(await store.getState({ threadId: 'thread-1', type: 'task' })).toEqual(tasks());
  });

  it('replaces the value on a subsequent set (upsert)', async () => {
    await store.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    const next: Task[] = [{ id: 't3', content: 'Third', status: 'completed', activeForm: 'Done third' }];
    await store.setState({ threadId: 'thread-1', type: 'task', value: next });
    expect(await store.getState({ threadId: 'thread-1', type: 'task' })).toEqual(next);
  });

  it('scopes state per thread and per type', async () => {
    await store.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    await store.setState({ threadId: 'thread-1', type: 'goal', value: { objective: 'ship' } });
    expect(await store.getState({ threadId: 'thread-2', type: 'task' })).toBeUndefined();
    expect(await store.getState({ threadId: 'thread-1', type: 'goal' })).toEqual({ objective: 'ship' });
  });

  it('deletes a single (threadId, type)', async () => {
    await store.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    await store.deleteState({ threadId: 'thread-1', type: 'task' });
    expect(await store.getState({ threadId: 'thread-1', type: 'task' })).toBeUndefined();
  });

  it('persists across store instances over the same database (durability)', async () => {
    await store.setState({ threadId: 'thread-1', type: 'task', value: tasks() });

    // A fresh store instance over the same DB (simulating a process restart)
    // sees the persisted value.
    const reopened = new ThreadStateLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await reopened.init();
    expect(await reopened.getState({ threadId: 'thread-1', type: 'task' })).toEqual(tasks());
  });

  it('serializes concurrent writes to the same (threadId, type) without losing data', async () => {
    // Fire multiple concurrent setState calls for the same key.
    // The write lock should serialize them so each one sees the prior state.
    const writes = Array.from({ length: 10 }, (_, i) =>
      store.setState({ threadId: 'thread-1', type: 'task', value: [{ id: `t${i}`, content: `Task ${i}`, status: 'pending', activeForm: `Doing ${i}` }] }),
    );
    await Promise.all(writes);

    // The final read should return one of the written values (last writer wins),
    // not undefined or corrupted data.
    const final = await store.getState<Task[]>({ threadId: 'thread-1', type: 'task' });
    expect(final).toBeDefined();
    expect(final).toHaveLength(1);
    expect(final![0].id).toMatch(/^t\d+$/);
  });

  it('handles concurrent writes to different (threadId, type) keys', async () => {
    const writes = Array.from({ length: 5 }, (_, i) =>
      store.setState({ threadId: `thread-${i}`, type: 'task', value: [{ id: `t${i}`, content: `Task ${i}`, status: 'pending', activeForm: `Doing ${i}` }] }),
    );
    await Promise.all(writes);

    // Each thread should have its own state
    for (let i = 0; i < 5; i++) {
      const state = await store.getState<Task[]>({ threadId: `thread-${i}`, type: 'task' });
      expect(state).toBeDefined();
      expect(state![0].id).toBe(`t${i}`);
    }
  });

  it('retries setState when the underlying execute throws a SQLITE_BUSY error', async () => {
    // Use a dedicated client/store with maxRetries: 2 so we get 1 initial attempt + 1 retry.
    const busyClient = createTestClient();
    const busyStore = new ThreadStateLibSQL({ client: busyClient, maxRetries: 2, initialBackoffMs: 1 });
    await busyStore.init();

    // Spy on the client's execute method and simulate SQLITE_BUSY on the first
    // write call, then let subsequent calls succeed.
    const originalExecute = busyClient.execute.bind(busyClient);
    let writeAttempts = 0;
    const spy = vi.spyOn(busyClient, 'execute').mockImplementation(async (stmt: any) => {
      const sql = typeof stmt === 'string' ? stmt : stmt.sql;
      if (sql.includes('INSERT INTO') || sql.includes('ON CONFLICT')) {
        writeAttempts++;
        if (writeAttempts === 1) {
          throw Object.assign(new Error('SQLITE_BUSY: database is locked'), { code: 'SQLITE_BUSY' });
        }
      }
      return originalExecute(stmt);
    });

    await busyStore.setState({ threadId: 'thread-1', type: 'task', value: tasks() });

    // The first attempt threw SQLITE_BUSY, the retry succeeded — so 2 write attempts total.
    expect(writeAttempts).toBe(2);
    const result = await busyStore.getState<Task[]>({ threadId: 'thread-1', type: 'task' });
    expect(result).toEqual(tasks());

    spy.mockRestore();
    busyClient.close();
  });
});
