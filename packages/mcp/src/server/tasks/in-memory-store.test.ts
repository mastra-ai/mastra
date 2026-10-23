import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailedTaskSchema, TASKS_ERROR_CODES } from '../../shared/tasks';
import { InMemoryMCPTaskStore } from './in-memory-store';

const alice = { principal: 'alice' };
const bob = { principal: 'bob' };
const elicit = (message: string) => ({
  method: 'elicitation/create',
  params: { mode: 'form', message, requestedSchema: { type: 'object', properties: {} } },
});

describe('InMemoryMCPTaskStore', () => {
  let store: InMemoryMCPTaskStore;

  afterEach(() => {
    store?.close();
    vi.useRealTimers();
  });

  it('is readable as soon as create resolves, with an unguessable id', async () => {
    store = new InMemoryMCPTaskStore();
    const created = await store.create({ ttlMs: 60_000, principal: 'alice' });
    const other = await store.create({ ttlMs: 60_000, principal: 'alice' });

    expect(created.taskId).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(other.taskId).not.toBe(created.taskId);
    const task = await store.get(created.taskId, alice);
    expect(DetailedTaskSchema.parse(task)).toMatchObject({ taskId: created.taskId, status: 'working', ttlMs: 60_000 });
  });

  it('hides a task from every other principal on get, update and cancel', async () => {
    store = new InMemoryMCPTaskStore();
    const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });

    expect(await store.get(taskId, bob)).toBeUndefined();
    expect(await store.update(taskId, {}, bob)).toBe(false);
    expect(await store.cancel(taskId, bob)).toBe(false);
    expect((await store.get(taskId, alice))?.status).toBe('working');
  });

  it('continues the same execution after input instead of re-running it', async () => {
    store = new InMemoryMCPTaskStore();
    const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
    const handle = store.handle(taskId);
    let runs = 0;
    const execution = (async () => {
      runs++;
      const answers = await handle.requireInput({ a: elicit('first?'), b: elicit('second?') });
      handle.complete({ content: [{ type: 'text', text: JSON.stringify(answers) }] });
    })();

    const waiting = await store.get(taskId, alice);
    expect(waiting).toMatchObject({
      status: 'input_required',
      inputRequests: { a: elicit('first?'), b: elicit('second?') },
    });

    // A partial answer keeps the task waiting and only lists the open key; unknown keys are ignored.
    await store.update(taskId, { a: { action: 'accept', content: { v: 1 } }, nope: { action: 'decline' } }, alice);
    expect(await store.get(taskId, alice)).toMatchObject({
      status: 'input_required',
      inputRequests: { b: elicit('second?') },
    });
    // An already-answered key is ignored: the first answer wins.
    await store.update(taskId, { a: { action: 'decline' }, b: { action: 'accept', content: { v: 2 } } }, alice);
    await execution;

    const done = await store.get(taskId, alice);
    expect(done?.status).toBe('completed');
    expect(done).toMatchObject({
      result: {
        content: [
          {
            text: JSON.stringify({
              a: { action: 'accept', content: { v: 1 } },
              b: { action: 'accept', content: { v: 2 } },
            }),
          },
        ],
      },
    });
    expect(runs).toBe(1);
  });

  it('refuses to reuse an input key over the task lifetime', async () => {
    store = new InMemoryMCPTaskStore();
    const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
    const handle = store.handle(taskId);
    const first = handle.requireInput({ a: elicit('?') });
    await store.update(taskId, { a: { action: 'accept', content: {} } }, alice);
    await first;

    await expect(handle.requireInput({ a: elicit('again?') })).rejects.toThrow(/already used/);
  });

  it('cancel aborts the work, rejects a pending input wait and is a no-op once terminal', async () => {
    store = new InMemoryMCPTaskStore();
    const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
    const handle = store.handle(taskId);
    const waiting = handle.requireInput({ a: elicit('?') });

    expect(await store.cancel(taskId, alice)).toBe(true);
    await expect(waiting).rejects.toThrow(/cancelled/);
    expect(handle.signal.aborted).toBe(true);
    handle.complete({ content: [] });
    expect((await store.get(taskId, alice))?.status).toBe('cancelled');
    expect(await store.cancel(taskId, alice)).toBe(true);
  });

  it('keeps a tool error as a completed task and an infrastructure error as failed', async () => {
    store = new InMemoryMCPTaskStore();
    const toolError = await store.create({ ttlMs: null, principal: 'alice' });
    store.handle(toolError.taskId).complete({ isError: true, content: [{ type: 'text', text: 'boom' }] });
    const infra = await store.create({ ttlMs: null, principal: 'alice' });
    store.handle(infra.taskId).fail({ code: TASKS_ERROR_CODES.InternalError, message: 'executor lost' });

    expect(await store.get(toolError.taskId, alice)).toMatchObject({ status: 'completed', result: { isError: true } });
    expect(await store.get(infra.taskId, alice)).toMatchObject({
      status: 'failed',
      error: { message: 'executor lost' },
    });
  });

  it('fails an expired task, aborts its work, then forgets it', async () => {
    vi.useFakeTimers({ now: 0 });
    store = new InMemoryMCPTaskStore({ expiredRetentionMs: 1_000 });
    const { taskId } = await store.create({ ttlMs: 5_000, principal: 'alice' });
    const handle = store.handle(taskId);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(handle.signal.aborted).toBe(true);
    expect(await store.get(taskId, alice)).toMatchObject({ status: 'failed', error: { message: /expired/ } });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await store.get(taskId, alice)).toBeUndefined();
  });

  it('suggests a faster poll interval while the task is young unless one is fixed', async () => {
    vi.useFakeTimers({ now: 0 });
    store = new InMemoryMCPTaskStore();
    const auto = await store.create({ ttlMs: null, principal: 'alice' });
    const fixed = await store.create({ ttlMs: null, principal: 'alice', pollIntervalMs: 750 });

    expect(auto.pollIntervalMs).toBe(2_000);
    vi.setSystemTime(61_000);
    expect((await store.get(auto.taskId, alice))?.pollIntervalMs).toBe(5_000);
    expect((await store.get(fixed.taskId, alice))?.pollIntervalMs).toBe(750);
  });

  it('rejects invalid ttl and poll values', async () => {
    store = new InMemoryMCPTaskStore();
    await expect(store.create({ ttlMs: -1, principal: 'alice' })).rejects.toThrow(RangeError);
    await expect(store.create({ ttlMs: null, principal: 'alice', pollIntervalMs: 1.5 })).rejects.toThrow(RangeError);
  });
});
