import { describe, it, expect, vi } from 'vitest';
import { VercelSandboxProcessManager } from './process-manager';
import type { VercelSandbox } from './index';

/**
 * Build a fake detached @vercel/sandbox Command that emits the given logs and
 * resolves wait() with the given exit code.
 */
function makeFakeCommand(opts: {
  cmdId: string;
  logs?: Array<{ stream: 'stdout' | 'stderr'; data: string }>;
  exitCode?: number;
  waitDelayMs?: number;
}) {
  const logEntries = opts.logs ?? [];
  const kill = vi.fn().mockResolvedValue(undefined);
  let resolveWait: (v: { exitCode: number }) => void;
  const waitPromise = new Promise<{ exitCode: number }>(resolve => {
    resolveWait = resolve;
  });

  const command = {
    cmdId: opts.cmdId,
    kill,
    async *logs() {
      for (const entry of logEntries) {
        yield entry;
      }
    },
    wait: vi.fn().mockReturnValue(waitPromise),
  };

  // Resolve wait after the configured delay (default: immediately).
  setTimeout(() => resolveWait({ exitCode: opts.exitCode ?? 0 }), opts.waitDelayMs ?? 0);

  return { command, kill };
}

/** Build a fake VercelSandbox exposing a sandbox with runCommand. */
function makeSandboxStub(runCommand: ReturnType<typeof vi.fn>) {
  return {
    ensureRunning: vi.fn().mockResolvedValue(undefined),
    sandbox: { runCommand },
  } as unknown as VercelSandbox;
}

describe('VercelSandboxProcessManager', () => {
  it('spawns a detached command via sh -c and streams output', async () => {
    const { command } = makeFakeCommand({
      cmdId: 'cmd-1',
      logs: [
        { stream: 'stdout', data: 'hello' },
        { stream: 'stderr', data: 'warn' },
      ],
      exitCode: 0,
    });
    const runCommand = vi.fn().mockResolvedValue(command);

    const pm = new VercelSandboxProcessManager({ env: {} });
    pm.sandbox = makeSandboxStub(runCommand);

    const handle = await pm.spawn('echo hello');

    expect(runCommand).toHaveBeenCalledTimes(1);
    const params = runCommand.mock.calls[0]![0];
    expect(params.cmd).toBe('sh');
    expect(params.args).toEqual(['-c', 'echo hello']);
    expect(params.detached).toBe(true);

    const result = await handle.wait();
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(handle.stdout).toBe('hello');
    expect(handle.stderr).toBe('warn');
    expect(handle.pid).toBe('cmd-1');
  });

  it('reports a non-zero exit code', async () => {
    const { command } = makeFakeCommand({ cmdId: 'cmd-2', exitCode: 3 });
    const runCommand = vi.fn().mockResolvedValue(command);

    const pm = new VercelSandboxProcessManager();
    pm.sandbox = makeSandboxStub(runCommand);

    const handle = await pm.spawn('false');
    const result = await handle.wait();
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(3);
  });

  it('kills a running process', async () => {
    const { command, kill } = makeFakeCommand({ cmdId: 'cmd-3' });
    const runCommand = vi.fn().mockResolvedValue(command);

    const pm = new VercelSandboxProcessManager();
    pm.sandbox = makeSandboxStub(runCommand);

    const handle = await pm.spawn('sleep 100');
    const killed = await handle.kill();
    expect(killed).toBe(true);
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('merges env from manager defaults and spawn options', async () => {
    const { command } = makeFakeCommand({ cmdId: 'cmd-4', exitCode: 0 });
    const runCommand = vi.fn().mockResolvedValue(command);

    const pm = new VercelSandboxProcessManager({ env: { BASE: '1' } });
    pm.sandbox = makeSandboxStub(runCommand);

    await pm.spawn('node app.js', { cwd: '/app', env: { EXTRA: '2' } });
    const params = runCommand.mock.calls[0]![0];
    expect(params.cwd).toBe('/app');
    expect(params.env).toEqual({ BASE: '1', EXTRA: '2' });
  });

  it('lists tracked processes', async () => {
    const { command } = makeFakeCommand({ cmdId: 'cmd-5', exitCode: 0 });
    const runCommand = vi.fn().mockResolvedValue(command);

    const pm = new VercelSandboxProcessManager();
    pm.sandbox = makeSandboxStub(runCommand);

    const handle = await pm.spawn('echo hi');
    const list = await pm.list();
    expect(list.some(p => p.pid === handle.pid)).toBe(true);
  });

  it('throws when sending stdin', async () => {
    const { command } = makeFakeCommand({ cmdId: 'cmd-6', exitCode: 0 });
    const runCommand = vi.fn().mockResolvedValue(command);

    const pm = new VercelSandboxProcessManager();
    pm.sandbox = makeSandboxStub(runCommand);

    const handle = await pm.spawn('cat');
    await expect(handle.sendStdin('data')).rejects.toThrow('does not support sending stdin');
  });
});
