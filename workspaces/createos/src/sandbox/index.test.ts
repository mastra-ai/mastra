import { supportsComputer } from '@mastra/core/workspace';
import type { FilesystemMountConfig, WorkspaceFilesystem } from '@mastra/core/workspace';
import {
  CreateosSandboxApiError,
  CreateosSandboxClient,
  CreateosSandboxNotFoundError,
  CreateosSandboxValidationError,
} from '@nodeops-createos/sandbox';
import type { DiskView, ManagedProcess, Sandbox, SandboxDiskView, SandboxStatus } from '@nodeops-createos/sandbox';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateOSSandbox } from './index';

function managedProcess(overrides: Partial<ManagedProcess> = {}): ManagedProcess {
  return {
    process_id: 'proc-1',
    kind: 'process',
    pid: 123,
    state: 'running',
    leader_exited: false,
    tree_exited: false,
    created_at: '2026-01-01T00:00:00.000Z',
    output: { oldest_seq: 0, newest_seq: 0, bytes: 0 },
    ...overrides,
  };
}

function createRemoteSandbox(initialStatus: SandboxStatus = 'running') {
  let status = initialStatus;
  const createdProcess = managedProcess();
  const processes = {
    create: vi.fn().mockResolvedValue(createdProcess),
    list: vi.fn().mockResolvedValue({ processes: [createdProcess] }),
    get: vi.fn().mockResolvedValue(createdProcess),
    connect: vi.fn().mockImplementation(async function* () {
      yield { type: 'data' as const, seq: 1, stream: 'stdout' as const, data: 'hello\n' };
      yield { type: 'exit' as const, exitCode: 0 };
    }),
    wait: vi.fn().mockResolvedValue(managedProcess({ state: 'exited', exit_code: 0 })),
    delete: vi.fn().mockResolvedValue(managedProcess({ state: 'exited', exit_code: 137 })),
    input: vi.fn().mockResolvedValue({ input_seq: 1 }),
    closeStdin: vi.fn().mockResolvedValue({ ok: true }),
  };
  const files = { upload: vi.fn().mockResolvedValue(undefined) };
  const diskMounts = {
    list: vi.fn().mockResolvedValue([] as SandboxDiskView[]),
    attach: vi.fn().mockResolvedValue({ ok: true }),
    detach: vi.fn().mockResolvedValue({ detached: true }),
  };
  const computer = {
    screenshot: vi.fn().mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer),
    screen: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
    cursor: vi.fn().mockResolvedValue({ x: 12, y: 34 }),
    mouse: {
      click: vi.fn().mockResolvedValue({ ok: true }),
      move: vi.fn().mockResolvedValue({ ok: true }),
      drag: vi.fn().mockResolvedValue({ ok: true }),
      scroll: vi.fn().mockResolvedValue({ ok: true }),
    },
    keyboard: {
      type: vi.fn().mockResolvedValue({ ok: true }),
      press: vi.fn().mockResolvedValue({ ok: true }),
    },
    screens: {
      connect: vi.fn().mockResolvedValue({
        screen_id: 'screen-2',
        port: 6080,
        path: '/novnc',
        token: 'viewer-token',
        expires_at: '2026-01-01T01:00:00.000Z',
        url: 'https://desktop.example.test',
      }),
    },
  };
  const remote = {
    id: 'sb-createos-1',
    name: 'remote-name',
    get status() {
      return status;
    },
    get data() {
      return {
        id: 'sb-createos-1',
        name: 'remote-name',
        status,
        vcpu: 2,
        mem_mib: 2048,
        disk_mib: 4096,
        created_at: '2026-01-01T00:00:00.000Z',
        ingress_enabled: true,
        ingress_url_template: 'https://<port>.example.test',
        shape: 's-2vcpu-2gb',
      };
    },
    processes,
    files,
    computer,
    listDisks: diskMounts.list,
    attachDisk: diskMounts.attach,
    detachDisk: diskMounts.detach,
    previewUrl: vi.fn((port: number) => `https://${port}.example.test`),
    pause: vi.fn().mockImplementation(async () => {
      status = 'paused';
      return remote;
    }),
    resume: vi.fn().mockImplementation(async () => {
      status = 'running';
      return remote;
    }),
    destroy: vi.fn().mockImplementation(async () => {
      status = 'destroyed';
      return { id: 'sb-createos-1', status: 'destroyed' };
    }),
    waitUntilRunning: vi.fn().mockResolvedValue(undefined),
    waitUntilPaused: vi.fn().mockResolvedValue(undefined),
    waitUntilDestroyed: vi.fn().mockResolvedValue(undefined),
  };
  return { remote: remote as unknown as Sandbox, processes, files, computer, diskMounts };
}

