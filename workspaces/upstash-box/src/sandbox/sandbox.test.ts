/**
 * UpstashBoxSandbox unit tests — the @upstash/box SDK is mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before any imports that use '@upstash/box'
// ---------------------------------------------------------------------------

const mockBox = {
  id: 'box-test-123',
  exec: { command: vi.fn() },
  getStatus: vi.fn().mockResolvedValue({ status: 'running' }),
  pause: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

const BoxCtor = {
  create: vi.fn().mockResolvedValue(mockBox),
  get: vi.fn().mockResolvedValue(mockBox),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
};

vi.mock('@upstash/box', () => {
  class BoxError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'BoxError';
      this.statusCode = statusCode;
    }
  }
  const Box = {
    create: (...args: unknown[]) => BoxCtor.create(...args),
    get: (...args: unknown[]) => BoxCtor.get(...args),
    delete: (...args: unknown[]) => BoxCtor.delete(...args),
    list: (...args: unknown[]) => BoxCtor.list(...args),
  };
  return { Box, BoxError };
});

// Import after mock registration
// eslint-disable-next-line import/order
import { BoxError } from '@upstash/box';
import { upstashBoxSandboxProvider } from '../provider';
import { UpstashBoxSandbox } from './index';

type UpstashBoxSandboxOptions = ConstructorParameters<typeof UpstashBoxSandbox>[0];

// ---------------------------------------------------------------------------
// exec.command simulator
//
// The process manager launches detached processes and then polls the box. The
// simulator interprets the three command shapes the manager issues — launch
// (base64 harness + `cat <dir>/pid`), poll (`kill -0 <pid>` → R:/C:/O:/E:), and
// kill (`kill -TERM <pid>`) — against a tiny in-memory process model.
// ---------------------------------------------------------------------------

interface ProcSpec {
  /** stdout the process emits (delivered on first poll). */
  out?: string;
  /** stderr the process emits (delivered on first poll). */
  err?: string;
  /** exit code string once finished. */
  code?: string;
  /** number of polls to report RUNNING before reporting DONE (Infinity = forever). */
  runningPolls?: number;
  /** number of DONE polls that report an empty code before the real one (simulates the write race). */
  codeDelayPolls?: number;
}

interface ProcState extends Required<ProcSpec> {
  pollIndex: number;
  delivered: boolean;
  codeDelay: number;
}

const procRegistry = new Map<string, ProcState>();
let nextSpec: ProcSpec | null = null;
let pidSeq = 1000;

