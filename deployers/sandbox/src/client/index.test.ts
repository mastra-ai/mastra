import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSandbox } from '../fake-sandbox.mock';
import { SERVER_SCRIPT } from '../shared';
import { getDeployment } from './index';

describe('getDeployment', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Run a getDeployment call to completion under fake timers. */
  async function run<T>(promise: Promise<T>): Promise<T> {
    // Prevent unhandled rejections while timers advance.
    const guarded = promise.catch(err => ({ __err: err }));
    await vi.advanceTimersByTimeAsync(120_000);
    const result = await guarded;
    if (result && typeof result === 'object' && '__err' in (result as object)) {
      throw (result as { __err: unknown }).__err;
    }
    return result as T;
  }

  describe('wake: false (default)', () => {
    it('resolves a running deployment without starting the sandbox', async () => {
      const sandbox = new FakeSandbox();

      const dep = await run(getDeployment({ sandbox }));

      expect(dep.url).toBe('https://fake-sandbox.example');
      expect(dep.status).toBe('running');
      expect(sandbox.started).toBe(0);
    });

    it('reports stopped when no URL can be resolved', async () => {
      const sandbox = new FakeSandbox({ url: null });

      const dep = await run(getDeployment({ sandbox }));

      expect(dep.url).toBeNull();
      expect(dep.status).toBe('stopped');
      expect(sandbox.started).toBe(0);
    });

    it('reports stopped when the URL resolves but the server does not answer', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const sandbox = new FakeSandbox();

      const dep = await run(getDeployment({ sandbox }));

      expect(dep.url).toBe('https://fake-sandbox.example');
      expect(dep.status).toBe('stopped');
    });

    it('reports stopped for sandboxes without networking', async () => {
      const sandbox = new FakeSandbox({ withNetworking: false });

      const dep = await run(getDeployment({ sandbox }));

      expect(dep.url).toBeNull();
      expect(dep.status).toBe('stopped');
    });
  });

  describe('wake: true', () => {
    it('starts the sandbox and returns once healthy without relaunching', async () => {
      const sandbox = new FakeSandbox({ info: { timeoutAt: new Date('2026-07-16T18:00:00Z') } });

      const dep = await run(getDeployment({ sandbox, wake: true }));

      expect(sandbox.started).toBe(1);
      expect(dep.status).toBe('running');
      expect(dep.expiresAt).toEqual(new Date('2026-07-16T18:00:00Z'));
      // Server answered on the first probe — no relaunch.
      expect(sandbox.spawned).toHaveLength(0);
    });

    it('relaunches the server when the resumed sandbox is not answering', async () => {
      // Unreachable until the relaunch happens, then healthy.
      fetchMock.mockImplementation(async () =>
        sandbox.commands.some(c => c.includes('nohup'))
          ? new Response('ok', { status: 200 })
          : Promise.reject(new Error('ECONNREFUSED')),
      );
      const sandbox = new FakeSandbox();

      const dep = await run(getDeployment({ sandbox, wake: true }));

      expect(sandbox.started).toBe(1);
      // Previous server killed via pidfile, then relaunched detached from the recorded script.
      expect(sandbox.commands.some(c => c.includes('.mastra-server.pid') && c.includes('kill'))).toBe(true);
      const launch = sandbox.commands.filter(c => c.includes('nohup sh') && c.includes(SERVER_SCRIPT));
      expect(launch).toHaveLength(1);
      expect(dep.status).toBe('running');
    });

    it('surfaces the server log when the relaunched server never becomes healthy', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const sandbox = new FakeSandbox({ serverLog: 'Error: bad import' });

      await expect(run(getDeployment({ sandbox, wake: true, healthCheckTimeoutMs: 5_000 }))).rejects.toThrow(
        /bad import/,
      );
    });

    it('throws when the provider does not support networking', async () => {
      const sandbox = new FakeSandbox({ withNetworking: false });

      await expect(run(getDeployment({ sandbox, wake: true }))).rejects.toThrow(/does not support networking/);
    });
  });

  it('exposes stop/destroy/logs on the handle', async () => {
    const sandbox = new FakeSandbox({ serverLog: 'server output' });

    const dep = await run(getDeployment({ sandbox }));
    await dep.stop();
    await dep.destroy();

    expect(sandbox.stopped).toBe(1);
    expect(sandbox.destroyed).toBe(1);
    await expect(dep.logs()).resolves.toBe('server output');
  });
});

describe('browser guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getDeployment throws when imported in a browser context', async () => {
    vi.stubGlobal('window', {});

    await expect(getDeployment({ sandbox: new FakeSandbox() })).rejects.toThrow(/server-only/);
  });

  it('createSandboxHandler throws when created in a browser context', async () => {
    vi.stubGlobal('window', {});
    const { createSandboxHandler } = await import('./index');

    expect(() => createSandboxHandler({ resolve: async () => 'https://x' })).toThrow(/server-only/);
  });
});
