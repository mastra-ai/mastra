import { FreestyleApiError, type Freestyle, type Vm, type VmData } from 'freestyle';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FreestyleSandbox } from './index';

const now = new Date().toISOString();

function vmData(overrides: Partial<VmData> = {}): VmData {
  return {
    id: 'vm-123',
    state: 'running',
    slug: 'stable-sandbox',
    displayName: null,
    resources: { cpu: 4, memory: 8192, storage: 32768 },
    metadata: {},
    vpcs: [],
    networks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createHarness(existing?: VmData) {
  const data = vmData();
  const vm = {
    id: data.id,
    data: vi.fn().mockResolvedValue(data),
    start: vi.fn().mockResolvedValue(data),
    pause: vi.fn().mockResolvedValue(vmData({ state: 'paused' })),
    delete: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue({ stdout: 'ok\n', stderr: '', statusCode: 0 }),
    fs: { writeFile: vi.fn().mockResolvedValue(undefined) },
  } as unknown as Vm;
  const vms = {
    get: existing
      ? vi.fn().mockResolvedValue(existing)
      : vi.fn().mockRejectedValue(new FreestyleApiError(404, { code: 'NOT_FOUND', message: 'not found' })),
    ref: vi.fn().mockReturnValue(vm),
    create: vi.fn().mockResolvedValue({ vm, vmId: data.id, data, firewallRules: [], tlsRules: [] }),
  };
  return { client: { vms } as unknown as Pick<Freestyle, 'vms'>, vm, vms, data };
}

describe('FreestyleSandbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a persistent VM with outbound network access', async () => {
    const { client, vms } = createHarness();
    const sandbox = new FreestyleSandbox({ id: 'stable-sandbox', client });

    await sandbox.start();

    expect(vms.create).toHaveBeenCalledWith({
      idleTimeoutSeconds: null,
      autoDeleteSeconds: null,
      automaticRestart: true,
      slug: 'stable-sandbox',
      firewall: {
        rules: [{ action: 'allow', source: {}, destination: { public: true } }],
      },
    });
    expect(sandbox.status).toBe('running');
  });

  it('reconnects to and resumes an existing paused VM', async () => {
    const paused = vmData({ state: 'paused' });
    const { client, vm, vms } = createHarness(paused);
    const sandbox = new FreestyleSandbox({ id: 'stable-sandbox', client });

    await sandbox.start();

    expect(vms.ref).toHaveBeenCalledWith(paused.id);
    expect(vm.start).toHaveBeenCalledOnce();
    expect(vms.create).not.toHaveBeenCalled();
  });

  it('pauses on stop and deletes on destroy', async () => {
    const { client, vm } = createHarness();
    const sandbox = new FreestyleSandbox({ id: 'stable-sandbox', client });
    await sandbox.start();

    await sandbox._stop();
    expect(vm.pause).toHaveBeenCalledOnce();
    expect(sandbox.status).toBe('stopped');

    await sandbox._destroy();
    expect(vm.delete).toHaveBeenCalledOnce();
    expect(sandbox.status).toBe('destroyed');
  });

  it('maps cwd, args, environment, output, and timeout to vm.exec()', async () => {
    const { client, vm } = createHarness();
    const sandbox = new FreestyleSandbox({
      id: 'stable-sandbox',
      client,
      workingDirectory: '/workspace',
      env: { BASE: 'one' },
    });
    const onStdout = vi.fn();

    const result = await sandbox.executeCommand('printf', ['%s', 'hello world'], {
      env: { EXTRA: 'two' },
      timeout: 10_000,
      onStdout,
    });

    expect(vm.exec).toHaveBeenCalledWith({
      command: "cd /workspace && printf '%s' 'hello world'",
      timeoutMs: 10_000,
      env: { BASE: 'one', EXTRA: 'two' },
    });
    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'ok\n', timedOut: false });
    expect(onStdout).toHaveBeenCalledWith('ok\n');
  });

  it('maps a Freestyle timeout to exit code 124', async () => {
    const { client, vm } = createHarness();
    vi.mocked(vm.exec).mockResolvedValueOnce({ stdout: '', stderr: '', statusCode: null });
    const sandbox = new FreestyleSandbox({ id: 'stable-sandbox', client });

    const result = await sandbox.executeCommand('sleep', ['10']);

    expect(result).toMatchObject({ success: false, exitCode: 124, timedOut: true });
  });

  it('writes files through the VM filesystem and preserves modes', async () => {
    const { client, vm } = createHarness();
    const sandbox = new FreestyleSandbox({ id: 'stable-sandbox', client });

    await sandbox.writeFiles([
      { path: '/workspace/a.txt', content: 'hello' },
      { path: '/workspace/run.sh', content: Buffer.from('echo ok'), mode: 0o755 },
    ]);

    expect(vm.fs.writeFile).toHaveBeenCalledWith('/workspace/a.txt', 'hello', {});
    expect(vm.fs.writeFile).toHaveBeenCalledWith('/workspace/run.sh', Buffer.from('echo ok'), { mode: 0o755 });
  });

  it('reports VM resources and persistence metadata', async () => {
    const { client } = createHarness();
    const sandbox = new FreestyleSandbox({ id: 'stable-sandbox', client });
    await sandbox.start();

    const info = await sandbox.getInfo();

    expect(info.resources).toEqual({ cpuCores: 4, memoryMB: 8192, diskMB: 32768 });
    expect(info.metadata).toMatchObject({ persistent: true, hardwareVirtualized: true });
  });
});
