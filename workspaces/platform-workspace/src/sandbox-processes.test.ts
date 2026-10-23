import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

import { CommandsApiProcessManager } from '@internal/workspace';
import type { CommandsApi, CommandsApiHandle } from '@internal/workspace';
import { AuthenticationError, TimeoutError } from 'e2b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlatformSandbox, SandboxDestroyedError } from './sandbox.js';

type Listener = { onStdout?: (data: string) => void; onStderr?: (data: string) => void };
type Child = { child: ChildProcess; cmd: string; listeners: Listener[]; done: Promise<number> };

/** Shaped like the E2B SDK's CommandExitError. */
class CommandExitError extends Error {
  constructor(readonly exitCode: number) {
    super(`exit status ${exitCode}`);
  }
}

/**
 * One VM's processes, reached through a commands handle per lease. Each handle
 * answers the way envd did in the live probe: background runs stream output,
 * `list` reports running commands only, `connect` attaches to a running pid,
 * and a killed command's `wait` rejects with exit code -1.
 */
class HostVm {
  readonly children = new Map<number, Child>();
  readonly calls: string[] = [];
  readonly timeouts: Array<number | undefined> = [];
  private streams = new Map<string, Array<() => void>>();

  /**
   * End every stream opened with `jwt` the way envd did when the probe's lease
   * reached its TTL: `wait()` rejects with an `[unavailable]` TimeoutError and
   * the process keeps running.
   */
  expire(jwt: string) {
    for (const end of this.streams.get(jwt) ?? []) end();
    this.streams.delete(jwt);
  }

  commandsFor(jwt: string, fail: Partial<Record<keyof CommandsApi, () => Error | undefined>> = {}): CommandsApi {
    const record = (name: keyof CommandsApi) => {
      this.calls.push(`${jwt} ${name}`);
      const error = fail[name]?.();
      if (error) throw error;
    };
    return {
      run: async (command, opts) => {
        record('run');
        this.timeouts.push(opts.timeoutMs);
        return this.run(command, opts, jwt);
      },
      connect: async (pid, opts = {}) => {
        record('connect');
        const entry = this.children.get(pid);
        if (!entry || !this.running(entry)) throw new Error(`process ${pid} not found`);
        entry.listeners.push(opts);
        return this.handle(pid, entry.done, jwt, opts);
      },
      list: async () => {
        record('list');
        return [...this.children]
          .filter(([, entry]) => this.running(entry))
          .map(([pid, entry]) => ({ pid, cmd: '/bin/bash', args: ['-l', '-c', entry.cmd] }));
      },
      kill: async pid => {
        record('kill');
        const entry = this.children.get(pid);
        return entry && this.running(entry) ? entry.child.kill('SIGKILL') : false;
      },
      sendStdin: async (pid, data) => {
        record('sendStdin');
        this.children.get(pid)!.child.stdin!.write(data);
      },
    };
  }

