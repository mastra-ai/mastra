import { describe, expect, it, vi } from 'vitest';
import type { MCPDetailedTask, MCPTask } from '../../shared/tasks';
import { isRecoverableTaskPollError } from '../error-utils';
import { MAX_TASK_POLL_INTERVAL_MS, MIN_TASK_POLL_INTERVAL_MS, TaskWaitError, waitForTask } from './wait';
import type { TaskWaitPort } from './wait';

const created: MCPTask = {
  taskId: 'task-1',
  status: 'working',
  createdAt: new Date(0).toISOString(),
  lastUpdatedAt: new Date(0).toISOString(),
  ttlMs: 24 * 60 * 60_000,
  pollIntervalMs: 1_000,
};
const completed = { ...created, status: 'completed', result: { content: [] } } as MCPDetailedTask;
const refused = () => new Error('connect ECONNREFUSED 127.0.0.1:4111');

/** A port over a scripted sequence of `tasks/get` outcomes, on a fake clock advanced by `sleep`. */
function scripted(outcomes: Array<MCPDetailedTask | Error>, overrides: Partial<TaskWaitPort> = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const port: TaskWaitPort = {
    get: vi.fn(async () => {
      const next = outcomes.length > 1 ? outcomes.shift()! : outcomes[0]!;
      if (next instanceof Error) throw next;
      return next;
    }),
    update: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    isRecoverable: isRecoverableTaskPollError,
    recover: vi.fn(async () => {}),
    ...overrides,
  };
  const options = {
    now: () => clock,
    sleep: async (ms: number, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      sleeps.push(ms);
      clock += ms;
    },
  };
  return { port, options, sleeps, elapsed: () => clock };
}

describe('waitForTask near the task TTL', () => {
  it('does not sleep past the TTL when the poll interval is longer, and expires at the deadline', async () => {
    const working = { ...created, ttlMs: 10_000, pollIntervalMs: 60 * 60_000 } as MCPDetailedTask;
    const { port, options, sleeps } = scripted([working]);

    const error = await waitForTask(port, working, options).catch(e => e);

    expect(error).toBeInstanceOf(TaskWaitError);
    expect(error.reason).toBe('expired');
    expect(sleeps).toEqual([10_000]);
    expect(port.get).toHaveBeenCalledTimes(1);
  });

  it('still returns a result that the poll at the deadline brings back', async () => {
    const working = { ...created, ttlMs: 10_000, pollIntervalMs: 60 * 60_000 } as MCPDetailedTask;
    const { port, options, sleeps } = scripted([{ ...completed, ttlMs: 10_000 } as MCPDetailedTask]);

    await expect(waitForTask(port, working, options)).resolves.toMatchObject({ status: 'completed' });
    expect(sleeps).toEqual([10_000]);
  });
});

