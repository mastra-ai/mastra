import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskRecord } from './base';
import { InMemoryTasksStorage } from './inmemory';

const THREAD_A = 'thread-a';
const THREAD_B = 'thread-b';

function tasks(): TaskRecord[] {
  return [
    { id: 't1', content: 'First task', status: 'in_progress', activeForm: 'Doing first task' },
    { id: 't2', content: 'Second task', status: 'pending', activeForm: 'Doing second task' },
  ];
}

describe('InMemoryTasksStorage', () => {
  let store: InMemoryTasksStorage;

  beforeEach(() => {
    store = new InMemoryTasksStorage();
  });

  it('init is a no-op and resolves', async () => {
    await expect(store.init()).resolves.toBeUndefined();
  });

  it('returns an empty array for a thread with no tasks', async () => {
    expect(await store.getTasks(THREAD_A)).toEqual([]);
  });

  it('stores and returns the task list for a thread', async () => {
    await store.setTasks(THREAD_A, tasks());
    expect(await store.getTasks(THREAD_A)).toEqual(tasks());
  });

  it('replaces the whole list on each set (full-replacement semantics)', async () => {
    await store.setTasks(THREAD_A, tasks());
    const replacement: TaskRecord[] = [{ id: 't3', content: 'Only task', status: 'completed', activeForm: 'Done' }];
    await store.setTasks(THREAD_A, replacement);
    expect(await store.getTasks(THREAD_A)).toEqual(replacement);
  });

  it('scopes task lists per thread', async () => {
    await store.setTasks(THREAD_A, tasks());
    expect(await store.getTasks(THREAD_B)).toEqual([]);

    const bTasks: TaskRecord[] = [{ id: 'b1', content: 'B task', status: 'pending', activeForm: 'Doing B' }];
    await store.setTasks(THREAD_B, bTasks);
    expect(await store.getTasks(THREAD_A)).toEqual(tasks());
    expect(await store.getTasks(THREAD_B)).toEqual(bTasks);
  });

  it('clones on write so mutating the input array does not affect stored tasks', async () => {
    const input = tasks();
    await store.setTasks(THREAD_A, input);

    input[0]!.status = 'completed';
    input.push({ id: 't9', content: 'Injected', status: 'pending', activeForm: 'Injecting' });

    expect(await store.getTasks(THREAD_A)).toEqual(tasks());
  });

  it('clones on read so mutating the returned array does not affect stored tasks', async () => {
    await store.setTasks(THREAD_A, tasks());

    const read = await store.getTasks(THREAD_A);
    read[0]!.status = 'completed';
    read.push({ id: 't9', content: 'Injected', status: 'pending', activeForm: 'Injecting' });

    expect(await store.getTasks(THREAD_A)).toEqual(tasks());
  });

  it('returns distinct task object references across reads', async () => {
    await store.setTasks(THREAD_A, tasks());

    const first = await store.getTasks(THREAD_A);
    const second = await store.getTasks(THREAD_A);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });

  it('deletes the task list for a thread', async () => {
    await store.setTasks(THREAD_A, tasks());
    await store.setTasks(THREAD_B, tasks());

    await store.deleteTasks(THREAD_A);

    expect(await store.getTasks(THREAD_A)).toEqual([]);
    expect(await store.getTasks(THREAD_B)).toEqual(tasks());
  });

  it('deleting a thread with no tasks is a no-op', async () => {
    await expect(store.deleteTasks(THREAD_A)).resolves.toBeUndefined();
    expect(await store.getTasks(THREAD_A)).toEqual([]);
  });

  it('dangerouslyClearAll removes every thread list', async () => {
    await store.setTasks(THREAD_A, tasks());
    await store.setTasks(THREAD_B, tasks());

    await store.dangerouslyClearAll();

    expect(await store.getTasks(THREAD_A)).toEqual([]);
    expect(await store.getTasks(THREAD_B)).toEqual([]);
  });
});
