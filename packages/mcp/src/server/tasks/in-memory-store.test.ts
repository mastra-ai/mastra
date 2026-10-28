import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailedTaskSchema, TASKS_ERROR_CODES } from '../../shared/tasks';
import { InMemoryMCPTaskStore } from './in-memory-store';
import type { MCPTaskAttempt, MCPTaskAttemptOutcome } from './store';

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

  it('keeps a task whose TTL is longer than the longest timer delay', async () => {
    store = new InMemoryMCPTaskStore();
    // 30 days: past setTimeout's 2^31-1 ms limit, where Node fires after 1 ms instead.
    const { taskId } = await store.create({ ttlMs: 30 * 86_400_000, principal: 'alice' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await store.get(taskId, alice)).toMatchObject({ status: 'working' });
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

  describe('run', () => {
    const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
    const settled = async (taskId: string, status: string) => {
      await vi.waitFor(async () => expect((await store.get(taskId, alice))?.status).toBe(status));
      return store.get(taskId, alice);
    };

    it('awaits an initial attempt in place of the first call to work, and uses work for the resume', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      const work = vi.fn(async (attempt: MCPTaskAttempt) => ({
        status: 'completed' as const,
        result: text(`resumed with ${JSON.stringify(attempt.resume?.inputResponses)}`),
      }));
      let finishInitial!: (outcome: MCPTaskAttemptOutcome) => void;
      const abort = vi.fn();
      store.run(taskId, work, {
        initialAttempt: { outcome: new Promise(resolve => (finishInitial = resolve)), abort },
      });
      await Promise.resolve();
      expect(work).not.toHaveBeenCalled();

      finishInitial({ status: 'input_required', inputRequests: { a: elicit('A?') }, suspendPayload: 'p' });
      await settled(taskId, 'input_required');
      expect(work).not.toHaveBeenCalled();

      await store.update(taskId, { a: { action: 'accept', content: {} } }, alice);
      expect(await settled(taskId, 'completed')).toMatchObject({
        result: text('resumed with {"a":{"action":"accept","content":{}}}'),
      });
      expect(work).toHaveBeenCalledTimes(1);
      expect(work.mock.calls[0]![0].resume).toEqual({
        inputResponses: { a: { action: 'accept', content: {} } },
        suspendPayload: 'p',
      });
      expect(abort).not.toHaveBeenCalled();
    });

    it('aborts an initial attempt still running when the task is cancelled', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      const work = vi.fn();
      const abort = vi.fn();
      let finishInitial!: (outcome: MCPTaskAttemptOutcome) => void;
      store.run(taskId, work, {
        initialAttempt: { outcome: new Promise(resolve => (finishInitial = resolve)), abort },
      });
      await store.cancel(taskId, alice);
      expect(abort).toHaveBeenCalledTimes(1);
      finishInitial({ status: 'completed', result: text('late') });
      expect((await settled(taskId, 'cancelled'))?.status).toBe('cancelled');
      expect(work).not.toHaveBeenCalled();
    });

    it('records the result of the work', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      store.run(taskId, async () => ({ status: 'completed', result: text('done') }));

      expect(await settled(taskId, 'completed')).toMatchObject({ result: text('done') });
    });

    it('runs the work again with the answers once every input key is answered', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      const attempts: MCPTaskAttempt[] = [];
      store.run(taskId, async attempt => {
        attempts.push(attempt);
        if (!attempt.resume) {
          return { status: 'input_required', inputRequests: { a: elicit('a?'), b: elicit('b?') }, suspendPayload: 7 };
        }
        return { status: 'completed', result: text(JSON.stringify(attempt.resume)) };
      });

      expect(await settled(taskId, 'input_required')).toMatchObject({ inputRequests: { a: elicit('a?') } });
      // Unknown keys are ignored and a partial answer keeps waiting.
      await store.update(taskId, { stale: { action: 'accept', content: {} }, a: { action: 'decline' } }, alice);
      expect(await store.get(taskId, alice)).toMatchObject({
        status: 'input_required',
        inputRequests: { b: elicit('b?') },
      });
      expect(attempts).toHaveLength(1);

      await store.update(taskId, { b: { action: 'accept', content: { v: 2 } } }, alice);
      const resume = {
        inputResponses: { a: { action: 'decline' }, b: { action: 'accept', content: { v: 2 } } },
        suspendPayload: 7,
      };
      expect(await settled(taskId, 'completed')).toMatchObject({ result: text(JSON.stringify(resume)) });
      expect(attempts).toHaveLength(2);
      expect(attempts[1]!.signal).toBe(attempts[0]!.signal);
    });

    it('fails the task when an attempt reuses an input key', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      store.run(taskId, async () => ({ status: 'input_required', inputRequests: { a: elicit('?') } }));
      await settled(taskId, 'input_required');
      await store.update(taskId, { a: { action: 'accept', content: {} } }, alice);

      expect(await settled(taskId, 'failed')).toMatchObject({
        error: { code: TASKS_ERROR_CODES.InternalError, message: /"a" was already used/ },
      });
    });

    it('fails the task when an attempt rejects, and aborts its signal', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      let signal: AbortSignal | undefined;
      store.run(taskId, async attempt => {
        signal = attempt.signal;
        throw new Error('executor lost');
      });

      expect(await settled(taskId, 'failed')).toMatchObject({
        error: { code: TASKS_ERROR_CODES.InternalError, message: 'executor lost' },
      });
      expect(signal?.aborted).toBe(true);
    });

    it('aborts the attempt on cancel and ignores its later outcome', async () => {
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
      let finish!: () => void;
      let signal: AbortSignal | undefined;
      store.run(taskId, attempt => {
        signal = attempt.signal;
        return new Promise(resolve => {
          finish = () => resolve({ status: 'completed', result: text('late') });
        });
      });
      await vi.waitFor(() => expect(signal).toBeDefined());

      await store.cancel(taskId, alice);
      expect(signal?.aborted).toBe(true);
      finish();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect((await store.get(taskId, alice))?.status).toBe('cancelled');
    });

    it('fails a task whose TTL elapses while it waits for input, without running it again', async () => {
      vi.useFakeTimers({ now: 0 });
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: 1_000, principal: 'alice' });
      const work = vi.fn(async () => ({ status: 'input_required' as const, inputRequests: { a: elicit('?') } }));
      store.run(taskId, work);
      await vi.advanceTimersByTimeAsync(0);
      expect((await store.get(taskId, alice))?.status).toBe('input_required');

      await vi.advanceTimersByTimeAsync(1_000);
      expect(await store.get(taskId, alice)).toMatchObject({ status: 'failed', error: { message: /expired/ } });
      await store.update(taskId, { a: { action: 'accept', content: {} } }, alice);
      await vi.advanceTimersByTimeAsync(0);
      expect(work).toHaveBeenCalledTimes(1);
    });

    it('aborts an initial attempt when the TTL elapses, and ignores its late outcome', async () => {
      vi.useFakeTimers({ now: 0 });
      store = new InMemoryMCPTaskStore();
      const { taskId } = await store.create({ ttlMs: 1_000, principal: 'alice' });
      const work = vi.fn();
      const abort = vi.fn();
      let finishInitial!: (outcome: MCPTaskAttemptOutcome) => void;
      store.run(taskId, work, {
        initialAttempt: { outcome: new Promise(resolve => (finishInitial = resolve)), abort },
      });

      await vi.advanceTimersByTimeAsync(1_000);
      expect(abort).toHaveBeenCalledTimes(1);
      expect(await store.get(taskId, alice)).toMatchObject({
        status: 'failed',
        error: { code: TASKS_ERROR_CODES.InternalError, message: expect.stringMatching(/expired/) },
      });

      finishInitial({ status: 'completed', result: text('late') });
      await vi.advanceTimersByTimeAsync(0);
      expect(await store.get(taskId, alice)).toMatchObject({ status: 'failed' });
      expect(work).not.toHaveBeenCalled();
    });
  });
});
