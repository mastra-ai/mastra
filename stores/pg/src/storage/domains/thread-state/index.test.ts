import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';
import { ThreadStatePG } from './index';

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

describe('ThreadStatePG', () => {
  let store: PostgresStore;
  let threadState: ThreadStatePG;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
    threadState = new ThreadStatePG({ client: store.db });
    await threadState.init();
  });

  afterAll(async () => {
    try {
      await store.close();
    } catch {}
  });

  beforeEach(async () => {
    await threadState.dangerouslyClearAll();
  });

  it('is registered on PostgresStore as the threadState domain', async () => {
    const domain = await store.getStore('threadState');
    expect(domain).toBeInstanceOf(ThreadStatePG);
  });

  it('returns undefined for an unset (threadId, type)', async () => {
    expect(await threadState.getState({ threadId: 'thread-1', type: 'task' })).toBeUndefined();
  });

  it('round-trips a JSON value', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    expect(await threadState.getState({ threadId: 'thread-1', type: 'task' })).toEqual(tasks());
  });

  it('replaces the value on a subsequent set (upsert)', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    const next: Task[] = [{ id: 't3', content: 'Third', status: 'completed', activeForm: 'Done third' }];
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: next });

    expect(await threadState.getState({ threadId: 'thread-1', type: 'task' })).toEqual(next);
    const rows = await store.db.any(`SELECT 1 FROM mastra_thread_state WHERE "threadId" = 'thread-1'`);
    expect(rows).toHaveLength(1);
  });

  it('preserves createdAt and advances updatedAt across an upsert', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    const before = await store.db.one<{ createdAt: Date; updatedAt: Date }>(
      `SELECT "createdAt", "updatedAt" FROM mastra_thread_state WHERE "threadId" = 'thread-1' AND "type" = 'task'`,
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: [] });

    const after = await store.db.one<{ createdAt: Date; updatedAt: Date }>(
      `SELECT "createdAt", "updatedAt" FROM mastra_thread_state WHERE "threadId" = 'thread-1' AND "type" = 'task'`,
    );
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('scopes state per thread and per type', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    await threadState.setState({ threadId: 'thread-1', type: 'goal', value: { objective: 'ship' } });

    expect(await threadState.getState({ threadId: 'thread-2', type: 'task' })).toBeUndefined();
    expect(await threadState.getState({ threadId: 'thread-1', type: 'goal' })).toEqual({ objective: 'ship' });
    expect(await threadState.getState({ threadId: 'thread-1', type: 'task' })).toEqual(tasks());
  });

  it('deletes only the targeted (threadId, type)', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: tasks() });
    await threadState.setState({ threadId: 'thread-1', type: 'goal', value: { objective: 'ship' } });

    await threadState.deleteState({ threadId: 'thread-1', type: 'task' });

    expect(await threadState.getState({ threadId: 'thread-1', type: 'task' })).toBeUndefined();
    expect(await threadState.getState({ threadId: 'thread-1', type: 'goal' })).toEqual({ objective: 'ship' });
  });

  it('deleting an unset slot is a no-op', async () => {
    await expect(threadState.deleteState({ threadId: 'nope', type: 'task' })).resolves.toBeUndefined();
  });

  it('stores the value as queryable jsonb rather than an opaque string', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'goal', value: { objective: 'ship', runsUsed: 3 } });

    const row = await store.db.one<{ objective: string }>(
      `SELECT "value"->>'objective' AS objective FROM mastra_thread_state
       WHERE "threadId" = 'thread-1' AND "type" = 'goal'`,
    );
    expect(row.objective).toBe('ship');
  });

  it('round-trips values that are not objects', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'count', value: 42 });
    await threadState.setState({ threadId: 'thread-1', type: 'flag', value: false });

    expect(await threadState.getState({ threadId: 'thread-1', type: 'count' })).toBe(42);
    expect(await threadState.getState({ threadId: 'thread-1', type: 'flag' })).toBe(false);
  });

  it('persists across store instances (durability across a process restart)', async () => {
    await threadState.setState({ threadId: 'thread-1', type: 'task', value: tasks() });

    const reopened = new ThreadStatePG({ client: store.db });
    await reopened.init();
    expect(await reopened.getState({ threadId: 'thread-1', type: 'task' })).toEqual(tasks());
  });

  it('includes its table in the exported schema DDL', () => {
    const ddl = ThreadStatePG.getExportDDL().join('\n');
    expect(ddl).toContain('mastra_thread_state');
    expect(ddl).toContain('PRIMARY KEY ("threadId", "type")');
  });
});
