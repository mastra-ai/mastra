import { NotFoundError } from '@docker/sandboxes';
import type { Sandboxes } from '@docker/sandboxes';
import { SandboxAbortError } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { DockerSandboxesSandbox } from './index';

function setup(existing = false) {
  const chunks = [
    { type: 'chunk', stream: 'stdout', data: Buffer.from('hello ') },
    { type: 'chunk', stream: 'stdout', data: Buffer.from('world') },
    { type: 'chunk', stream: 'stderr', data: Buffer.from('warning') },
    { type: 'exited', exitCode: 0 },
  ];
  const connection = {
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
    close: vi.fn().mockResolvedValue(undefined),
  };
  const process = {
    connect: vi.fn().mockResolvedValue(connection),
    signal: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue({ exitCode: 0 }),
  };
  const remote = {
    name: 'sandboxes/remote-id',
    displayName: 'stable-id',
    status: 'running',
    resource: { core: { createdAt: new Date('2026-01-01') } },
    waitUntilRunning: vi.fn(),
    waitUntilStopped: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    refresh: vi.fn(),
    delete: vi.fn(),
    processes: { start: vi.fn().mockResolvedValue(process) },
    files: {
      read: vi.fn().mockResolvedValue(Buffer.from('contents')),
      mkdir: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
    },
  };
  remote.waitUntilRunning.mockResolvedValue(remote);
  remote.waitUntilStopped.mockResolvedValue(remote);
  remote.start.mockResolvedValue(remote);
  remote.stop.mockResolvedValue(remote);
  remote.refresh.mockResolvedValue(remote);
  remote.delete.mockResolvedValue(undefined);
  const client = {
    get: vi.fn().mockResolvedValue(remote),
    create: vi.fn().mockResolvedValue(remote),
    async *all() {
      if (existing) yield remote;
    },
    close: vi.fn().mockResolvedValue(undefined),
  };
  const sandbox = new DockerSandboxesSandbox({
    id: 'stable-id',
    image: 'ubuntu:24.04',
    client: client as unknown as Sandboxes,
  });
  return { sandbox, client, remote, process, connection };
}

