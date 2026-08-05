import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
