import { describe, expect, it, beforeEach } from 'vitest';

import type { TaskRecord } from './base';
import { InMemoryThreadStateStorage } from './inmemory';

const THREAD = 'thread-1';
const TASK = 'task';

function tasks(): TaskRecord[] {
  return [
    { id: 't1', content: 'First', status: 'pending', activeForm: 'Doing first' },
    { id: 't2', content: 'Second', status: 'in_progress', activeForm: 'Doing second' },
  ];
}

describe('InMemoryThreadStateStorage', () => {
  let store: InMemoryThreadStateStorage;

  beforeEach(() => {
    store = new InMemoryThreadStateStorage();
  });

  it('returns undefined for an unset (threadId, type)', async () => {
    expect(await store.getState({ threadId: THREAD, type: TASK })).toBeUndefined();
  });

  it('round-trips a set value', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    expect(await store.getState({ threadId: THREAD, type: TASK })).toEqual(tasks());
  });

  it('replaces the value on a subsequent set (full replacement)', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    const next: TaskRecord[] = [{ id: 't3', content: 'Third', status: 'completed', activeForm: 'Done third' }];
    await store.setState({ threadId: THREAD, type: TASK, value: next });
    expect(await store.getState({ threadId: THREAD, type: TASK })).toEqual(next);
  });

  it('scopes state per thread', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    expect(await store.getState({ threadId: 'thread-2', type: TASK })).toBeUndefined();
  });

  it('scopes state per type', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    await store.setState({ threadId: THREAD, type: 'goal', value: { objective: 'ship it' } });
    expect(await store.getState({ threadId: THREAD, type: TASK })).toEqual(tasks());
    expect(await store.getState({ threadId: THREAD, type: 'goal' })).toEqual({ objective: 'ship it' });
  });

  it('clones on write (mutating the input does not affect stored state)', async () => {
    const input = tasks();
    await store.setState({ threadId: THREAD, type: TASK, value: input });
    input[0]!.status = 'completed';
    expect((await store.getState<TaskRecord[]>({ threadId: THREAD, type: TASK }))![0]!.status).toBe('pending');
  });

  it('clones on read (mutating the result does not affect stored state)', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    const read = await store.getState<TaskRecord[]>({ threadId: THREAD, type: TASK });
    read![0]!.status = 'completed';
    expect((await store.getState<TaskRecord[]>({ threadId: THREAD, type: TASK }))![0]!.status).toBe('pending');
  });

  it('returns distinct object references across reads', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    const a = await store.getState({ threadId: THREAD, type: TASK });
    const b = await store.getState({ threadId: THREAD, type: TASK });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('deletes a single (threadId, type)', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    await store.setState({ threadId: THREAD, type: 'goal', value: { objective: 'x' } });
    await store.deleteState({ threadId: THREAD, type: TASK });
    expect(await store.getState({ threadId: THREAD, type: TASK })).toBeUndefined();
    expect(await store.getState({ threadId: THREAD, type: 'goal' })).toEqual({ objective: 'x' });
  });

  it('is a no-op to delete an unset (threadId, type)', async () => {
    await expect(store.deleteState({ threadId: THREAD, type: TASK })).resolves.toBeUndefined();
  });

  it('dangerouslyClearAll removes all state', async () => {
    await store.setState({ threadId: THREAD, type: TASK, value: tasks() });
    await store.setState({ threadId: 'thread-2', type: TASK, value: tasks() });
    await store.dangerouslyClearAll();
    expect(await store.getState({ threadId: THREAD, type: TASK })).toBeUndefined();
    expect(await store.getState({ threadId: 'thread-2', type: TASK })).toBeUndefined();
  });
});
