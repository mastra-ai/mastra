/**
 * ModalSandbox unit tests — Modal SDK is mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before any imports that use 'modal'
// ---------------------------------------------------------------------------

const mockSandbox = {
  sandboxId: 'sb-test-123',
  exec: vi.fn(),
  terminate: vi.fn().mockResolvedValue(undefined),
  snapshotFilesystem: vi.fn().mockResolvedValue({ imageId: 'snap-123' }),
};

const mockSandboxes = {
  fromName: vi.fn(),
  create: vi.fn().mockResolvedValue(mockSandbox),
};

const mockApps = {
  fromName: vi.fn().mockResolvedValue({ appId: 'app-123', name: 'mastra' }),
};

const mockImages = {
  fromRegistry: vi.fn().mockReturnValue({ imageId: 'img-ubuntu' }),
};

vi.mock('modal', async () => {
  class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
  class ClientClosedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ClientClosedError';
    }
  }
  class ModalClient {
    sandboxes = mockSandboxes;
    apps = mockApps;
    images = mockImages;
  }
  return { NotFoundError, ClientClosedError, ModalClient };
});

// Import after mock registration
// eslint-disable-next-line import/order
import { ClientClosedError, NotFoundError } from 'modal';
import { ModalSandbox } from './index';

// ---------------------------------------------------------------------------
// Stream helpers
// ---------------------------------------------------------------------------

/** Creates a mock ReadableStream reader that emits chunks then closes. */
function makeReader(chunks: string[]): ReadableStreamDefaultReader<string> {
  let i = 0;
  return {
    read: vi.fn(async () => {
      if (i < chunks.length) return { done: false, value: chunks[i++] } as const;
      return { done: true, value: undefined } as const;
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  } as unknown as ReadableStreamDefaultReader<string>;
}

/** Creates a mock ContainerProcess with resolved streams and exit code. */
function makeProcess(exitCode: number, stdoutChunks: string[] = [], stderrChunks: string[] = []) {
  return {
    stdout: { getReader: () => makeReader(stdoutChunks) },
    stderr: { getReader: () => makeReader(stderrChunks) },
    wait: vi.fn().mockResolvedValue(exitCode),
  };
}

/** Creates a mock ContainerProcess whose stdout never finishes, until cancel() is called. */
function makeHangingProcess(): {
  proc: ReturnType<typeof _makeMockSb>;
  cancelStdout: () => void;
} {
  let resolveCancelFn: (() => void) | null = null;

  const stdoutReader = {
    read: vi.fn(
      () =>
        new Promise<{ done: true; value: undefined }>(resolve => {
          resolveCancelFn = () => resolve({ done: true, value: undefined });
        }),
    ),
    cancel: vi.fn(() => {
      resolveCancelFn?.();
      return Promise.resolve();
    }),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  } as unknown as ReadableStreamDefaultReader<string>;

  const proc = {
    stdout: { getReader: () => stdoutReader },
    stderr: { getReader: () => makeReader([]) },
    wait: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
  };

  return { proc, cancelStdout: () => resolveCancelFn?.() };
}

// Silence TS for test helper
function _makeMockSb() {
  return {} as ReturnType<typeof makeProcess>;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSandboxes.fromName.mockRejectedValue(new NotFoundError('sandbox not found'));
  mockSandboxes.create.mockResolvedValue(mockSandbox);
  mockApps.fromName.mockResolvedValue({ appId: 'app-123', name: 'mastra' });
  mockImages.fromRegistry.mockReturnValue({ imageId: 'img-ubuntu' });
  mockSandbox.terminate.mockResolvedValue(undefined);
  mockSandbox.snapshotFilesystem.mockResolvedValue({ imageId: 'snap-123' });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('ModalSandbox lifecycle', () => {
  it('creates a new sandbox when none exists', async () => {
    const sandbox = new ModalSandbox({ id: 'test-sb', appName: 'mastra' });
    await sandbox._start();

    expect(mockSandboxes.fromName).toHaveBeenCalledWith('mastra', 'test-sb');
    expect(mockApps.fromName).toHaveBeenCalledWith('mastra', { createIfMissing: true });
    expect(mockImages.fromRegistry).toHaveBeenCalledWith('ubuntu:22.04');
    expect(mockSandboxes.create).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'app-123' }),
      expect.anything(),
      expect.objectContaining({ name: 'test-sb' }),
    );
    expect(sandbox.status).toBe('running');
  });

  it('reconnects to an existing sandbox by name', async () => {
    mockSandboxes.fromName.mockResolvedValue(mockSandbox);

    const sandbox = new ModalSandbox({ id: 'test-sb', appName: 'mastra' });
    await sandbox._start();

    expect(mockSandboxes.fromName).toHaveBeenCalledWith('mastra', 'test-sb');
    expect(mockSandboxes.create).not.toHaveBeenCalled();
    expect(sandbox.status).toBe('running');
  });

  it('propagates unexpected errors from fromName()', async () => {
    mockSandboxes.fromName.mockRejectedValue(new Error('Network failure'));

    const sandbox = new ModalSandbox({ id: 'test-sb' });
    await expect(sandbox._start()).rejects.toThrow('Network failure');
  });

  it('stop() snapshots and terminates the sandbox', async () => {
    mockSandboxes.fromName.mockResolvedValue(mockSandbox);
    const sandbox = new ModalSandbox({ id: 'test-sb' });
    await sandbox._start();
    await sandbox._stop();

    expect(mockSandbox.snapshotFilesystem).toHaveBeenCalled();
    expect(mockSandbox.terminate).toHaveBeenCalledWith({ wait: true });
    expect(sandbox.status).toBe('stopped');
  });

  it('destroy() terminates the sandbox', async () => {
    mockSandboxes.fromName.mockResolvedValue(mockSandbox);
    const sandbox = new ModalSandbox({ id: 'test-sb' });
    await sandbox._start();
    await sandbox._destroy();

    expect(mockSandbox.terminate).toHaveBeenCalled();
    expect(sandbox.status).toBe('destroyed');
  });

  it('destroy() on a pending sandbox transitions directly to destroyed', async () => {
    const sandbox = new ModalSandbox();
    expect(sandbox.status).toBe('pending');
    await sandbox._destroy();
    expect(sandbox.status).toBe('destroyed');
    expect(mockSandboxes.create).not.toHaveBeenCalled();
  });

  it('start() is idempotent when already running', async () => {
    mockSandboxes.fromName.mockResolvedValue(mockSandbox);
    const sandbox = new ModalSandbox({ id: 'test-sb' });
    await sandbox._start();
    await sandbox._start();

    expect(mockSandboxes.fromName).toHaveBeenCalledTimes(1);
  });

  it('passes env to sandboxes.create()', async () => {
    const sandbox = new ModalSandbox({ env: { NODE_ENV: 'test', DEBUG: '1' } });
    await sandbox._start();

    expect(mockSandboxes.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ env: { NODE_ENV: 'test', DEBUG: '1' } }),
    );
  });

  it('omits env param when empty', async () => {
    const sandbox = new ModalSandbox({});
    await sandbox._start();

    const [, , params] = mockSandboxes.create.mock.calls[0]!;
    expect(params.env).toBeUndefined();
  });

  it('passes timeoutMs to sandboxes.create()', async () => {
    const sandbox = new ModalSandbox({ timeoutMs: 120_000 });
    await sandbox._start();

    expect(mockSandboxes.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );
  });
});