function createClient(remote: Sandbox | null) {
  const disks = {
    get: vi.fn(),
    create: vi.fn(),
    rotateCredentials: vi.fn(),
  };
  return {
    createSandbox: vi.fn().mockResolvedValue(remote),
    getSandbox: vi.fn().mockResolvedValue(remote),
    listSandboxes: vi.fn().mockResolvedValue(remote ? [remote] : []),
    disks,
  };
}

function mountableFilesystem(config: FilesystemMountConfig, id = 'storage'): WorkspaceFilesystem {
  return {
    id,
    name: 'TestFilesystem',
    provider: config.type,
    status: 'running',
    getMountConfig: () => config,
  } as unknown as WorkspaceFilesystem;
}

const disk: DiskView = {
  id: 'disk-1',
  name: 'mastra-s3-disk',
  kind: 's3',
  config: {
    bucket: 'workspace-data',
    endpoint: 'https://s3.us-east-1.amazonaws.com',
    region: 'us-east-1',
  },
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('CreateOSSandbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('coalesces concurrent starts and creates one sandbox', async () => {
    const { remote } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({
      id: 'session-1',
      client: client as unknown as CreateosSandboxClient,
    });

    const [first, second] = await Promise.all([sandbox.start(), sandbox.start()]);

    expect(first).toEqual({ outcome: 'created' });
    expect(second).toEqual({ outcome: 'created' });
    expect(client.createSandbox).toHaveBeenCalledTimes(1);
    expect(client.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ shape: 's-2vcpu-2gb', name: expect.stringMatching(/^mastra-sessi-/) }),
      { timeoutMs: 300_000 },
    );
    expect(client.createSandbox.mock.calls[0]?.[0].name).toHaveLength(22);
  });

  it('reconnects by deterministic name and resumes a paused sandbox', async () => {
    const { remote } = createRemoteSandbox('paused');
    Object.defineProperty(remote, 'name', { value: 'mastra-sessi-5d9061408' });
    const client = createClient(remote);
    const sandbox = new CreateOSSandbox({
      id: 'session-2',
      client: client as unknown as CreateosSandboxClient,
    });

    await expect(sandbox.start()).resolves.toEqual({ outcome: 'connected' });

    expect(remote.resume).toHaveBeenCalledOnce();
    expect(client.createSandbox).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent deterministic-name conflict', async () => {
    const { remote } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockRejectedValue(
      new CreateosSandboxValidationError('name already exists', new Response('', { status: 409 })),
    );
    client.listSandboxes
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([Object.assign(remote, { name: 'mastra-confl-2b1a2f3d4' })]);
    const sandbox = new CreateOSSandbox({
      id: 'conflict',
      sandboxName: 'mastra-confl-2b1a2f3d4',
      client: client as unknown as CreateosSandboxClient,
    });

    await expect(sandbox.start()).resolves.toEqual({ outcome: 'created' });
    expect(sandbox.createos).toBe(remote);
  });

  it('does not treat non-conflict validation failures as name collisions', async () => {
    const { remote } = createRemoteSandbox();
    const client = createClient(remote);
    const validationError = new CreateosSandboxValidationError('unknown shape', new Response('', { status: 422 }));
    client.createSandbox.mockRejectedValue(validationError);
    client.listSandboxes.mockResolvedValueOnce([]).mockResolvedValueOnce([remote]);
    const sandbox = new CreateOSSandbox({
      id: 'invalid-shape',
      client: client as unknown as CreateosSandboxClient,
    });

    await expect(sandbox.start()).rejects.toBe(validationError);
    expect(client.listSandboxes).toHaveBeenCalledOnce();
  });

  it('executes commands with runtime env and cwd through managed processes', async () => {
    const { remote, processes } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({
      id: 'commands',
      workingDirectory: '/workspace/repo',
      client: client as unknown as CreateosSandboxClient,
    });
    sandbox.setEnv(env => ({ ...env, GH_TOKEN: "token'123" }));

    const result = await sandbox.executeCommand!('printf', ['%s', 'hello world']);

    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'hello\n' });
    expect(processes.create).toHaveBeenCalledWith({
      cmd: 'bash',
      args: [
        '-lc',
        `export GH_TOKEN='token'\\''123'\ncd -- '/workspace/repo'\nexec bash -lc "$1"`,
        'mastra',
        "printf '%s' 'hello world'",
      ],
    });
  });

  it('replaces a deleted sandbox, restores mounts, and retries process creation once', async () => {
    const { remote: deleted, processes: deletedProcesses } = createRemoteSandbox();
    const { remote: replacement, processes: replacementProcesses, diskMounts } = createRemoteSandbox();
    deletedProcesses.create.mockRejectedValueOnce(
      new CreateosSandboxNotFoundError('sandbox not found', new Response('', { status: 404 })),
    );

    const client = createClient(null);
    client.createSandbox.mockResolvedValueOnce(deleted).mockResolvedValueOnce(replacement);
    client.getSandbox.mockRejectedValue(
      new CreateosSandboxNotFoundError('sandbox not found', new Response('', { status: 404 })),
    );
    client.disks.get.mockResolvedValue(disk);
    client.disks.rotateCredentials.mockResolvedValue(disk);

    const config = {
      type: 's3',
      bucket: 'workspace-data',
      region: 'us-east-1',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    } as FilesystemMountConfig;
    const filesystem = mountableFilesystem(config);
    const attachment: SandboxDiskView = {
      disk_id: disk.id,
      name: disk.name,
      kind: 's3',
      config: disk.config,
      mount_path: '/data',
      mount_status: 'mounted',
    };
    diskMounts.list.mockResolvedValue([attachment]);
    diskMounts.list.mockResolvedValueOnce([]);

    const sandbox = new CreateOSSandbox({ id: 'dead-recovery', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();
    sandbox.mounts.add({ '/data': filesystem });
    sandbox.mounts.set('/data', { state: 'mounted', config });

    await expect(sandbox.executeCommand!('echo', ['recovered'])).resolves.toMatchObject({
      success: true,
      stdout: 'hello\n',
    });

    expect(client.createSandbox).toHaveBeenCalledTimes(2);
    expect(deletedProcesses.create).toHaveBeenCalledOnce();
    expect(replacementProcesses.create).toHaveBeenCalledOnce();
    expect(diskMounts.attach).toHaveBeenCalledWith({ diskId: disk.id, mountPath: '/data' }, { timeoutMs: 300_000 });
    expect(sandbox.mounts.get('/data')?.state).toBe('mounted');
  });

  it('reconnects and retries when a stale running handle belongs to a paused sandbox', async () => {
    const { remote, processes } = createRemoteSandbox();
    processes.create.mockRejectedValueOnce(
      new CreateosSandboxApiError('sandbox has no ip', new Response('', { status: 503 })),
    );
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    client.getSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({ id: 'paused-recovery', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();
    await remote.pause();

    await expect(sandbox.executeCommand!('echo', ['recovered'])).resolves.toMatchObject({ success: true });

    expect(client.createSandbox).toHaveBeenCalledOnce();
    expect(client.getSandbox).toHaveBeenCalledWith(remote.id, { timeoutMs: 300_000 });
    expect(remote.resume).toHaveBeenCalledOnce();
    expect(processes.create).toHaveBeenCalledTimes(2);
  });

  it('does not retry ordinary process errors', async () => {
    const { remote, processes } = createRemoteSandbox();
    processes.create.mockRejectedValueOnce(new Error('command rejected'));
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({ id: 'no-retry', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();

    await expect(sandbox.executeCommand!('false')).rejects.toThrow('command rejected');

    expect(processes.create).toHaveBeenCalledOnce();
    expect(client.getSandbox).not.toHaveBeenCalled();
    expect(client.createSandbox).toHaveBeenCalledOnce();
  });

  it('retries a dead-sandbox failure only once', async () => {
    const notFound = new CreateosSandboxNotFoundError('sandbox not found', new Response('', { status: 404 }));
    const { remote: deleted, processes: deletedProcesses } = createRemoteSandbox();
    const { remote: replacement, processes: replacementProcesses } = createRemoteSandbox();
    deletedProcesses.create.mockRejectedValue(notFound);
    replacementProcesses.create.mockRejectedValue(notFound);
    const client = createClient(null);
    client.createSandbox.mockResolvedValueOnce(deleted).mockResolvedValueOnce(replacement);
    client.getSandbox.mockRejectedValue(notFound);
    const sandbox = new CreateOSSandbox({ id: 'one-retry', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();

    await expect(sandbox.executeCommand!('false')).rejects.toBe(notFound);

    expect(client.createSandbox).toHaveBeenCalledTimes(2);
    expect(deletedProcesses.create).toHaveBeenCalledOnce();
    expect(replacementProcesses.create).toHaveBeenCalledOnce();
  });

  it('coalesces recovery for concurrent failures from the same stale sandbox', async () => {
    const notFound = new CreateosSandboxNotFoundError('sandbox not found', new Response('', { status: 404 }));
    const { remote: deleted, processes: deletedProcesses } = createRemoteSandbox();
    const { remote: replacement, processes: replacementProcesses } = createRemoteSandbox();
    deletedProcesses.create.mockRejectedValue(notFound);
    const client = createClient(null);
    client.createSandbox.mockResolvedValueOnce(deleted).mockResolvedValueOnce(replacement);
    client.getSandbox.mockRejectedValue(notFound);
    const sandbox = new CreateOSSandbox({
      id: 'concurrent-recovery',
      client: client as unknown as CreateosSandboxClient,
    });
    await sandbox.start();

    await expect(
      Promise.all([sandbox.executeCommand!('echo', ['first']), sandbox.executeCommand!('echo', ['second'])]),
    ).resolves.toHaveLength(2);

    expect(client.createSandbox).toHaveBeenCalledTimes(2);
    expect(deletedProcesses.create).toHaveBeenCalledTimes(2);
    expect(replacementProcesses.create).toHaveBeenCalledTimes(2);
  });

  it('uploads files and exposes ingress URLs', async () => {
    const { remote, files } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({ id: 'files', client: client as unknown as CreateosSandboxClient });

    await sandbox.writeFiles([{ path: '/tmp/a.txt', content: 'hello' }]);

    expect(files.upload).toHaveBeenCalledWith('/tmp/a.txt', 'hello');
    await expect(sandbox.networking.getPortUrl(8080)).resolves.toBe('https://8080.example.test');
  });

  it('registers and live-mounts an S3 filesystem through CreateOS disks', async () => {
    const { remote, diskMounts } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    client.disks.get.mockRejectedValue(
      new CreateosSandboxNotFoundError('disk not found', new Response('', { status: 404 })),
    );
    client.disks.create.mockResolvedValue(disk);
    const attachment: SandboxDiskView = {
      disk_id: disk.id,
      name: disk.name,
      kind: 's3',
      config: disk.config,
      mount_path: '/workspace/data',
      sub_path: 'projects/demo',
      mount_status: 'mounted',
    };
    diskMounts.list.mockResolvedValue([attachment]);
    diskMounts.list.mockResolvedValueOnce([]);
    const sandbox = new CreateOSSandbox({ id: 'mounts', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();

    const result = await sandbox.mount(
      mountableFilesystem({
        type: 's3',
        bucket: 'workspace-data',
        region: 'us-east-1',
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
        prefix: '/projects/demo/',
      } as FilesystemMountConfig),
      '/workspace/data',
    );

    expect(result).toEqual({ success: true, mountPath: '/workspace/data' });
    expect(client.disks.create).toHaveBeenCalledWith(
      {
        name: expect.stringMatching(/^mastra-s3-[a-f0-9]{24}$/),
        kind: 's3',
        config: {
          bucket: 'workspace-data',
          endpoint: 'https://s3.us-east-1.amazonaws.com',
          region: 'us-east-1',
        },
        credentials: { access_key: 'access-key', secret_key: 'secret-key' },
      },
      { timeoutMs: 300_000 },
    );
    expect(diskMounts.attach).toHaveBeenCalledWith(
      { diskId: disk.id, mountPath: '/workspace/data', subPath: 'projects/demo' },
      { timeoutMs: 300_000 },
    );
    expect(sandbox.mounts.get('/workspace/data')?.state).toBe('mounted');
    expect(sandbox.getInfo().mounts).toEqual([{ path: '/workspace/data', filesystem: 'storage' }]);

    await sandbox.unmount('/workspace/data');
    expect(diskMounts.detach).toHaveBeenCalledWith(
      { diskId: disk.id, mountPath: '/workspace/data' },
      { timeoutMs: 300_000 },
    );
    expect(sandbox.mounts.has('/workspace/data')).toBe(false);
  });

  it('reuses a registered CreateOS disk and rotates its credentials', async () => {
    const { remote, diskMounts } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    client.disks.get.mockResolvedValue(disk);
    client.disks.rotateCredentials.mockResolvedValue(disk);
    diskMounts.list.mockResolvedValue([
      {
        disk_id: disk.id,
        name: disk.name,
        kind: 's3',
        config: disk.config,
        mount_path: '/data',
        mount_status: 'mounted',
      },
    ]);
    const sandbox = new CreateOSSandbox({ id: 'reuse-mount', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();

    await expect(
      sandbox.mount(
        mountableFilesystem({
          type: 's3',
          bucket: 'workspace-data',
          region: 'us-east-1',
          accessKeyId: 'access-key',
          secretAccessKey: 'rotated-secret',
        } as FilesystemMountConfig),
        '/data',
      ),
    ).resolves.toEqual({ success: true, mountPath: '/data' });

    expect(client.disks.create).not.toHaveBeenCalled();
    expect(client.disks.rotateCredentials).toHaveBeenCalledWith(
      expect.stringMatching(/^mastra-s3-/),
      { access_key: 'access-key', secret_key: 'rotated-secret' },
      { timeoutMs: 300_000 },
    );
    expect(diskMounts.attach).not.toHaveBeenCalled();
  });

  it('reports unsupported mount configurations without contacting the disk API', async () => {
    const { remote } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({
      id: 'unsupported-mount',
      client: client as unknown as CreateosSandboxClient,
    });
    await sandbox.start();

    await expect(sandbox.mount(mountableFilesystem({ type: 'gcs' }), '/data')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('only support S3'),
    });
    await expect(
      sandbox.mount(
        mountableFilesystem({
          type: 's3',
          bucket: 'workspace-data',
          region: 'us-east-1',
          accessKeyId: 'access-key',
          secretAccessKey: 'secret-key',
          readOnly: true,
        } as FilesystemMountConfig),
        '/readonly',
      ),
    ).resolves.toMatchObject({ success: false, error: expect.stringContaining('read-only') });
    expect(client.disks.get).not.toHaveBeenCalled();
  });

  it('adapts CreateOS desktop controls to the Mastra computer capability', async () => {
    const { remote, computer } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({
      id: 'desktop',
      computerUse: { screenId: 'screen-2' },
      client: client as unknown as CreateosSandboxClient,
    });

    expect(supportsComputer(sandbox)).toBe(true);
    const desktop = sandbox.computer!;
    await expect(desktop.screenshot()).resolves.toEqual({
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mediaType: 'image/png',
    });
    await desktop.leftClick(1, 2);
    await desktop.rightClick(3, 4);
    await desktop.doubleClick(5, 6);
    await desktop.moveMouse(7, 8);
    await desktop.drag({ x: 9, y: 10 }, { x: 11, y: 12 });
    await desktop.scroll('down', 3);
    await desktop.type('hello');
    await desktop.press('Enter');
    await desktop.press(['ctrl', 's']);
    await expect(desktop.getScreenSize()).resolves.toEqual({ width: 1280, height: 720 });
    await expect(desktop.getCursorPosition()).resolves.toEqual({ x: 12, y: 34 });
    await expect(desktop.streamUrl?.()).resolves.toBe('https://desktop.example.test');

    expect(client.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ rootfs: 'desktop:1' }),
      expect.anything(),
    );
    expect(computer.mouse.click).toHaveBeenNthCalledWith(
      1,
      { button: 'left', x: 1, y: 2, count: 1 },
      { screenId: 'screen-2' },
    );
    expect(computer.mouse.click).toHaveBeenNthCalledWith(
      2,
      { button: 'right', x: 3, y: 4, count: 1 },
      { screenId: 'screen-2' },
    );
    expect(computer.mouse.click).toHaveBeenNthCalledWith(
      3,
      { button: 'left', x: 5, y: 6, count: 2 },
      { screenId: 'screen-2' },
    );
    expect(computer.mouse.move).toHaveBeenCalledWith({ x: 7, y: 8 }, { screenId: 'screen-2' });
    expect(computer.mouse.drag).toHaveBeenCalledWith(
      { from: { x: 9, y: 10 }, to: { x: 11, y: 12 } },
      { screenId: 'screen-2' },
    );
    expect(computer.mouse.scroll).toHaveBeenCalledWith({ direction: 'down', amount: 3 }, { screenId: 'screen-2' });
    expect(computer.keyboard.type).toHaveBeenCalledWith('hello', { screenId: 'screen-2' });
    expect(computer.keyboard.press).toHaveBeenNthCalledWith(1, ['Enter'], { screenId: 'screen-2' });
    expect(computer.keyboard.press).toHaveBeenNthCalledWith(2, ['ctrl', 's'], { screenId: 'screen-2' });
    expect(computer.screens.connect).toHaveBeenCalledWith('screen-2');
  });

  it('only exposes computer tools when desktop support is configured', () => {
    const { remote } = createRemoteSandbox();
    const client = createClient(remote);

    expect(new CreateOSSandbox({ client: client as unknown as CreateosSandboxClient }).computer).toBeUndefined();
    expect(
      new CreateOSSandbox({
        rootfs: 'desktop:1',
        computerUse: false,
        client: client as unknown as CreateosSandboxClient,
      }).computer,
    ).toBeUndefined();
    expect(
      supportsComputer(
        new CreateOSSandbox({ rootfs: 'desktop:1', client: client as unknown as CreateosSandboxClient }),
      ),
    ).toBe(true);
  });

  it('waits for the CreateOS desktop stack before the first computer operation', async () => {
    const { remote, computer } = createRemoteSandbox();
    computer.screen
      .mockRejectedValueOnce(
        new CreateosSandboxValidationError('desktop unavailable', new Response('', { status: 409 })),
      )
      .mockResolvedValue({ width: 1280, height: 720 });
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({
      computerUse: { readyTimeoutMs: 10 },
      client: client as unknown as CreateosSandboxClient,
    });

    await expect(sandbox.computer?.getCursorPosition()).resolves.toEqual({ x: 12, y: 34 });
    expect(computer.screen).toHaveBeenCalledTimes(2);
  });

  it('pauses and destroys the attached sandbox', async () => {
    const { remote } = createRemoteSandbox();
    const client = createClient(null);
    client.createSandbox.mockResolvedValue(remote);
    client.getSandbox.mockResolvedValue(remote);
    const sandbox = new CreateOSSandbox({ id: 'lifecycle', client: client as unknown as CreateosSandboxClient });
    await sandbox.start();

    await sandbox._stop();
    expect(remote.pause).toHaveBeenCalledOnce();
    expect(sandbox.status).toBe('stopped');

    await sandbox._destroy();
    expect(remote.destroy).toHaveBeenCalledOnce();
    expect(sandbox.status).toBe('destroyed');
  });
});
