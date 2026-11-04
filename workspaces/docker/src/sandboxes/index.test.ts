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
      { idempotencyKey: 'stable-id' },
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
      expect.objectContaining({ args: ['echo', 'hello'], workingDir: '/home/user', env: { TOKEN: 'test' } }),
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