// ---------------------------------------------------------------------------
// Stop-and-resume
// ---------------------------------------------------------------------------

describe('ModalSandbox stop-and-resume', () => {
  it('stop() snapshots then terminates, allowing same instance to resume from snapshot', async () => {
    const first = new ModalSandbox({ id: 'resume-test', appName: 'mastra' });
    await first._start();
    await first._stop();

    expect(mockSandbox.snapshotFilesystem).toHaveBeenCalled();
    expect(mockSandbox.terminate).toHaveBeenCalledWith({ wait: true });

    // Restart the same instance — should create from snapshot
    mockSandboxes.create.mockResolvedValue(mockSandbox);
    await first._start();

    // fromName fails (sandbox was terminated), so create is called with the snapshot
    expect(mockSandboxes.create).toHaveBeenCalledTimes(2);
    expect(first.status).toBe('running');
  });

  it('creates a fresh sandbox when a new instance starts with the same id', async () => {
    const first = new ModalSandbox({ id: 'expired-test', appName: 'mastra' });
    await first._start();
    await first._stop();

    // New instance doesn't have the snapshot, so it creates from base image
    mockSandboxes.fromName.mockRejectedValue(new NotFoundError('sandbox not found'));

    const second = new ModalSandbox({ id: 'expired-test', appName: 'mastra' });
    await second._start();

    expect(mockSandboxes.create).toHaveBeenCalledTimes(2);
    expect(second.status).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// getInfo / getInstructions
// ---------------------------------------------------------------------------

describe('ModalSandbox metadata', () => {
  it('getInfo() returns sandbox metadata', async () => {
    mockSandboxes.fromName.mockResolvedValue(mockSandbox);
    const sandbox = new ModalSandbox({ id: 'test-sb', baseImage: 'python:3.12-slim', appName: 'my-app' });
    await sandbox._start();

    const info = await sandbox.getInfo();
    expect(info.id).toBe('test-sb');
    expect(info.provider).toBe('modal');
    expect(info.status).toBe('running');
    expect(info.metadata?.image).toBe('python:3.12-slim');
    expect(info.metadata?.appName).toBe('my-app');
  });

  it('getInstructions() returns default instructions containing image name', () => {
    const sandbox = new ModalSandbox({ baseImage: 'python:3.12' });
    expect(sandbox.getInstructions()).toContain('python:3.12');
  });

  it('getInstructions() respects string override', () => {
    const sandbox = new ModalSandbox({ instructions: 'custom instructions' });
    expect(sandbox.getInstructions()).toBe('custom instructions');
  });

  it('getInstructions() respects function override receiving default', () => {
    const sandbox = new ModalSandbox({
      instructions: ({ defaultInstructions }) => `${defaultInstructions} Extra info.`,
    });
    expect(sandbox.getInstructions()).toContain('Extra info.');
  });

  it('getInstructions() function override receives default instructions', () => {
    const sandbox = new ModalSandbox({
      baseImage: 'ubuntu:22.04',
      instructions: ({ defaultInstructions }) => defaultInstructions,
    });
    expect(sandbox.getInstructions()).toContain('ubuntu:22.04');
  });
});

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

describe('ModalProcessManager', () => {
  async function startedSandbox(opts?: ModalSandboxOptions) {
    const sandbox = new ModalSandbox(opts);
    await sandbox._start();
    return sandbox;
  }

  type ModalSandboxOptions = ConstructorParameters<typeof ModalSandbox>[0];

  it('spawn() calls exec() with sh -c wrapper', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox({ id: 'proc-test' });
    await sandbox.processes.spawn('echo hello');

    expect(mockSandbox.exec).toHaveBeenCalledWith(['sh', '-c', 'echo hello'], expect.anything());
  });

  it('wait() returns accumulated stdout/stderr and exit code', async () => {
    const proc = makeProcess(0, ['hello\n'], ['warning\n']);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('echo hello');
    const result = await handle.wait();

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('warning\n');
  });

  it('wait() returns failure for non-zero exit code', async () => {
    const proc = makeProcess(1, [], ['error output\n']);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('false');
    const result = await handle.wait();

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('error output\n');
  });

  it('wait() is idempotent — returns the same result on repeated calls', async () => {
    const proc = makeProcess(0, ['output\n']);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cmd');
    const r1 = await handle.wait();
    const r2 = await handle.wait();

    expect(r1).toEqual(r2);
    expect(proc.wait).toHaveBeenCalledTimes(1);
  });

  it('spawn() merges sandbox-level env with per-spawn env', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox({ env: { BASE: 'base' } });
    await sandbox.processes.spawn('true', { env: { EXTRA: 'extra' } });

    expect(mockSandbox.exec).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ env: { BASE: 'base', EXTRA: 'extra' } }),
    );
  });

  it('spawn() filters undefined values from env', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox({ env: { BASE: 'base' } });
    await sandbox.processes.spawn('true', { env: { EXTRA: undefined } });

    const [, execParams] = mockSandbox.exec.mock.calls[0]!;
    expect(execParams.env).not.toHaveProperty('EXTRA');
  });

  it('spawn() passes cwd as workdir', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    await sandbox.processes.spawn('pwd', { cwd: '/app' });

    expect(mockSandbox.exec).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ workdir: '/app' }));
  });

  it('spawn() passes per-spawn timeout as timeoutMs', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    await sandbox.processes.spawn('sleep 1', { timeout: 5000 });

    expect(mockSandbox.exec).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('kill() sets exitCode to 137 and returns true', async () => {
    const { proc } = makeHangingProcess();
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 100');

    const killed = await handle.kill();
    expect(killed).toBe(true);
    expect(handle.exitCode).toBe(137);
  });

  it('kill() returns false if process already exited', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('true');
    await handle.wait();

    const killed = await handle.kill();
    expect(killed).toBe(false);
  });

  it('wait() after kill() returns exitCode 137', async () => {
    const { proc } = makeHangingProcess();
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 100');
    await handle.kill();

    const result = await handle.wait();
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(137);
  });

  it('sendStdin() throws not supported', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('cat');
    await expect(handle.sendStdin('hello')).rejects.toThrow(/stdin/i);
  });

  it('wait() with Mastra-level timeout returns exitCode 124', async () => {
    const { proc } = makeHangingProcess();
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    const handle = await sandbox.processes.spawn('sleep 100', { timeout: 50 });
    const result = await handle.wait();

    expect(result.exitCode).toBe(124);
    expect(result.success).toBe(false);
  }, 5000);

  it('list() returns tracked processes', async () => {
    const proc = makeProcess(0);
    mockSandbox.exec = vi.fn().mockResolvedValue(proc);

    const sandbox = await startedSandbox();
    await sandbox.processes.spawn('cmd1');
    await sandbox.processes.spawn('cmd2');

    const list = await sandbox.processes.list();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.command)).toContain('cmd1');
    expect(list.map(p => p.command)).toContain('cmd2');
  });
});