describe('waitForTask during a server outage', () => {
  it('reports the created task and each later status change once', async () => {
    const working = { ...created, statusMessage: 'still going' } as MCPDetailedTask;
    const { port, options } = scripted([working, working, completed]);
    const statuses: string[] = [];

    await waitForTask(port, created, { ...options, onStatus: task => statuses.push(task.status) });

    expect(statuses).toEqual(['working', 'completed']);
  });

  it('keeps polling through a run of connection failures and backs off', async () => {
    const { port, options, sleeps } = scripted([...Array.from({ length: 8 }, refused), completed]);

    await expect(waitForTask(port, created, options)).resolves.toMatchObject({ status: 'completed' });

    // The first sleep is the regular poll interval; the outage then doubles up to the 30s cap.
    expect(sleeps).toEqual([1_000, 1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
    expect(port.recover).toHaveBeenCalledTimes(8);
  });

  it('retries a 502 from a proxy in front of the server', async () => {
    const badGateway = Object.assign(new Error('Error POSTing to endpoint (HTTP 502)'), { status: 502 });
    const { port, options } = scripted([badGateway, badGateway, badGateway, badGateway, completed]);

    await expect(waitForTask(port, created, options)).resolves.toMatchObject({ status: 'completed' });
  });

  it('keeps going when reconnecting fails while the server is down', async () => {
    const { port, options } = scripted([refused(), refused(), refused(), refused(), completed], {
      recover: vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    });

    await expect(waitForTask(port, created, options)).resolves.toMatchObject({ status: 'completed' });
  });

  it('ends the wait when reconnecting fails for a reason that is not an outage', async () => {
    const { port, options } = scripted([refused(), completed], {
      recover: vi.fn(async () => {
        throw new Error('MCP client was disconnected');
      }),
    });

    await expect(waitForTask(port, created, options)).rejects.toThrow('MCP client was disconnected');
  });

  it('reports the server as unreachable once the outage outlasts maxOutageMs', async () => {
    const { port, options, elapsed } = scripted([refused()]);

    const error = await waitForTask(port, created, { ...options, maxOutageMs: 60_000 }).catch(e => e);

    expect(error).toBeInstanceOf(TaskWaitError);
    expect(error).toMatchObject({
      reason: 'unreachable',
      cause: expect.objectContaining({ message: expect.any(String) }),
    });
    expect(error.message).toMatch(/Couldn't reach the MCP server for 60s while waiting for task task-1/);
    // One regular poll interval, then exactly the outage window.
    expect(elapsed()).toBe(61_000);
    expect(port.cancel).not.toHaveBeenCalled();
  });

  it('stops at the task TTL even when the outage window is longer', async () => {
    const { port, options, elapsed } = scripted([refused()]);

    const error = await waitForTask(port, { ...created, ttlMs: 20_000 }, options).catch(e => e);

    expect(error).toMatchObject({ reason: 'unreachable' });
    expect(elapsed()).toBe(20_000);
  });

  it('counts the TTL from when it first saw the task when createdAt does not parse', async () => {
    const { port, options, elapsed } = scripted([refused()]);

    const error = await waitForTask(port, { ...created, createdAt: 'not a date', ttlMs: 20_000 }, options).catch(
      e => e,
    );

    expect(error).toMatchObject({ reason: 'unreachable' });
    expect(elapsed()).toBe(20_000);
  });

  it('times out and cancels when maxWaitMs ends during the outage', async () => {
    const { port, options } = scripted([refused()]);

    await expect(waitForTask(port, created, { ...options, maxWaitMs: 10_000 })).rejects.toMatchObject({
      reason: 'timeout',
    });
    expect(port.cancel).toHaveBeenCalledWith('task-1');
  });

  it('fails at once on a protocol error such as an unknown task', async () => {
    const notFound = Object.assign(new Error('Task not found'), { code: -32602 });
    const { port, options } = scripted([notFound]);

    await expect(waitForTask(port, created, options)).rejects.toBe(notFound);
    expect(port.recover).not.toHaveBeenCalled();
  });

  it('stops and cancels when aborted during the outage', async () => {
    const controller = new AbortController();
    const { port, options } = scripted([refused()], {
      recover: vi.fn(async () => controller.abort(new Error('user stopped'))),
    });

    await expect(waitForTask(port, created, { ...options, signal: controller.signal })).rejects.toThrow('user stopped');
    expect(port.cancel).toHaveBeenCalledWith('task-1');
  });
});

describe('waitForTask with a server-chosen poll interval', () => {
  const eager = { ...created, pollIntervalMs: 0, ttlMs: null } as MCPTask;
  const working = { ...eager } as MCPDetailedTask;

  it('waits at least the minimum between polls when the server asks for 0ms', async () => {
    const { port, options, sleeps } = scripted([working, working, working, completed]);

    await expect(waitForTask(port, eager, options)).resolves.toMatchObject({ status: 'completed' });
    expect(sleeps).toEqual([
      MIN_TASK_POLL_INTERVAL_MS,
      MIN_TASK_POLL_INTERVAL_MS,
      MIN_TASK_POLL_INTERVAL_MS,
      MIN_TASK_POLL_INTERVAL_MS,
    ]);
  });

  it('waits at most the maximum between polls when the server asks for longer than a timer allows', async () => {
    const lazy = { ...eager, pollIntervalMs: 30 * 86_400_000 } as MCPDetailedTask;
    const { port, options, sleeps } = scripted([lazy, completed]);

    await expect(waitForTask(port, lazy, options)).resolves.toMatchObject({ status: 'completed' });
    expect(sleeps).toEqual([MAX_TASK_POLL_INTERVAL_MS, MAX_TASK_POLL_INTERVAL_MS]);
  });

  it('backs off from the minimum, not from 0, during an outage', async () => {
    const { port, options, sleeps } = scripted([refused(), refused(), refused(), completed]);

    await expect(waitForTask(port, eager, options)).resolves.toMatchObject({ status: 'completed' });
    expect(sleeps).toEqual([
      MIN_TASK_POLL_INTERVAL_MS,
      MIN_TASK_POLL_INTERVAL_MS,
      MIN_TASK_POLL_INTERVAL_MS * 2,
      MIN_TASK_POLL_INTERVAL_MS * 4,
    ]);
  });
});

describe('waitForTask with an operation that never settles', () => {
  const needsInput = {
    ...created,
    status: 'input_required',
    inputRequests: {
      confirm: {
        method: 'elicitation/create',
        params: { mode: 'form', message: 'OK?', requestedSchema: { type: 'object', properties: {} } },
      },
    },
  } as MCPDetailedTask;
  const port = (get: TaskWaitPort['get']): TaskWaitPort => ({
    get,
    update: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    isRecoverable: () => false,
    recover: async () => {},
  });

  it('times out at maxWaitMs while a poll is still in flight, and ignores its late result', async () => {
    let release!: () => void;
    const slow = port(vi.fn(() => new Promise<MCPDetailedTask>(resolve => (release = () => resolve(completed)))));

    // Polls after 100 ms, then that poll hangs past the 300 ms deadline.
    const fresh = { ...created, createdAt: new Date().toISOString(), pollIntervalMs: 0 };
    await expect(waitForTask(slow, fresh, { maxWaitMs: 300 })).rejects.toMatchObject({ reason: 'timeout' });
    expect(slow.get).toHaveBeenCalledTimes(1);
    expect(slow.cancel).toHaveBeenCalledTimes(1);
    release();
  });

  it('times out at maxWaitMs while the input handler is still running, aborts its signal, and sends no update', async () => {
    let handlerSignal: AbortSignal | undefined;
    let release!: () => void;
    const blocked = port(async () => needsInput);
    const inputRequests = vi.fn(({ signal }: { signal: AbortSignal }) => {
      handlerSignal = signal;
      return new Promise<{ action: 'accept' }>(resolve => (release = () => resolve({ action: 'accept' })));
    });

    await expect(waitForTask(blocked, needsInput, { maxWaitMs: 50, inputRequests })).rejects.toMatchObject({
      reason: 'timeout',
    });
    expect(handlerSignal?.aborted).toBe(true);
    expect(blocked.cancel).toHaveBeenCalledTimes(1);
    release();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(blocked.update).not.toHaveBeenCalled();
  });

  it('rejects as soon as the caller aborts, even when the input handler ignores its signal', async () => {
    let release!: () => void;
    const blocked = port(async () => needsInput);
    const controller = new AbortController();
    const inputRequests = vi.fn(() => {
      setTimeout(() => controller.abort(new Error('stopped by caller')), 20);
      return new Promise<{ action: 'accept' }>(resolve => (release = () => resolve({ action: 'accept' })));
    });

    await expect(waitForTask(blocked, needsInput, { signal: controller.signal, inputRequests })).rejects.toThrow(
      'stopped by caller',
    );
    expect(blocked.cancel).toHaveBeenCalledTimes(1);
    release();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(blocked.update).not.toHaveBeenCalled();
  });
});

describe('waitForTask handing input requests back to the caller', () => {
  const ask = (message: string) => ({ method: 'elicitation/create', params: { message } });
  const needs = (requests: Record<string, ReturnType<typeof ask>>) =>
    ({ ...created, status: 'input_required', inputRequests: requests }) as MCPDetailedTask;

  it('returns the task needing input instead of failing, and leaves the task open', async () => {
    const { port, options } = scripted([needs({ approve: ask('Send it?') })]);

    const task = await waitForTask(port, created, { ...options, stopAtInput: true });

    expect(task).toMatchObject({ status: 'input_required', inputRequests: { approve: ask('Send it?') } });
    expect(port.cancel).not.toHaveBeenCalled();
    expect(port.update).not.toHaveBeenCalled();
  });

  it('lets a configured handler answer even when asked to stop at input', async () => {
    const { port, options } = scripted([needs({ approve: ask('Send it?') }), completed]);
    const inputRequests = vi.fn(async () => ({ action: 'accept' as const }));

    await expect(waitForTask(port, created, { ...options, stopAtInput: true, inputRequests })).resolves.toMatchObject({
      status: 'completed',
    });
    expect(inputRequests).toHaveBeenCalledTimes(1);
  });

  it('sends answers supplied up front once, then keeps polling the same task to its result', async () => {
    const waiting = needs({ approve: ask('Send it?') });
    // A stale poll can still list the answered key before the server applies the update.
    const { port, options } = scripted([waiting, completed]);

    const task = await waitForTask(port, waiting, {
      ...options,
      stopAtInput: true,
      inputResponses: { approve: { action: 'accept', content: { ok: true } } },
    });

    expect(task).toMatchObject({ status: 'completed' });
    expect(port.update).toHaveBeenCalledTimes(1);
    expect(port.update).toHaveBeenCalledWith(
      'task-1',
      { approve: { action: 'accept', content: { ok: true } } },
      expect.anything(),
    );
  });

  it('returns only the new requests when the server asks again after the supplied answers', async () => {
    const waiting = needs({ approve: ask('Send it?') });
    const { port, options } = scripted([needs({ approve: ask('Send it?'), confirm: ask('Sure?') })]);

    const task = await waitForTask(port, waiting, {
      ...options,
      stopAtInput: true,
      inputResponses: { approve: { action: 'accept' } },
    });

    expect(task).toMatchObject({ status: 'input_required', inputRequests: { confirm: ask('Sure?') } });
    expect(Object.keys((task as { inputRequests: object }).inputRequests)).toEqual(['confirm']);
  });
});
