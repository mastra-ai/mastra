import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const machine = {
    id: 'mach-test',
    name: 'mastra-test',
    state: vi.fn(),
    resume: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    delete: vi.fn(),
    waitUntilReady: vi.fn(),
    checkpoint: vi.fn(),
    exec: vi.fn(),
    execStream: vi.fn(),
    writeFile: vi.fn(),
  };
  return { machine, create: vi.fn(), connect: vi.fn(), list: vi.fn() };
});

vi.mock('smolmachines', () => ({ Machine: { create: sdk.create, connect: sdk.connect, list: sdk.list } }));

import { SmolSandbox } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  sdk.list.mockResolvedValue([]);
  sdk.create.mockResolvedValue(sdk.machine);
  sdk.connect.mockResolvedValue(sdk.machine);
  sdk.machine.state.mockResolvedValue('running');
  sdk.machine.exec.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
  sdk.machine.execStream.mockImplementation(async function* () {
    yield { kind: 'stdout', data: 'hello' };
    yield { kind: 'stderr', data: 'warning' };
    yield { kind: 'exit', exitCode: 3 };
  });
});

describe('SmolSandbox', () => {
  it('creates a local VM, streams command output, pauses and resumes it', async () => {
    const sandbox = new SmolSandbox({ id: 'demo', image: 'node:22-slim', env: { A: 'b' } });
    await sandbox.start();
    expect(sdk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        image: 'node:22-slim',
        detach: true,
        waitForPorts: false,
        labels: expect.objectContaining({ 'mastra.sandbox': 'smol', 'mastra.sandbox.id': 'demo' }),
      }),
      expect.objectContaining({ target: 'local' }),
    );
    const out: string[] = [];
    const result = await sandbox.executeCommand('echo', ["a'b"], {
      onStdout: chunk => out.push(chunk),
      maxRetainedBytes: 3,
    });
    expect(result).toMatchObject({ success: false, exitCode: 3, stdout: 'llo', stderr: 'ing' });
    expect(out).toEqual(['hello']);
    expect(sdk.machine.execStream.mock.calls[0]?.[0]).toEqual(['/bin/sh', '-c', `echo 'a'"'"'b'`]);
    await sandbox._stop();
    expect(sdk.machine.pause).toHaveBeenCalledOnce();
    sdk.machine.state.mockResolvedValueOnce('paused');
    await sandbox.start();
    expect(sdk.machine.resume).toHaveBeenCalledOnce();
    await sandbox._destroy();
    expect(sdk.machine.delete).toHaveBeenCalledOnce();
  });

  it('connects to a cloud machine by ID and preserves a cloud checkpoint', async () => {
    const sandbox = new SmolSandbox({
      target: 'cloud',
      id: 'other',
      machineId: 'mach-test',
      checkpointable: true,
      cloud: { apiKey: 'smk_dummy' },
    });
    sdk.machine.state.mockResolvedValue('paused');
    await sandbox.start();
    expect(sdk.connect).toHaveBeenCalledWith(
      'mach-test',
      expect.objectContaining({ target: 'cloud', apiKey: 'smk_dummy' }),
    );
    expect(sdk.machine.resume).toHaveBeenCalledOnce();
    expect(sdk.machine.waitUntilReady).toHaveBeenCalledOnce();
    sdk.machine.checkpoint.mockResolvedValue({ id: 'ckpt-1' });
    await sandbox.snapshot();
    expect(sandbox.checkpointInfo?.id).toBe('ckpt-1');
    expect((await sandbox.getInfo()).metadata).toMatchObject({ target: 'cloud', checkpointId: 'ckpt-1' });
  });

  it('refuses to reconnect a machine with an incompatible local egress policy', async () => {
    const original = new SmolSandbox({ id: 'demo', network: true });
    await original.start();
    const created = sdk.create.mock.calls[0]![0];
    sdk.list.mockResolvedValue([{ id: 'old-vm', name: created.name, labels: created.labels }]);
    sdk.create.mockClear();
    const restricted = new SmolSandbox({ id: 'demo', allowHosts: ['example.com'] });
    await expect(restricted.start()).rejects.toThrow('different configuration');
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it('uploads files and propagates explicit permission modes', async () => {
    const sandbox = new SmolSandbox();
    await sandbox.start();
    await sandbox.writeFiles([{ path: '/workspace/scripts/run.sh', content: 'echo ok', mode: 0o755 }]);
    expect(sdk.machine.exec).toHaveBeenCalledWith(['mkdir', '-p', '/workspace/scripts']);
    expect(sdk.machine.writeFile).toHaveBeenCalledWith('/workspace/scripts/run.sh', 'echo ok', 0o755);
    await sandbox.writeFiles([{ path: 'relative.txt', content: 'safe' }]);
    expect(sdk.machine.writeFile).toHaveBeenCalledWith('/workspace/relative.txt', 'safe', undefined);
    await expect(sandbox.writeFiles([{ path: '../etc/passwd', content: 'bad' }])).rejects.toThrow('escapes');
  });

  it('uses disk-preserving stop for host mounts instead of unsupported RAM pause', async () => {
    const sandbox = new SmolSandbox({ mounts: [{ source: '/host', target: '/workspace' }] });
    await sandbox.start();
    await sandbox._stop();
    expect(sdk.machine.stop).toHaveBeenCalledOnce();
    expect(sdk.machine.pause).not.toHaveBeenCalled();
  });

  it('stops ordinary Cloud VMs and only pauses explicitly checkpointable ones', async () => {
    const ordinary = new SmolSandbox({ target: 'cloud', id: 'ordinary' });
    await ordinary.start();
    expect(sdk.create.mock.calls[0]?.[0].forkable).toBeUndefined();
    expect(ordinary.supportsCheckpoints).toBe(false);
    await ordinary._stop();
    expect(sdk.machine.stop).toHaveBeenCalledOnce();
    expect(sdk.machine.pause).not.toHaveBeenCalled();
    await expect(ordinary.snapshot()).rejects.toThrow('checkpointable: true');

    vi.clearAllMocks();
    sdk.list.mockResolvedValue([]);
    sdk.create.mockResolvedValue(sdk.machine);
    const checkpointable = new SmolSandbox({ target: 'cloud', id: 'ram', checkpointable: true });
    await checkpointable.start();
    expect(sdk.create.mock.calls[0]?.[0].forkable).toBe(true);
    expect(checkpointable.supportsCheckpoints).toBe(true);
    await checkpointable._stop();
    expect(sdk.machine.pause).toHaveBeenCalledOnce();
    expect(sdk.machine.stop).not.toHaveBeenCalled();
  });

  it('uses the built-in local guest when image is null', async () => {
    const sandbox = new SmolSandbox({ id: 'builtin', image: null });
    await sandbox.start();
    expect(sdk.create).toHaveBeenCalledWith(expect.objectContaining({ image: undefined }), expect.anything());
    expect(() => new SmolSandbox({ target: 'cloud', image: null })).toThrow('require an image');
    expect(() => new SmolSandbox({ target: 'local', checkpointable: true })).toThrow('cloud-only');
    expect(() => new SmolSandbox({ target: 'cloud', checkpointPath: '/tmp/ckpt' })).toThrow('local-only');
  });

  it('rejects cloud host mounts and contradictory egress configuration', () => {
    expect(() => new SmolSandbox({ target: 'cloud', mounts: [{ source: '/host', target: '/workspace' }] })).toThrow(
      'local-only',
    );
    expect(
      () => new SmolSandbox({ mounts: [{ source: '/host', target: '/workspace' }], checkpointPath: '/tmp/checkpoint' }),
    ).toThrow('cannot capture host mounts');
    expect(() => new SmolSandbox({ network: false, allowHosts: ['example.com'] })).toThrow('cannot be combined');
  });
});