  run(command: string, opts: Listener & { stdin?: boolean; cwd?: string; envs?: Record<string, string> }, jwt = '') {
    const child = spawn('sh', ['-c', command], {
      env: { ...process.env, ...opts.envs },
      stdio: [opts.stdin === false ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    const listeners: Listener[] = [opts];
    child.stdout!.on('data', (chunk: Buffer) => listeners.forEach(l => l.onStdout?.(chunk.toString())));
    child.stderr!.on('data', (chunk: Buffer) => listeners.forEach(l => l.onStderr?.(chunk.toString())));
    const done = new Promise<number>(resolve =>
      child.on('close', (code, signal) => resolve(signal ? -1 : (code ?? 1))),
    );
    this.children.set(child.pid!, { child, cmd: command, listeners, done });
    return this.handle(child.pid!, done, jwt, opts);
  }

  private running(entry: Child) {
    return entry.child.exitCode === null && entry.child.signalCode === null;
  }

  private handle(pid: number, done: Promise<number>, jwt: string, listener: Listener): CommandsApiHandle {
    let exitCode: number | undefined;
    let streaming = true;
    // A handle learns the exit code from its stream, so not after the stream ended.
    void done.then(code => streaming && (exitCode = code));
    const ended = new Promise<never>((_, reject) => {
      const ends = this.streams.get(jwt) ?? [];
      ends.push(() => {
        streaming = false;
        const listeners = this.children.get(pid)?.listeners;
        if (listeners) listeners.splice(listeners.indexOf(listener), 1);
        reject(new TimeoutError('[unavailable] the connection to sandbox ended before the stream completed'));
      });
      this.streams.set(jwt, ends);
    });
    ended.catch(() => {});
    return {
      pid,
      get exitCode() {
        return exitCode;
      },
      async wait() {
        const code = await Promise.race([done, ended]);
        if (code !== 0) throw new CommandExitError(code);
        return { exitCode: code };
      },
    };
  }

  stopAll() {
    for (const { child } of this.children.values()) child.kill('SIGKILL');
  }
}

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

function e2bLease(jwt = 'envd-token-1', provider = 'e2b') {
  return json({
    provider,
    sandboxId: 'sbx_1',
    providerResourceId: 'e2b_sbx_1',
    jwt,
    wsEndpoint: 'https://49983-e2b-sbx-1.e2b.app',
    subprotocol: 'e2b-access-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });
}

const created = () => json({ id: 'sbx_1', createdAt: '2026-06-26T00:00:00.000Z' });
const isLeaseCall = (call: unknown[]) => String(call[0]).endsWith('/exec-lease');

const until = async (check: () => boolean) => {
  for (let i = 0; i < 300 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  expect(check()).toBe(true);
};

describe('PlatformSandbox.processes', () => {
  let vm: HostVm;

  beforeEach(() => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    vm = new HostVm();
  });

  afterEach(() => {
    vm.stopAll();
    vi.unstubAllEnvs();
  });

  function makeSandbox(
    fetchMock: ReturnType<typeof vi.fn>,
    commandsFor: (jwt: string) => CommandsApi = jwt => vm.commandsFor(jwt),
    options: { timeout?: number } = {},
  ) {
    const leases: string[] = [];
    const sandbox = new PlatformSandbox({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      environmentId: 'env_123',
      ...options,
      fetch: fetchMock as unknown as typeof fetch,
      e2bExecRunner: () => {
        throw new Error('process operations must not exec');
      },
      e2bCommandsFactory: lease => {
        leases.push(lease.jwt);
        return commandsFor(lease.jwt);
      },
    });
    return { sandbox, leases };
  }

  const rotateLease = (sandbox: PlatformSandbox) => {
    (sandbox as unknown as { _lease: unknown })._lease = null;
  };

  it('streams output while a process runs, stops it, and lists what is running', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease());
    const { sandbox, leases } = makeSandbox(fetchMock);

    const handle = await sandbox.processes!.spawn('while true; do echo tick; echo tock >&2; sleep 0.05; done');
    await until(() => handle.stdout.includes('tick\n') && handle.stderr.includes('tock\n'));
    expect(handle.exitCode).toBeUndefined();
    // envd reports it as `/bin/bash -l -c <command>`; the list shows the command.
    expect(await sandbox.processes!.list()).toEqual([
      {
        pid: handle.pid,
        command: 'while true; do echo tick; echo tock >&2; sleep 0.05; done',
        running: true,
      },
    ]);

    expect(await sandbox.processes!.kill(handle.pid)).toBe(true);
    const finished = await sandbox.processes!.spawn('echo done');
    await finished.wait();
    expect(await sandbox.processes!.list()).toEqual([
      { pid: finished.pid, command: 'echo done', running: false, exitCode: 0 },
    ]);

    expect(fetchMock.mock.calls.filter(isLeaseCall)).toHaveLength(1);
    expect(leases).toEqual(['envd-token-1']);
  });

  it('attaches to a process it did not start', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(created()).mockResolvedValueOnce(e2bLease());
    const { sandbox } = makeSandbox(fetchMock);
    await sandbox._start();
    const other = vm.run('sleep 0.2; echo later; sleep 30', {});

    const attached = await sandbox.processes!.get(String(other.pid));
    expect(attached?.pid).toBe(String(other.pid));
    await until(() => attached?.stdout === 'later\n');
    expect(vm.calls).toContain('envd-token-1 connect');
  });

  it('stops a process with the current lease, not the one it was started with', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('first'))
      .mockResolvedValueOnce(e2bLease('second'));
    const { sandbox, leases } = makeSandbox(fetchMock);

    const handle = await sandbox.processes!.spawn('sleep 30');
    rotateLease(sandbox);
    expect(await handle.kill()).toBe(true);

    expect(leases).toEqual(['first', 'second']);
    expect(vm.calls).toEqual(['first run', 'second kill']);
  });

  it("lifts the SDK's stream deadline unless a timeout is set", async () => {
    const { sandbox } = makeSandbox(vi.fn().mockResolvedValueOnce(created()).mockResolvedValue(e2bLease()));
    await (await sandbox.processes!.spawn('true')).wait();
    await (await sandbox.processes!.spawn('true', { timeout: 1_000 })).wait();

    const { sandbox: bounded } = makeSandbox(
      vi.fn().mockResolvedValueOnce(created()).mockResolvedValue(e2bLease()),
      undefined,
      { timeout: 5_000 },
    );
    await (await bounded.processes.spawn('true')).wait();

    expect(vm.timeouts).toEqual([0, 1_000, 5_000]);
  });

  it('keeps streaming after the lease the process started with expires', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('first'))
      .mockResolvedValueOnce(e2bLease('second'));
    const { sandbox } = makeSandbox(fetchMock);

    const handle = await sandbox.processes!.spawn('echo before; read _; echo after');
    const waiting = handle.wait();
    await until(() => handle.stdout === 'before\n');

    rotateLease(sandbox);
    vm.expire('first');
    await until(() => vm.calls.includes('second connect'));
    await handle.sendStdin('go\n');

    expect(await waiting).toMatchObject({ success: true, stdout: 'before\nafter\n' });
    expect(vm.calls).toEqual(['first run', 'second list', 'second connect', 'second sendStdin']);
  });

  it('reports a failed wait when the process ended before it could be reattached', async () => {
    let releaseLease!: () => void;
    const secondLease = new Promise<Response>(resolve => (releaseLease = () => resolve(e2bLease('second'))));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('first'))
      .mockReturnValueOnce(secondLease);
    const { sandbox } = makeSandbox(fetchMock);

    const handle = await sandbox.processes!.spawn('echo before; exec sleep 30');
    const waiting = handle.wait();
    await until(() => handle.stdout === 'before\n');

    rotateLease(sandbox);
    vm.expire('first');
    // It ends while nobody is attached, before the new lease arrives.
    const child = vm.children.get(Number(handle.pid))!;
    child.child.kill('SIGKILL');
    await child.done;
    releaseLease();

    const result = await waiting;
    expect(result).toMatchObject({ success: false, exitCode: 1 });
    expect(result.stderr).toContain('[unavailable]');
    expect(vm.calls).toEqual(['first run', 'second list']);

    // It reads as exited, so it stays listed until read and is then released.
    expect(handle.exitCode).toBe(1);
    expect(await sandbox.processes!.list()).toEqual([
      { pid: handle.pid, command: 'echo before; exec sleep 30', running: false, exitCode: 1 },
    ]);
    expect(await sandbox.processes!.get(handle.pid)).toBe(handle);
    expect(await sandbox.processes!.list()).toEqual([]);
  });

  it('tries the reattach again on the next wait when the VM could not be reached', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('first'))
      .mockImplementation(async () => e2bLease('second'));
    let unreachable = true;
    const { sandbox } = makeSandbox(fetchMock, jwt =>
      vm.commandsFor(jwt, {
        list: () => (jwt === 'second' && unreachable ? new Error('connection refused') : undefined),
      }),
    );

    const handle = await sandbox.processes!.spawn('echo before; read _; echo after');
    const first = handle.wait();
    await until(() => handle.stdout === 'before\n');

    rotateLease(sandbox);
    vm.expire('first');
    expect(await first).toMatchObject({ success: false });
    expect(handle.exitCode).toBeUndefined();

    unreachable = false;
    const second = handle.wait();
    await until(() => vm.calls.includes('second connect'));
    await handle.sendStdin('go\n');
    expect(await second).toMatchObject({ success: true, stdout: 'before\nafter\n' });
  });

  it('turns a 410 lease into SandboxDestroyedError and clears state', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(json({ error: { message: 'Gone', type: 'gone' } }, { status: 410 }));
    const { sandbox } = makeSandbox(fetchMock);
    await sandbox._start();

    const error = await sandbox.processes!.spawn('sleep 1').catch(e => e);
    expect(error).toBeInstanceOf(SandboxDestroyedError);
    expect(error).toMatchObject({ sandboxId: 'sbx_1', command: 'processes.spawn', attempts: 1 });
    expect((sandbox as unknown as { _sandboxId: unknown })._sandboxId).toBeUndefined();
    expect((sandbox as unknown as { _lease: unknown })._lease).toBeNull();
    expect(sandbox.status).toBe('stopped');
    expect(vm.calls).toEqual([]);
  });

  it('retries a spawn exactly once after envd rejects the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('stale'))
      .mockResolvedValueOnce(e2bLease('fresh'));
    const { sandbox, leases } = makeSandbox(fetchMock, jwt =>
      vm.commandsFor(jwt, jwt === 'stale' ? { run: () => new AuthenticationError('HTTP 401') } : {}),
    );

    const handle = await sandbox.processes!.spawn('echo ok');
    expect((await handle.wait()).stdout).toBe('ok\n');
    expect(leases).toEqual(['stale', 'fresh']);
    expect(vm.calls).toEqual(['stale run', 'fresh run']);
  });

  it('gives up after a second token rejection', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockResolvedValueOnce(e2bLease('a'))
      .mockResolvedValueOnce(e2bLease('b'));
    const { sandbox } = makeSandbox(fetchMock, jwt =>
      vm.commandsFor(jwt, { run: () => new AuthenticationError('HTTP 401') }),
    );

    await expect(sandbox.processes!.spawn('echo ok')).rejects.toBeInstanceOf(AuthenticationError);
    expect(vm.calls).toEqual(['a run', 'b run']);
  });

  it('never replays a spawn or a kill after a connection error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(created())
      .mockImplementation(async () => e2bLease());
    let failKill = false;
    const { sandbox } = makeSandbox(fetchMock, jwt =>
      vm.commandsFor(jwt, {
        run: () => new Error('socket hang up'),
        kill: () => (failKill ? new Error('socket hang up') : undefined),
      }),
    );

    await expect(sandbox.processes!.spawn('echo ok')).rejects.toThrow('socket hang up');
    expect(vm.calls.filter(call => call.endsWith(' run'))).toHaveLength(1);

    const other = vm.run('sleep 30', {});
    const attached = await sandbox.processes!.get(String(other.pid));
    failKill = true;
    await expect(attached!.kill()).rejects.toThrow('socket hang up');
    expect(vm.calls.filter(call => call.endsWith(' kill'))).toHaveLength(1);
  });

  it('keeps the exec-backed manager on a Railway sandbox', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
    const { sandbox } = makeSandbox(vi.fn().mockResolvedValue(created()));
    const exec = vi
      .spyOn(sandbox, 'executeCommand')
      .mockResolvedValue({ success: true, exitCode: 0, stdout: 'ok\n', stderr: '', executionTimeMs: 1 });

    expect(sandbox.processes).not.toBeInstanceOf(CommandsApiProcessManager);
    const handle = await sandbox.processes!.spawn('echo ok');
    expect((await handle.wait()).stdout).toBe('ok\n');
    expect(exec).toHaveBeenCalledWith('echo ok', undefined, expect.any(Object));
  });
});