describe('DockerSandboxesSandbox', () => {
  it('creates a new microVM and reconnects to its stable logical ID', async () => {
    const created = setup();
    expect(await created.sandbox.start()).toEqual({ outcome: 'created' });
    expect(created.client.create).toHaveBeenCalledWith(
      expect.objectContaining({ image: 'ubuntu:24.04', displayName: 'stable-id' }),
      { idempotencyKey: expect.any(String) },
    );
    expect(created.sandbox.sandboxId).toBe('sandboxes/remote-id');
    expect(created.sandbox.getInfo().createdAt).toEqual(new Date('2026-01-01'));

    const connected = setup(true);
    expect(await connected.sandbox.start()).toEqual({ outcome: 'connected' });
    expect(connected.client.create).not.toHaveBeenCalled();
    await connected.sandbox.stop();
    expect(connected.remote.stop).toHaveBeenCalledOnce();
    await connected.sandbox.destroy();
    expect(connected.remote.delete).toHaveBeenCalledOnce();
    expect(connected.client.close).not.toHaveBeenCalled();
  });

  it.each(['degraded', 'stopped', 'stopping', 'deleting'])(
    'rejects a %s VM returned by waitUntilRunning',
    async status => {
      const { sandbox, remote } = setup(true);
      remote.waitUntilRunning.mockResolvedValue({ ...remote, status });
      await expect(sandbox.start()).rejects.toThrow(/not ready/i);
      expect(sandbox.status).not.toBe('running');
    },
  );

  it('retains the remote handle when a newly created VM fails to start', async () => {
    const { sandbox, remote } = setup();
    remote.waitUntilRunning.mockRejectedValue(new Error('startup failed'));
    await expect(sandbox.start()).rejects.toThrow('startup failed');
    expect(sandbox.sandboxId).toBe(remote.name);
    await sandbox.destroy();
    expect(remote.delete).toHaveBeenCalledOnce();
  });

  it('reconnects to a remote ID without listing other sandboxes', async () => {
    const { sandbox, client } = setup();
    const direct = new DockerSandboxesSandbox({
      id: 'stable-id',
      sandboxId: 'sandboxes/remote-id',
      image: 'ubuntu:24.04',
      client: client as unknown as Sandboxes,
    });
    expect(await direct.start()).toEqual({ outcome: 'connected' });
    expect(client.get).toHaveBeenCalledWith('sandboxes/remote-id');
    expect(client.create).not.toHaveBeenCalled();
    expect(sandbox.status).toBe('pending');
  });

  it('recreates a VM removed after the first start and runs commands on the replacement', async () => {
    const { sandbox, client, remote } = setup();
    expect(await sandbox.start()).toEqual({ outcome: 'created' });
    await sandbox._stop();
    const replacement = { ...remote, name: 'sandboxes/replacement' };
    replacement.waitUntilRunning = vi.fn().mockResolvedValue(replacement);
    client.get.mockRejectedValue(new NotFoundError({ code: 'not_found', message: 'sandbox not found' }, 404));
    const keys = new Set<string>();
    client.create.mockImplementation(async (_input, { idempotencyKey }) => {
      if (keys.has(idempotencyKey)) return remote;
      keys.add(idempotencyKey);
      return replacement;
    });

    expect((await sandbox.executeCommand('echo', ['recovered'])).success).toBe(true);
    expect(client.create.mock.calls[0][1].idempotencyKey).not.toBe(client.create.mock.calls[1][1].idempotencyKey);
    expect(client.get).toHaveBeenCalledWith(remote.name);
    expect(client.create).toHaveBeenCalledTimes(2);
    expect(sandbox.sandboxId).toBe(replacement.name);
    expect(replacement.processes.start).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['sh', '-lc', 'echo recovered'] }),
      expect.anything(),
    );
  });

  it('reuses the creation key when retrying an uncertain create failure', async () => {
    const { sandbox, client, remote } = setup();
    client.create.mockRejectedValueOnce(new Error('request interrupted'));
    await expect(sandbox.start()).rejects.toThrow('request interrupted');
    client.create.mockResolvedValue(remote);

    expect(await sandbox.start()).toEqual({ outcome: 'created' });
    expect(client.create.mock.calls[0][1].idempotencyKey).toBe(client.create.mock.calls[1][1].idempotencyKey);
  });

  it('does not recreate a missing explicitly selected VM or hide other lookup failures', async () => {
    const { client } = setup();
    const direct = new DockerSandboxesSandbox({
      id: 'stable-id',
      sandboxId: 'sandboxes/remote-id',
      image: 'ubuntu:24.04',
      client: client as unknown as Sandboxes,
    });
    const missing = new NotFoundError({ code: 'not_found', message: 'sandbox not found' }, 404);
    client.get.mockRejectedValue(missing);
    await expect(direct.start()).rejects.toBe(missing);
    expect(client.create).not.toHaveBeenCalled();

    const transient = setup();
    await transient.sandbox.start();
    await transient.sandbox._stop();
    const failure = new Error('API unavailable');
    transient.client.get.mockRejectedValue(failure);
    await expect(transient.sandbox.start()).rejects.toBe(failure);
    expect(transient.client.create).toHaveBeenCalledOnce();
  });

  it('does not reconnect to a deleting VM with the same logical ID', async () => {
    const { sandbox, client, remote } = setup(true);
    remote.status = 'deleting';
    const replacement = { ...remote, name: 'sandboxes/replacement', status: 'running' };
    replacement.waitUntilRunning = vi.fn().mockResolvedValue(replacement);
    client.create.mockResolvedValue(replacement);
    expect(await sandbox.start()).toEqual({ outcome: 'created' });
    expect(sandbox.sandboxId).toBe(replacement.name);
  });

  it('streams command output and respects the retention limit', async () => {
    const { sandbox, remote, connection } = setup();
    const stdout = vi.fn();
    const result = await sandbox.executeCommand('echo', ['hello'], {
      cwd: '/home/user',
      env: { TOKEN: 'test' },
      maxRetainedBytes: 6,
      onStdout: stdout,
    });
    expect(remote.processes.start).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['sh', '-lc', 'echo hello'], workingDir: '/home/user', env: { TOKEN: 'test' } }),
      expect.anything(),
    );
    expect(stdout.mock.calls.map(([data]) => data).join('')).toBe('hello world');
    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      stdout: ' world',
      stderr: 'arning',
      stdoutTruncated: true,
    });
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it('runs command strings and quoted arguments through a shell', async () => {
    const { sandbox, remote } = setup();
    await sandbox.executeCommand('ls -la | head -3 && echo "done" > /tmp/out');
    await sandbox.executeCommand('printf', ['%s\n', "it's $HOME"]);
    await sandbox.executeCommand('npm run build', ['--silent']);
    expect(remote.processes.start.mock.calls.map(([request]) => request.args)).toEqual([
      ['sh', '-lc', 'ls -la | head -3 && echo "done" > /tmp/out'],
      ['sh', '-lc', `printf '%s\n' 'it'\\''s $HOME'`],
      ['sh', '-lc', 'npm run build --silent'],
    ]);
  });

  it('retains only complete UTF-8 characters when the byte limit splits one', async () => {
    const { sandbox, process } = setup();
    const onStdout = vi.fn();
    process.connect.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'chunk', stream: 'stdout', data: Buffer.from([0x61, 0xe2]) };
        yield { type: 'chunk', stream: 'stdout', data: Buffer.from([0x82, 0xac, 0x62]) };
        yield { type: 'exited', exitCode: 0 };
      },
      close: vi.fn(),
    });
    const result = await sandbox.executeCommand('echo', [], { maxRetainedBytes: 4, onStdout });
    expect(onStdout.mock.calls.map(([text]) => text).join('')).toBe('a€b');
    expect(result).toMatchObject({ stdout: '€b', stdoutDroppedBytes: 1, stdoutTruncated: true });

    const narrower = await sandbox.executeCommand('echo', [], { maxRetainedBytes: 3 });
    expect(narrower).toMatchObject({ stdout: 'b', stdoutDroppedBytes: 4, stdoutTruncated: true });
  });

  it.each(['timeout', 'external abort'])('kills an active process on %s', async kind => {
    const { sandbox, process } = setup();
    const abort = new AbortController();
    process.connect.mockImplementation(async (_options: unknown, call: { signal: AbortSignal }) => ({
      async *[Symbol.asyncIterator]() {
        await new Promise<void>(resolve => call.signal.addEventListener('abort', () => resolve(), { once: true }));
      },
      close: vi.fn(),
    }));
    const resultPromise = sandbox.executeCommand('sleep', ['100'], {
      ...(kind === 'timeout' ? { timeout: 10 } : { abortSignal: abort.signal }),
    });
    if (kind === 'external abort') setTimeout(() => abort.abort(), 10);
    const result = await resultPromise;
    expect(process.signal).toHaveBeenCalledWith('kill');
    expect(result).toMatchObject({ killed: true, timedOut: kind === 'timeout', success: false });
  });

  it.each(['timeout', 'external abort'])('kills a process created after %s during startup', async kind => {
    const { sandbox, remote, process } = setup();
    const abort = new AbortController();
    let finishStart!: (value: typeof process) => void;
    remote.processes.start.mockImplementation(() => new Promise<typeof process>(resolve => (finishStart = resolve)));
    const resultPromise = sandbox.executeCommand('sleep', ['100'], {
      ...(kind === 'timeout' ? { timeout: 10 } : { abortSignal: abort.signal }),
    });
    await vi.waitFor(() => expect(remote.processes.start).toHaveBeenCalledOnce());
    if (kind === 'timeout') await new Promise(resolve => setTimeout(resolve, 20));
    else abort.abort();
    finishStart(process);
    const result = await resultPromise;
    expect(process.signal).toHaveBeenCalledWith('kill');
    expect(process.connect).not.toHaveBeenCalled();
    expect(result).toMatchObject({ killed: true, timedOut: kind === 'timeout', success: false });
  });

  it('reads and writes files, including explicit permissions', async () => {
    const { sandbox, remote } = setup();
    await sandbox.writeFiles([{ path: '/tmp/nested/key', content: 'secret', mode: 0o600 }]);
    expect(remote.files.mkdir).toHaveBeenCalledWith('/tmp/nested', { parents: true }, expect.anything());
    expect(remote.files.write).toHaveBeenCalledWith('/tmp/nested/key', 'secret', { mode: 0o600 }, expect.anything());
    expect(await sandbox.readFile('/tmp/nested/key')).toEqual(Buffer.from('contents'));
    await expect(sandbox.writeFiles([{ path: '/tmp/key', content: 'x', mode: 0 }])).rejects.toThrow();
    const abort = new AbortController();
    abort.abort();
    await expect(
      sandbox.writeFiles([{ path: '/tmp/key', content: 'x' }], { abortSignal: abort.signal }),
    ).rejects.toBeInstanceOf(SandboxAbortError);
  });
});
