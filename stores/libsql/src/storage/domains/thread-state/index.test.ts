import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SqliteClient } from '../../db/client';
import { inWriteTransaction } from '../../db/run-fencing';
import { LibSQLStore } from '../../index';
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
});

// On a local file, a write that runs while the same store holds a write transaction open (a run lease claim
// or renewal, a workflow snapshot update) spins SQLite's busy handler on the event loop, so the transaction
// can't finish and the write fails with SQLITE_BUSY. The write has to wait for the transaction instead.
describe('ThreadStateLibSQL on a local database file', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'libsql-thread-state-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    [
      'sets',
      (store: ThreadStateLibSQL) => store.setState({ threadId: 'thread-1', type: 'goal', value: 'next' }),
      'next',
    ],
    ['deletes', (store: ThreadStateLibSQL) => store.deleteState({ threadId: 'thread-1', type: 'goal' }), undefined],
  ] as const)('%s state while another write transaction of the store is open', async (_, write, expected) => {
    // A short busy timeout, so a write that doesn't wait fails fast.
    const storage = new LibSQLStore({
      id: 'thread-state-busy',
      url: `file:${join(dir, 'mastra.db')}`,
      connectionTimeoutMs: 200,
    });
    try {
      await storage.init();
      const store = (await storage.getStore('threadState')) as ThreadStateLibSQL;
      await store.setState({ threadId: 'thread-1', type: 'goal', value: 'first' });

      let writing!: Promise<void>;
      await inWriteTransaction((storage as unknown as { client: SqliteClient }).client, async tx => {
        writing = write(store);
        await tx.execute('SELECT 1');
      });
      await writing;

      expect(await store.getState({ threadId: 'thread-1', type: 'goal' })).toEqual(expected);
    } finally {
      await storage.close();
    }
  });
});