/** Queue the behavior for the next spawn(). */
function queueProc(spec: ProcSpec): void {
  nextSpec = spec;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

/** Install the simulator as mockBox.exec.command. */
function installExecSim(): void {
  procRegistry.clear();
  nextSpec = null;
  pidSeq = 1000;

  mockBox.exec.command = vi.fn(async (cmd: string) => {
    // Launch: deliver a pid and register the process.
    if (cmd.includes('base64 -d') && cmd.includes("/pid'")) {
      const pid = String(++pidSeq);
      const spec = nextSpec ?? {};
      nextSpec = null;
      procRegistry.set(pid, {
        out: spec.out ?? '',
        err: spec.err ?? '',
        code: spec.code ?? '0',
        runningPolls: spec.runningPolls ?? 0,
        codeDelayPolls: spec.codeDelayPolls ?? 0,
        codeDelay: spec.codeDelayPolls ?? 0,
        pollIndex: 0,
        delivered: false,
      });
      return { result: `${pid}\n`, output: `${pid}\n`, exit_code: 0 };
    }

    // Kill: mark the process finished with a SIGTERM exit code.
    let m = cmd.match(/kill -TERM (\d+)/);
    if (m && !cmd.includes('kill -0')) {
      const p = procRegistry.get(m[1]!);
      if (p) {
        p.code = '143'; // SIGTERM
        p.runningPolls = 0;
      }
      return { result: '', output: '', exit_code: 0 };
    }

    // Poll: report running flag, exit code, and base64-framed new output.
    m = cmd.match(/kill -0 (\d+)/);
    if (m) {
      const p = procRegistry.get(m[1]!);
      if (!p) {
        return { result: 'R:0\nC:0\nO:\nE:\n', output: '', exit_code: 0 };
      }
      const running = p.pollIndex < p.runningPolls;
      p.pollIndex++;
      let o = '';
      let e = '';
      if (!p.delivered) {
        o = b64(p.out);
        e = b64(p.err);
        p.delivered = true;
      }
      let code = '';
      if (!running) {
        if (p.codeDelay > 0) {
          p.codeDelay--; // process gone, but the code file isn't visible yet
        } else {
          code = p.code;
        }
      }
      return { result: `R:${running ? 1 : 0}\nC:${code}\nO:${o}\nE:${e}\n`, output: '', exit_code: 0 };
    }

    return { result: '', output: '', exit_code: 0 };
  });
}

/** Decode the harness script embedded in a captured launch command. */
function decodeLaunchedScript(cmd: string): string {
  const m = cmd.match(/echo '([A-Za-z0-9+/=]+)' \| base64 -d/);
  return m ? Buffer.from(m[1]!, 'base64').toString('utf8') : '';
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  BoxCtor.create.mockResolvedValue(mockBox);
  BoxCtor.get.mockResolvedValue(mockBox);
  BoxCtor.delete.mockResolvedValue(undefined);
  BoxCtor.list.mockResolvedValue([]);
  mockBox.getStatus.mockResolvedValue({ status: 'running' });
  mockBox.pause.mockResolvedValue(undefined);
  mockBox.resume.mockResolvedValue(undefined);
  mockBox.delete.mockResolvedValue(undefined);
  installExecSim();
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('UpstashBoxSandbox lifecycle', () => {
  it('creates a new box when none exists', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', runtime: 'node' });
    await sandbox._start();

    expect(BoxCtor.get).not.toHaveBeenCalled();
    expect(BoxCtor.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-sb', runtime: 'node', size: 'small' }),
    );
    expect(sandbox.status).toBe('running');
    expect(sandbox.remoteId).toBe('box-test-123');
  });

  it('reconnects to a running box by boxId without resuming', async () => {
    mockBox.getStatus.mockResolvedValue({ status: 'running' });

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-existing' });
    await sandbox._start();

    expect(BoxCtor.get).toHaveBeenCalledWith('box-existing', expect.anything());
    expect(BoxCtor.create).not.toHaveBeenCalled();
    expect(mockBox.resume).not.toHaveBeenCalled();
    expect(sandbox.status).toBe('running');
  });

  it('resumes a paused box on reconnect, then waits until it is usable', async () => {
    // paused → (resume) → running
    mockBox.getStatus.mockResolvedValueOnce({ status: 'paused' }).mockResolvedValue({ status: 'running' });

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-existing' });
    await sandbox._start();

    expect(mockBox.resume).toHaveBeenCalledTimes(1);
    expect(sandbox.status).toBe('running');
  });

  it('waits out a "creating" box on reconnect before using it', async () => {
    // creating → creating → running
    mockBox.getStatus
      .mockResolvedValueOnce({ status: 'creating' })
      .mockResolvedValueOnce({ status: 'creating' })
      .mockResolvedValue({ status: 'running' });

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-existing' });
    await sandbox._start();

    expect(mockBox.resume).not.toHaveBeenCalled();
    expect(sandbox.status).toBe('running');
  }, 10_000);

  it('fails start() if a reconnected box never becomes usable before timeout', async () => {
    vi.useFakeTimers();
    try {
      mockBox.getStatus.mockResolvedValue({ status: 'creating' });
      const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-existing' });

      const startPromise = sandbox._start();
      const rejection = expect(startPromise).rejects.toThrow(/timed out waiting for box/i);
      await vi.advanceTimersByTimeAsync(130_000);

      await rejection;
      expect(BoxCtor.create).not.toHaveBeenCalled();
      expect(sandbox.status).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates resume failures for a paused box', async () => {
    mockBox.getStatus.mockResolvedValue({ status: 'paused' });
    mockBox.resume.mockRejectedValue(new BoxError('quota exceeded', 402));

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-existing' });
    await expect(sandbox._start()).rejects.toThrow('quota exceeded');
    expect(sandbox.status).toBe('error');
  });

  it('creates a fresh box when the existing one is in a "deleted"/"error" status', async () => {
    mockBox.getStatus.mockResolvedValue({ status: 'deleted' });

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-existing' });
    await sandbox._start();

    expect(BoxCtor.create).toHaveBeenCalled();
    expect(mockBox.resume).not.toHaveBeenCalled();
    expect(sandbox.status).toBe('running');
  });

  it('creates a fresh box when the stored boxId is gone (404)', async () => {
    BoxCtor.get.mockRejectedValue(new BoxError('not found', 404));

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-gone' });
    await sandbox._start();

    expect(BoxCtor.get).toHaveBeenCalled();
    expect(BoxCtor.create).toHaveBeenCalled();
    expect(sandbox.status).toBe('running');
  });

  it('propagates unexpected errors from get()', async () => {
    BoxCtor.get.mockRejectedValue(new BoxError('rate limited', 429));

    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', boxId: 'box-x' });
    await expect(sandbox._start()).rejects.toThrow('rate limited');
  });

  it('cleans up the orphaned box when create() fails and the id was auto-generated', async () => {
    BoxCtor.create.mockRejectedValue(new BoxError('creation timed out', 504));

    const sandbox = new UpstashBoxSandbox({}); // auto-generated (unique) id
    BoxCtor.list.mockResolvedValue([
      { id: 'orphan-1', name: sandbox.id },
      { id: 'unrelated', name: 'someone-else' },
    ]);

    await expect(sandbox._start()).rejects.toThrow('creation timed out');

    expect(BoxCtor.delete).toHaveBeenCalledWith(expect.objectContaining({ boxIds: ['orphan-1'] }));
  });

  it('does NOT auto-delete on create() failure when the id was user-supplied (may be shared)', async () => {
    BoxCtor.create.mockRejectedValue(new BoxError('creation timed out', 504));
    // A box with this (possibly shared) name exists — must not be deleted, since
    // it could belong to a concurrent instance using the same id.
    BoxCtor.list.mockResolvedValue([{ id: 'maybe-siblings', name: 'shared-id' }]);

    const sandbox = new UpstashBoxSandbox({ id: 'shared-id' });
    await expect(sandbox._start()).rejects.toThrow('creation timed out');

    expect(BoxCtor.delete).not.toHaveBeenCalled();
  });

  it('stop() pauses the box and keeps boxId for reconnect', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'test-sb' });
    await sandbox._start();
    await sandbox._stop();

    expect(mockBox.pause).toHaveBeenCalled();
    expect(sandbox.status).toBe('stopped');
    expect(sandbox.remoteId).toBe('box-test-123');
  });

  it('stop() does not pause keep-alive boxes', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', keepAlive: true });
    await sandbox._start();
    await sandbox._stop();

    expect(mockBox.pause).not.toHaveBeenCalled();
    expect(sandbox.status).toBe('stopped');
  });

  it('start() after stop() reconnects to the same box', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'resume-test' });
    await sandbox._start();
    expect(BoxCtor.create).toHaveBeenCalledTimes(1);

    await sandbox._stop();
    await sandbox._start();

    expect(BoxCtor.get).toHaveBeenCalledWith('box-test-123', expect.anything());
    expect(BoxCtor.create).toHaveBeenCalledTimes(1);
    expect(sandbox.status).toBe('running');
  });

  it('destroy() deletes the box', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'test-sb' });
    await sandbox._start();
    await sandbox._destroy();

    expect(mockBox.delete).toHaveBeenCalled();
    expect(sandbox.status).toBe('destroyed');
    expect(sandbox.remoteId).toBeUndefined();
  });

  it('destroy() on a pending sandbox transitions directly to destroyed', async () => {
    const sandbox = new UpstashBoxSandbox();
    expect(sandbox.status).toBe('pending');
    await sandbox._destroy();
    expect(sandbox.status).toBe('destroyed');
    expect(BoxCtor.create).not.toHaveBeenCalled();
  });

  it('start() is idempotent when already running', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'test-sb' });
    await sandbox._start();
    await sandbox._start();

    expect(BoxCtor.create).toHaveBeenCalledTimes(1);
  });

  it('passes env, size, networkPolicy, and skills to create()', async () => {
    const sandbox = new UpstashBoxSandbox({
      env: { NODE_ENV: 'test' },
      size: 'large',
      networkPolicy: { mode: 'deny-all' },
      skills: ['upstash/workflow-js'],
    });
    await sandbox._start();

    expect(BoxCtor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { NODE_ENV: 'test' },
        size: 'large',
        networkPolicy: { mode: 'deny-all' },
        skills: ['upstash/workflow-js'],
      }),
    );
  });

  it('omits env when empty', async () => {
    const sandbox = new UpstashBoxSandbox({});
    await sandbox._start();

    const params = BoxCtor.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.env).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getInfo / getInstructions
// ---------------------------------------------------------------------------

describe('UpstashBoxSandbox metadata', () => {
  it('getInfo() returns sandbox metadata', async () => {
    const sandbox = new UpstashBoxSandbox({ id: 'test-sb', runtime: 'python', size: 'medium' });
    await sandbox._start();

    const info = await sandbox.getInfo();
    expect(info.id).toBe('test-sb');
    expect(info.provider).toBe('upstash-box');
    expect(info.status).toBe('running');
    expect(info.metadata?.runtime).toBe('python');
    expect(info.metadata?.size).toBe('medium');
    expect(info.metadata?.boxId).toBe('box-test-123');
  });

  it('getInstructions() includes runtime and size', () => {
    const sandbox = new UpstashBoxSandbox({ runtime: 'python', size: 'large' });
    const instructions = sandbox.getInstructions();
    expect(instructions).toContain('python');
    expect(instructions).toContain('large');
  });

  it('getInstructions() respects string override', () => {
    const sandbox = new UpstashBoxSandbox({ instructions: 'custom instructions' });
    expect(sandbox.getInstructions()).toBe('custom instructions');
  });

  it('getInstructions() respects function override receiving default', () => {
    const sandbox = new UpstashBoxSandbox({
      instructions: ({ defaultInstructions }) => `${defaultInstructions} Extra.`,
    });
    expect(sandbox.getInstructions()).toContain('Extra.');
  });

  it('box getter throws when not started', () => {
    const sandbox = new UpstashBoxSandbox();
    expect(() => sandbox.box).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

describe('UpstashBoxProcessManager', () => {
  async function startedSandbox(opts?: UpstashBoxSandboxOptions) {
    const sandbox = new UpstashBoxSandbox(opts);
    await sandbox._start();
    return sandbox;
  }

  it('spawn() launches a detached process and returns a handle with a pid', async () => {
    queueProc({ out: 'hello\n', code: '0' });

    const sandbox = await startedSandbox({ id: 'proc-test' });
    const handle = await sandbox.processes.spawn('echo hello');

    expect(handle.pid).toMatch(/^box-proc-/);
    // First call is the launch command carrying the base64 harness.
    expect(mockBox.exec.command.mock.calls[0]![0]).toContain('base64 -d');
  });

  it('wait() returns accumulated stdout and exit code', async () => {
    queueProc({ out: 'hello\nworld\n', code: '0' });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('echo hello');
    const result = await handle.wait();

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello\nworld\n');
    expect(result.killed).toBeUndefined();
    expect(result.timedOut).toBeUndefined();
  });

  it('does not report success when the exit code is briefly unobservable after exit', async () => {
    // Process is gone but the harness hasn't written the code file yet on the
    // first DONE poll; the grace poll should still pick up the real non-zero code.
    queueProc({ code: '7', codeDelayPolls: 2 });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cmd');
    const result = await handle.wait();

    expect(result.exitCode).toBe(7);
    expect(result.success).toBe(false);
  });

  it('captures stderr separately from stdout', async () => {
    queueProc({ out: 'out\n', err: 'err\n', code: '0' });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cmd');
    const result = await handle.wait();

    expect(result.stdout).toBe('out\n');
    expect(result.stderr).toBe('err\n');
  });

  it('wait() returns failure for non-zero exit code', async () => {
    queueProc({ out: 'boom\n', code: '2' });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('false');
    const result = await handle.wait();

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
  });

  it('treats malformed exit code content as failure (never coerces to success)', async () => {
    queueProc({ code: 'not-a-number' });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cmd');
    const result = await handle.wait();

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('wait() is idempotent — returns the same result on repeated calls', async () => {
    queueProc({ out: 'out\n', code: '0' });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cmd');
    const r1 = await handle.wait();
    const r2 = await handle.wait();

    expect(r1).toEqual(r2);
  });

  it('exitCode is undefined while the process is still running', async () => {
    queueProc({ runningPolls: Infinity });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 60');

    expect(handle.exitCode).toBeUndefined();
  });

  it('spawn() bakes env exports into the harness script', async () => {
    queueProc({ code: '0' });

    const sandbox = await startedSandbox({ env: { BASE: 'base' } });
    await sandbox.processes.spawn('true', { env: { EXTRA: 'extra' } });

    const script = decodeLaunchedScript(mockBox.exec.command.mock.calls[0]![0] as string);
    expect(script).toContain('export BASE=base');
    expect(script).toContain('export EXTRA=extra');
  });

  it('spawn() bakes cwd into the harness script and fails the command if cd fails', async () => {
    queueProc({ code: '0' });

    const sandbox = await startedSandbox();
    await sandbox.processes.spawn('pwd', { cwd: '/app' });

    const script = decodeLaunchedScript(mockBox.exec.command.mock.calls[0]![0] as string);
    // cd runs inside the subshell with `|| exit 1` so a bad cwd is a hard failure.
    expect(script).toContain('cd /app || exit 1;');
  });

  it('spawn() rejects invalid env var names', async () => {
    const sandbox = await startedSandbox();
    await expect(sandbox.processes.spawn('true', { env: { 'BAD-NAME': 'x' } })).rejects.toThrow(
      /environment variable name/i,
    );
  });

  it('kill() signals the process and returns true; wait() reports the kill', async () => {
    queueProc({ runningPolls: Infinity });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 100');

    const killed = await handle.kill();
    expect(killed).toBe(true);

    const result = await handle.wait();
    expect(result.success).toBe(false);
    expect(result.killed).toBe(true);
    expect(result.timedOut).toBe(false);
    // SIGTERM exit code recorded by the harness.
    expect(result.exitCode).toBe(143);
  });

  it('wait() with a per-spawn timeout returns exitCode 124', async () => {
    queueProc({ runningPolls: Infinity });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 100', { timeout: 50 });
    const result = await handle.wait();

    expect(result.exitCode).toBe(124);
    expect(result.success).toBe(false);
    expect(result.killed).toBe(true);
    expect(result.timedOut).toBe(true);
  }, 5000);

  it('timeout: 0 triggers immediate timeout handling', async () => {
    queueProc({ runningPolls: Infinity });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 100', { timeout: 0 });
    const result = await handle.wait();

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
  }, 5000);

  it('sandbox-level timeout applies as the default command timeout', async () => {
    queueProc({ runningPolls: Infinity });

    // No per-spawn timeout — the sandbox `timeout` option should bound it.
    const sandbox = await startedSandbox({ timeout: 50 });
    const handle = await sandbox.processes.spawn('sleep 100');
    const result = await handle.wait();

    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
  }, 5000);

  it('sendStdin() throws not supported', async () => {
    queueProc({ runningPolls: Infinity });

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cat');
    await expect(handle.sendStdin('hi')).rejects.toThrow(/stdin/i);
  });

  it('list() returns tracked processes', async () => {
    queueProc({ runningPolls: Infinity });
    const sandbox = await startedSandbox();
    await sandbox.processes.spawn('cmd1');
    queueProc({ runningPolls: Infinity });
    await sandbox.processes.spawn('cmd2');

    const list = await sandbox.processes.list();
    expect(list.map(p => p.command)).toContain('cmd1');
    expect(list.map(p => p.command)).toContain('cmd2');
  });
});

// ---------------------------------------------------------------------------
// Dead-box retry
// ---------------------------------------------------------------------------

describe('UpstashBoxSandbox.retryOnDead()', () => {
  it('retries once on a 404 and succeeds against a fresh box', async () => {
    const sim = mockBox.exec.command;
    let launchCount = 0;
    mockBox.exec.command = vi.fn(async (cmd: string) => {
      if (cmd.includes('base64 -d') && launchCount++ === 0) {
        throw new BoxError('box not found', 404);
      }
      return sim(cmd);
    });
    queueProc({ out: 'ok\n', code: '0' });

    const sandbox = new UpstashBoxSandbox({ id: 'retry-test' });
    await sandbox._start();

    const handle = await sandbox.processes.spawn('echo ok');
    const result = await handle.wait();

    expect(result.stdout).toBe('ok\n');
    // A fresh box is created after the dead one is dropped.
    expect(BoxCtor.create).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-dead errors', async () => {
    let calls = 0;
    mockBox.exec.command = vi.fn(async () => {
      calls++;
      throw new BoxError('permission denied', 403);
    });

    const sandbox = new UpstashBoxSandbox({ id: 'non-dead' });
    await sandbox._start();

    await expect(sandbox.processes.spawn('cmd')).rejects.toThrow('permission denied');
    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Editor provider descriptor
// ---------------------------------------------------------------------------

describe('upstashBoxSandboxProvider', () => {
  it('exposes the expected descriptor', () => {
    expect(upstashBoxSandboxProvider.id).toBe('upstash-box');
    expect(upstashBoxSandboxProvider.name).toBeTruthy();
    expect(upstashBoxSandboxProvider.configSchema).toBeTypeOf('object');
  });

  it('createSandbox() returns an UpstashBoxSandbox with the given config', () => {
    const sandbox = upstashBoxSandboxProvider.createSandbox({ boxId: 'box-from-editor', runtime: 'python' });
    expect(sandbox).toBeInstanceOf(UpstashBoxSandbox);
    expect((sandbox as UpstashBoxSandbox).provider).toBe('upstash-box');
    expect((sandbox as UpstashBoxSandbox).remoteId).toBe('box-from-editor');
  });
});