// ---------------------------------------------------------------------------
// Dead-sandbox retry
// ---------------------------------------------------------------------------

describe('ModalSandbox.retryOnDead()', () => {
  it('retries once on ClientClosedError and succeeds', async () => {
    const proc = makeProcess(0, ['ok\n']);
    let callCount = 0;

    mockSandbox.exec = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new ClientClosedError('sandbox closed');
      return proc;
    });

    // After dead-sandbox restart, create returns the same sandbox
    mockSandboxes.create.mockResolvedValue(mockSandbox);

    const sandbox = new ModalSandbox({ id: 'retry-test' });
    await sandbox._start();

    const handle = await sandbox.processes.spawn('echo ok');
    const result = await handle.wait();

    expect(result.stdout).toBe('ok\n');
    expect(callCount).toBe(2);
  });

  it('does not retry a second time if the retry also fails', async () => {
    mockSandbox.exec = vi.fn().mockRejectedValue(new ClientClosedError('still closed'));
    mockSandboxes.create.mockResolvedValue(mockSandbox);

    const sandbox = new ModalSandbox({ id: 'double-fail' });
    await sandbox._start();

    await expect(sandbox.processes.spawn('cmd')).rejects.toThrow();
  });

  it('does not retry on non-dead errors', async () => {
    let callCount = 0;
    mockSandbox.exec = vi.fn().mockImplementation(async () => {
      callCount++;
      throw new Error('exec failed: permission denied');
    });

    const sandbox = new ModalSandbox({ id: 'non-dead' });
    await sandbox._start();

    await expect(sandbox.processes.spawn('cmd')).rejects.toThrow('permission denied');
    expect(callCount).toBe(1);
  });
});
