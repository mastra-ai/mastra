import { describe, expect, it, vi } from 'vitest';
import type { MCPDetailedTask, MCPTask } from '../../shared/tasks';
import { isRecoverableTaskPollError } from '../error-utils';
import { TaskWaitError, waitForTask } from './wait';
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

describe('waitForTask during a server outage', () => {
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
