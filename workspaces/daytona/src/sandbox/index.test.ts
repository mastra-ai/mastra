/**
 * Daytona Sandbox Provider Tests
 *
 * Tests Daytona-specific functionality including:
 * - Constructor options and ID generation
 * - Race condition prevention in start()
 * - Environment variable handling
 * - Command execution
 * - Lifecycle operations
 * - Error handling and retry logic
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { createSandboxLifecycleTests, createMountOperationsTests } from '@internal/workspace-test-utils';
import { SandboxNotReadyError } from '@mastra/core/workspace';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

import { DaytonaSandbox } from './index';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const { mockSandbox, mockDaytona, resetMockDefaults, DaytonaError, DaytonaNotFoundError } = vi.hoisted(() => {
  const mockSandbox = {
    id: 'mock-sandbox-id',
    state: 'started',
    cpu: 1,
    memory: 1,
    disk: 3,
    target: 'us',
    process: {
      codeRun: vi.fn().mockResolvedValue({ exitCode: 0, result: '', artifacts: { stdout: '' } }),
      executeCommand: vi.fn().mockResolvedValue({ exitCode: 0, result: '' }),
      createSession: vi.fn().mockResolvedValue(undefined),
      executeSessionCommand: vi.fn().mockResolvedValue({ cmdId: 'cmd-123' }),
      getSessionCommandLogs: vi
        .fn()
        .mockImplementation(async (_sessionId: string, _cmdId: string, onStdout: (chunk: string) => void) => {
          onStdout('');
        }),
      getSessionCommand: vi.fn().mockResolvedValue({ id: 'cmd-123', command: '', exitCode: 0 }),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    },
    fs: {
      uploadFile: vi.fn().mockResolvedValue(undefined),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('')),
    },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockDaytona = {
    create: vi.fn().mockResolvedValue(mockSandbox),
    get: vi.fn().mockRejectedValue(new Error('No sandbox found')),
    delete: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
  };

  const resetMockDefaults = () => {
    mockDaytona.create.mockResolvedValue(mockSandbox);
    mockDaytona.get.mockRejectedValue(new DaytonaNotFoundError('No sandbox found'));
    mockDaytona.delete.mockResolvedValue(undefined);
    mockDaytona.stop.mockResolvedValue(undefined);
    mockDaytona.start.mockResolvedValue(undefined);
    mockSandbox.process.executeCommand.mockResolvedValue({ exitCode: 0, result: '' });
    mockSandbox.process.createSession.mockResolvedValue(undefined);
    mockSandbox.process.executeSessionCommand.mockResolvedValue({ cmdId: 'cmd-123' });
    mockSandbox.process.getSessionCommandLogs.mockImplementation(
      async (_sessionId: string, _cmdId: string, onStdout: (chunk: string) => void) => {
        onStdout('');
      },
    );
    mockSandbox.process.getSessionCommand.mockResolvedValue({ id: 'cmd-123', command: '', exitCode: 0 });
    mockSandbox.process.deleteSession.mockResolvedValue(undefined);
    mockSandbox.start.mockResolvedValue(undefined);
    mockSandbox.stop.mockResolvedValue(undefined);
    mockSandbox.delete.mockResolvedValue(undefined);
  };

  class DaytonaError extends Error {
    statusCode?: number;
    constructor(message?: string, statusCode?: number) {
      super(message ?? 'Error');
      this.name = 'DaytonaError';
      this.statusCode = statusCode;
    }
  }

  class DaytonaNotFoundError extends DaytonaError {
    constructor(message?: string) {
      super(message ?? 'Not found', 404);
      this.name = 'DaytonaNotFoundError';
    }
  }

  return { mockSandbox, mockDaytona, resetMockDefaults, DaytonaError, DaytonaNotFoundError };
});

// Mock the Daytona SDK — must use `function` (not arrow) so `new Daytona()` works
vi.mock('@daytonaio/sdk', () => ({
  Daytona: vi.fn().mockImplementation(function () {
    return mockDaytona;
  }),
  DaytonaError,
  DaytonaNotFoundError,
  SandboxState: {
    CREATING: 'creating',
    RESTORING: 'restoring',
    DESTROYED: 'destroyed',
    DESTROYING: 'destroying',
    STARTED: 'started',
    STOPPED: 'stopped',
    STARTING: 'starting',
    STOPPING: 'stopping',
    ERROR: 'error',
    BUILD_FAILED: 'build_failed',
    ARCHIVED: 'archived',
    ARCHIVING: 'archiving',
    RESIZING: 'resizing',
    PULLING_SNAPSHOT: 'pulling_snapshot',
    BUILDING_SNAPSHOT: 'building_snapshot',
  },
}));

describe('DaytonaSandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDefaults();
  });

  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const sandbox1 = new DaytonaSandbox();
      const sandbox2 = new DaytonaSandbox();

      expect(sandbox1.id).toMatch(/^daytona-sandbox-/);
      expect(sandbox2.id).toMatch(/^daytona-sandbox-/);
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('uses provided id', () => {
      const sandbox = new DaytonaSandbox({ id: 'my-sandbox' });

      expect(sandbox.id).toBe('my-sandbox');
    });

    it('default timeout is 5 minutes', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).timeout).toBe(300_000);
    });

    it('has correct provider and name', () => {
      const sandbox = new DaytonaSandbox();

      expect(sandbox.provider).toBe('daytona');
      expect(sandbox.name).toBe('DaytonaSandbox');
    });

    it('default language is typescript', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).language).toBe('typescript');
    });

    it('accepts custom language', () => {
      const sandbox = new DaytonaSandbox({ language: 'python' });

      expect((sandbox as any).language).toBe('python');
    });

    it('stores resources config', () => {
      const sandbox = new DaytonaSandbox({
        resources: { cpu: 2, memory: 4, disk: 6 },
      });

      expect((sandbox as any).resources).toEqual({ cpu: 2, memory: 4, disk: 6 });
    });

    it('stores new options: name, user, public, autoDeleteInterval, networkBlockAll, networkAllowList, image', () => {
      const sandbox = new DaytonaSandbox({
        name: 'my-sandbox',
        user: 'ubuntu',
        public: true,
        autoDeleteInterval: 60,
        networkBlockAll: true,
        networkAllowList: '10.0.0.0/8,192.168.0.0/16',
        image: 'debian:12.9',
      });

      expect((sandbox as any).sandboxName).toBe('my-sandbox');
      expect((sandbox as any).sandboxUser).toBe('ubuntu');
      expect((sandbox as any).sandboxPublic).toBe(true);
      expect((sandbox as any).autoDeleteInterval).toBe(60);
      expect((sandbox as any).networkBlockAll).toBe(true);
      expect((sandbox as any).networkAllowList).toBe('10.0.0.0/8,192.168.0.0/16');
      expect((sandbox as any).image).toBe('debian:12.9');
    });

    it('stores volume configs', () => {
      const sandbox = new DaytonaSandbox({
        volumes: [{ volumeId: 'vol-123', mountPath: '/data' }],
      });

      expect((sandbox as any).volumeConfigs).toEqual([{ volumeId: 'vol-123', mountPath: '/data' }]);
    });

    it('default ephemeral is false', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).ephemeral).toBe(false);
    });

    it('default autoStopInterval is 15', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).autoStopInterval).toBe(15);
    });

    it('stores connection options', () => {
      const sandbox = new DaytonaSandbox({
        apiKey: 'test-key',
        apiUrl: 'https://custom.api.io',
        target: 'us',
      });

      expect((sandbox as any).connectionOpts).toEqual({
        apiKey: 'test-key',
        apiUrl: 'https://custom.api.io',
        target: 'us',
      });
    });
  });

  describe('Start - Race Condition Prevention', () => {
    it('concurrent start() calls only create one sandbox', async () => {
      const sandbox = new DaytonaSandbox();

      // Fire two concurrent starts — only one should create a sandbox
      await Promise.all([sandbox._start(), sandbox._start()]);

      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('start() is idempotent when already running', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      expect(mockDaytona.create).toHaveBeenCalledTimes(1);

      await sandbox._start();
      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('status transitions through starting to running', async () => {
      const sandbox = new DaytonaSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });
  });

  describe('Start - Sandbox Creation', () => {
    it('creates new sandbox with correct params', async () => {
      const sandbox = new DaytonaSandbox({
        language: 'python',
        env: { FOO: 'bar' },
        labels: { team: 'ai' },
        ephemeral: true,
        autoStopInterval: 30,
      });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'python',
          labels: expect.objectContaining({
            team: 'ai',
            'mastra-sandbox-id': sandbox.id,
          }),
          ephemeral: true,
          autoStopInterval: 30,
        }),
      );

      // Env should NOT be passed at creation time — it's merged per-command
      // so that reconnecting to an existing sandbox picks up current env
      expect(mockDaytona.create).toHaveBeenCalledWith(expect.not.objectContaining({ envVars: expect.anything() }));
    });

    it('passes snapshot when provided', async () => {
      const sandbox = new DaytonaSandbox({ snapshot: 'my-snapshot' });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: 'my-snapshot',
        }),
      );
    });

    it('passes volumes when provided', async () => {
      const sandbox = new DaytonaSandbox({
        volumes: [{ volumeId: 'vol-1', mountPath: '/data' }],
      });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          volumes: [{ volumeId: 'vol-1', mountPath: '/data' }],
        }),
      );
    });

    it('passes new params when provided', async () => {
      const sandbox = new DaytonaSandbox({
        name: 'my-sandbox',
        user: 'ubuntu',
        public: true,
        autoDeleteInterval: 60,
        networkBlockAll: true,
        networkAllowList: '10.0.0.0/8',
      });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-sandbox',
          user: 'ubuntu',
          public: true,
          autoDeleteInterval: 60,
          networkBlockAll: true,
          networkAllowList: '10.0.0.0/8',
        }),
      );
    });

    it('does not include undefined params in create call', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();

      const createCall = mockDaytona.create.mock.calls[0]![0];
      expect(createCall).toHaveProperty('name', sandbox.id);
      expect(createCall).not.toHaveProperty('user');
      expect(createCall).not.toHaveProperty('public');
      expect(createCall).not.toHaveProperty('autoDeleteInterval');
      expect(createCall).not.toHaveProperty('networkBlockAll');
      expect(createCall).not.toHaveProperty('networkAllowList');
      expect(createCall).not.toHaveProperty('autoArchiveInterval');
      expect(createCall).not.toHaveProperty('snapshot');
    });

    describe('CreateSandboxFromSnapshotParams vs CreateSandboxFromImageParams', () => {
      it('uses snapshot params by default (no image, no resources)', async () => {
        const sandbox = new DaytonaSandbox();

        await sandbox._start();

        const createCall = mockDaytona.create.mock.calls[0]![0];
        expect(createCall).not.toHaveProperty('image');
        expect(createCall).not.toHaveProperty('resources');
      });

      it('uses image params when image is set without resources', async () => {
        const sandbox = new DaytonaSandbox({ image: 'debian:12.9' });

        await sandbox._start();

        const createCall = mockDaytona.create.mock.calls[0]![0];
        expect(createCall).toHaveProperty('image', 'debian:12.9');
        expect(createCall).not.toHaveProperty('resources');
        expect(createCall).not.toHaveProperty('snapshot');
      });

      it('uses image params when both image and resources are set', async () => {
        const sandbox = new DaytonaSandbox({
          image: 'debian:12.9',
          resources: { cpu: 4, memory: 8 },
        });

        await sandbox._start();

        const createCall = mockDaytona.create.mock.calls[0]![0];
        expect(createCall).toHaveProperty('image', 'debian:12.9');
        expect(createCall).toHaveProperty('resources', { cpu: 4, memory: 8 });
        expect(createCall).not.toHaveProperty('snapshot');
      });

      it('snapshot takes precedence over image + resources', async () => {
        const sandbox = new DaytonaSandbox({
          snapshot: 'my-snapshot',
          image: 'debian:12.9',
          resources: { cpu: 4, memory: 8 },
        });

        await sandbox._start();

        const createCall = mockDaytona.create.mock.calls[0]![0];
        expect(createCall).toHaveProperty('snapshot', 'my-snapshot');
        expect(createCall).not.toHaveProperty('image');
        expect(createCall).not.toHaveProperty('resources');
      });

      it('falls back to snapshot params when resources set without image', async () => {
        const sandbox = new DaytonaSandbox({ resources: { cpu: 4, memory: 8 } });

        await sandbox._start();

        const createCall = mockDaytona.create.mock.calls[0]![0];
        expect(createCall).not.toHaveProperty('image');
        expect(createCall).not.toHaveProperty('resources');
      });
    });

    it('passes autoArchiveInterval when provided', async () => {
      const sandbox = new DaytonaSandbox({ autoArchiveInterval: 60 });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          autoArchiveInterval: 60,
        }),
      );
    });

    it('creates Daytona client with connection opts', async () => {
      const { Daytona } = await import('@daytonaio/sdk');
      const sandbox = new DaytonaSandbox({
        apiKey: 'key-123',
        apiUrl: 'https://custom.api',
        target: 'eu',
      });

      await sandbox._start();

      expect(Daytona).toHaveBeenCalledWith({
        apiKey: 'key-123',
        apiUrl: 'https://custom.api',
        target: 'eu',
      });
    });
  });

  describe('Start - Reconnection', () => {
    it('reconnects to existing sandbox via stored Daytona ID on stop→start cycle', async () => {
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await sandbox._start();
      await sandbox._stop();

      mockDaytona.get.mockResolvedValue({ ...mockSandbox, state: 'started' });
      await sandbox._start();

      expect(mockDaytona.get).toHaveBeenCalledWith('mock-sandbox-id');
      expect(mockDaytona.create).toHaveBeenCalledTimes(1); // only on initial start
    });

    it('creates a fresh sandbox when no existing sandbox is found by name', async () => {
      // get() throws DaytonaNotFoundError → no existing sandbox → create fresh
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await sandbox._start();

      expect(mockDaytona.get).toHaveBeenCalledWith('my-id'); // falls back to sandboxName
      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('propagates non-404 get() errors instead of creating a duplicate sandbox', async () => {
      const serverError = new DaytonaError('Internal Server Error');
      (serverError as any).statusCode = 500;
      mockDaytona.get.mockRejectedValue(serverError);
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await expect(sandbox._start()).rejects.toThrow('Internal Server Error');
      expect(mockDaytona.create).not.toHaveBeenCalled();
    });

    it('restarts a stopped sandbox on stop→start cycle without calling create', async () => {
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await sandbox._start();
      await sandbox._stop();

      mockDaytona.get.mockResolvedValue({ ...mockSandbox, state: 'stopped' });
      await sandbox._start();

      expect(mockDaytona.start).toHaveBeenCalledTimes(1);
      expect(mockDaytona.create).toHaveBeenCalledTimes(1); // only on initial start
    });

    it('restarts an archived sandbox on stop→start cycle without calling create', async () => {
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await sandbox._start();
      await sandbox._stop();

      mockDaytona.get.mockResolvedValue({ ...mockSandbox, state: 'archived' });
      await sandbox._start();

      expect(mockDaytona.start).toHaveBeenCalledTimes(1);
      expect(mockDaytona.create).toHaveBeenCalledTimes(1); // only on initial start
    });

    it('creates fresh sandbox when get() finds a dead sandbox on stop→start cycle', async () => {
      for (const state of ['destroyed', 'destroying', 'error', 'build_failed']) {
        vi.clearAllMocks();
        resetMockDefaults();
        const sandbox = new DaytonaSandbox({ id: 'my-id' });

        await sandbox._start();
        await sandbox._stop();

        mockDaytona.get.mockResolvedValue({ ...mockSandbox, state });
        await sandbox._start();

        expect(mockDaytona.create).toHaveBeenCalledTimes(2); // initial + after dead
      }
    });

    it('creates fresh sandbox when no existing sandbox is found', async () => {
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('uses createdAt from existing sandbox on reconnect', async () => {
      const createdAt = '2024-01-15T10:00:00.000Z';
      const sandbox = new DaytonaSandbox({ id: 'my-id' });

      await sandbox._start();
      await sandbox._stop();

      mockDaytona.get.mockResolvedValue({ ...mockSandbox, state: 'started', createdAt });
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.createdAt).toEqual(new Date(createdAt));
    });
  });

  describe('Environment Variables', () => {
    it('merges sandbox env with per-command env', async () => {
      const sandbox = new DaytonaSandbox({
        env: { BASE: 'value', OVERRIDE: 'original' },
      });

      await sandbox._start();
      await sandbox.executeCommand('echo', ['test'], { env: { OVERRIDE: 'new', EXTRA: 'added' } });

      const cmd: string = mockSandbox.process.executeSessionCommand.mock.calls[0]![1].command;
      expect(cmd).toContain('export BASE=value');
      expect(cmd).toContain('export OVERRIDE=new');
      expect(cmd).toContain('export EXTRA=added');
      // Command is wrapped in subshell — args joined by base class auto-generated executeCommand
      expect(cmd).toMatch(/\(echo.*test.*\)/);
    });

    it('per-command env overrides sandbox env', async () => {
      const sandbox = new DaytonaSandbox({
        env: { KEY: 'sandbox-value' },
      });

      await sandbox._start();
      await sandbox.executeCommand('echo', [], { env: { KEY: 'command-value' } });

      const cmd: string = mockSandbox.process.executeSessionCommand.mock.calls[0]![1].command;
      expect(cmd).toContain('export KEY=command-value');
      expect(cmd).not.toContain('sandbox-value');
    });

    it('filters out undefined env values', async () => {
      const sandbox = new DaytonaSandbox({
        env: { KEEP: 'yes' },
      });

      await sandbox._start();
      await sandbox.executeCommand('echo', [], { env: { KEEP: 'yes', REMOVE: undefined } as any });

      const cmd: string = mockSandbox.process.executeSessionCommand.mock.calls[0]![1].command;
      expect(cmd).toContain('export KEEP=yes');
      expect(cmd).not.toContain('REMOVE');
    });
  });

  describe('Mount Configuration', () => {
    it('S3 prefix mount uses bucket:/prefix syntax in mount command', async () => {
      mockSandbox.process.executeCommand.mockImplementation(async (command: string) => {
        if (command.includes('mountpoint -q') && command.includes('echo "mounted"')) {
          return { exitCode: 0, result: 'not mounted' };
        }
        if (command.includes('echo "non-empty" || echo "ok"')) {
          return { exitCode: 0, result: 'ok' };
        }
        if (command.includes('sudo mkdir -p')) {
          return { exitCode: 0, result: '' };
        }
        if (command.includes('which s3fs')) {
          return { exitCode: 0, result: '/usr/bin/s3fs' };
        }
        if (command.includes('id -u && id -g')) {
          return { exitCode: 0, result: '1000\n1000' };
        }
        if (command.includes('chmod a+rw /dev/fuse')) {
          return { exitCode: 0, result: '' };
        }
        if (command.includes('s3fs') && command.includes('/data/s3-prefix')) {
          return { exitCode: 0, result: '' };
        }
        if (command.includes('mkdir -p /tmp/.mastra-mounts')) {
          return { exitCode: 0, result: '' };
        }
        return { exitCode: 0, result: '' };
      });

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-s3-prefix',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          prefix: 'workspace/data/',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/s3-prefix');

      const mountCall = mockSandbox.process.executeCommand.mock.calls.find((call: any[]) => {
        const command = call[0] || '';
        return command.includes('s3fs') && command.includes('/data/s3-prefix') && !command.includes('which s3fs');
      });

      expect(mountCall).toBeDefined();
      if (mountCall) {
        expect(mountCall[0]).toContain('test-bucket:/workspace/data');
        expect(mountCall[0]).not.toContain('test-bucket:/workspace/data/');
      }
    });
  });

  describe('Azure Blob Mount Configuration', () => {
    const setupAzureMocks = () => {
      mockSandbox.process.executeCommand.mockImplementation(async (command: string) => {
        if (command.includes('which blobfuse2')) {
          return { exitCode: 0, result: '/usr/bin/blobfuse2' };
        }
        if (command.includes('id -u && id -g')) {
          return { exitCode: 0, result: '1000\n1000' };
        }
        if (command.includes('curl') && command.includes('blob.core.windows.net')) {
          return { exitCode: 0, result: '' };
        }
        return { exitCode: 0, result: '' };
      });
    };

    const findBlobfuseMountCall = (target: string) =>
      mockSandbox.process.executeCommand.mock.calls.find((call: any[]) => {
        const command = call[0] || '';
        return command.includes('blobfuse2 mount') && command.includes(target) && !command.includes('which blobfuse2');
      });

    const findWrittenConfig = (): string | undefined => {
      const upload = mockSandbox.fs.uploadFile.mock.calls.find((call: any[]) =>
        String(call[1]).includes('.blobfuse2-config'),
      );
      return upload ? Buffer.from(upload[0]).toString('utf-8') : undefined;
    };

    it('account-key auth writes mode: key with account-name, account-key, container', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-key',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'test-container',
          accountName: 'mystorage',
          accountKey: 'a-secret-key',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-key');

      const mountCall = findBlobfuseMountCall('/data/azure-key');
      expect(mountCall).toBeDefined();
      expect(mountCall![0]).toContain('--config-file=');

      const yaml = findWrittenConfig();
      expect(yaml).toBeDefined();
      expect(yaml).toContain('mode: key');
      expect(yaml).toContain('account-name: "mystorage"');
      expect(yaml).toContain('account-key: "a-secret-key"');
      expect(yaml).toContain('container: "test-container"');
      expect(yaml).toContain('read-only: false');
      expect(yaml).not.toContain('  type: block');
    });

    it('SAS token auth writes mode: sas with sas field (no account-key)', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-sas',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'sas-container',
          accountName: 'mystorage',
          sasToken: 'sv=2022-11-02&ss=b&srt=co&sp=rl&se=2030-01-01T00:00:00Z&sig=xyz',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-sas');

      const yaml = findWrittenConfig();
      expect(yaml).toBeDefined();
      expect(yaml).toContain('mode: sas');
      expect(yaml).toContain('sas: ');
      expect(yaml).not.toContain('account-key:');
    });

    it('useDefaultCredential writes mode: msi (no key, no sas)', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-msi',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'msi-container',
          accountName: 'mystorage',
          useDefaultCredential: true,
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-msi');

      const yaml = findWrittenConfig();
      expect(yaml).toBeDefined();
      expect(yaml).toContain('mode: msi');
      expect(yaml).not.toContain('account-key:');
      expect(yaml).not.toContain('sas:');
    });

    it('connection string is parsed for AccountName, AccountKey, BlobEndpoint', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-cs',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'cs-container',
          connectionString:
            'DefaultEndpointsProtocol=https;AccountName=fromstring;AccountKey=keyvalue;BlobEndpoint=https://fromstring.blob.core.windows.net/;EndpointSuffix=core.windows.net',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-cs');

      const yaml = findWrittenConfig();
      expect(yaml).toBeDefined();
      expect(yaml).toContain('mode: key');
      expect(yaml).toContain('account-name: "fromstring"');
      expect(yaml).toContain('account-key: "keyvalue"');
      expect(yaml).toContain('endpoint: "https://fromstring.blob.core.windows.net"');
    });

    it('connection string synthesizes endpoint from EndpointSuffix when BlobEndpoint is omitted', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-cs-suffix',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'cs-container',
          connectionString:
            'DefaultEndpointsProtocol=https;AccountName=fromstring;AccountKey=keyvalue;EndpointSuffix=core.usgovcloudapi.net',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-cs-suffix');

      const yaml = findWrittenConfig();
      expect(yaml).toBeDefined();
      expect(yaml).toContain('endpoint: "https://fromstring.blob.core.usgovcloudapi.net"');
    });

    it('readOnly writes read-only: true in config', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-ro',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'ro-container',
          accountName: 'mystorage',
          accountKey: 'k',
          readOnly: true,
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-ro');

      const yaml = findWrittenConfig();
      expect(yaml).toBeDefined();
      expect(yaml).toContain('read-only: true');
    });

    it('prefix mount uses blobfuse2 subdirectory flag', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-prefix',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'prefix-container',
          accountName: 'mystorage',
          accountKey: 'k',
          prefix: '/workspace/data/',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/azure-prefix');

      const mountCall = findBlobfuseMountCall('/data/azure-prefix');
      expect(mountCall).toBeDefined();
      expect(mountCall![0]).toContain('--virtual-directory=true');
      expect(mountCall![0]).toContain('--subdirectory=workspace/data');
    });

    it('missing credentials produces a clear error', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-nocreds',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'no-creds',
          accountName: 'mystorage',
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/azure-nocreds');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/credentials/i);
    });

    it('invalid container name is rejected before any mount command', async () => {
      setupAzureMocks();
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-azure-bad-name',
        name: 'AzureBlobFilesystem',
        provider: 'azure-blob',
        status: 'ready',
        getMountConfig: () => ({
          type: 'azure-blob',
          container: 'Bad_Name',
          accountName: 'mystorage',
          accountKey: 'k',
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/azure-bad');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid Azure container name/i);
      expect(findBlobfuseMountCall('/data/azure-bad')).toBeUndefined();
    });
  });

  describe('Stop & Destroy', () => {
    it('stop calls daytona.stop()', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._stop();

      expect(mockDaytona.stop).toHaveBeenCalledWith(mockSandbox);
      expect(sandbox.status).toBe('stopped');
    });

    it('destroy calls daytona.delete()', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._destroy();

      expect(mockDaytona.delete).toHaveBeenCalledWith(mockSandbox);
      expect(sandbox.status).toBe('destroyed');
    });

    it('destroy clears internal state', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._destroy();

      expect((sandbox as any)._sandbox).toBeNull();
      expect((sandbox as any)._daytona).toBeNull();
    });

    it('stop handles errors gracefully', async () => {
      mockDaytona.stop.mockRejectedValue(new Error('Already stopped'));
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      // Should not throw
      await sandbox._stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('destroy handles errors gracefully', async () => {
      mockDaytona.delete.mockRejectedValue(new Error('Already deleted'));
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._destroy();

      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('getInfo()', () => {
    it('returns correct sandbox info', async () => {
      mockSandbox.cpu = 4;
      mockSandbox.memory = 8;
      mockSandbox.disk = 50;

      const sandbox = new DaytonaSandbox({ id: 'test-info', language: 'python' });

      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.id).toBe('test-info');
      expect(info.name).toBe('DaytonaSandbox');
      expect(info.provider).toBe('daytona');
      expect(info.status).toBe('running');
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.resources).toEqual({ cpuCores: 4, memoryMB: 8 * 1024, diskMB: 50 * 1024 });
      expect(info.metadata).toEqual(
        expect.objectContaining({
          language: 'python',
          ephemeral: false,
          target: 'us',
        }),
      );
    });

    it('resources reflect actual sandbox values not constructor options', async () => {
      mockSandbox.cpu = 8;
      mockSandbox.memory = 16;
      mockSandbox.disk = 100;

      const sandbox = new DaytonaSandbox({ image: 'debian:12.9', resources: { cpu: 2, memory: 4 } });
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.resources).toEqual({ cpuCores: 8, memoryMB: 16 * 1024, diskMB: 100 * 1024 });
    });

    it('resources absent when sandbox not started', async () => {
      const sandbox = new DaytonaSandbox();
      const info = await sandbox.getInfo();

      expect(info.resources).toBeUndefined();
    });

    it('includes image in metadata when set', async () => {
      const sandbox = new DaytonaSandbox({ image: 'debian:12.9' });
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.metadata?.image).toBe('debian:12.9');
    });

    it('excludes image from metadata when not set', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.metadata).not.toHaveProperty('image');
    });

    it('includes target from actual sandbox after start', async () => {
      mockSandbox.target = 'eu';
      const sandbox = new DaytonaSandbox();
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.metadata?.target).toBe('eu');
    });

    it('excludes target from metadata before start', async () => {
      const sandbox = new DaytonaSandbox();
      const info = await sandbox.getInfo();

      expect(info.metadata).not.toHaveProperty('target');
    });

    it('includes snapshot in metadata when set', async () => {
      const sandbox = new DaytonaSandbox({ snapshot: 'snap-123' });

      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.metadata?.snapshot).toBe('snap-123');
    });
  });

  describe('getInstructions()', () => {
    it('returns description string', () => {
      const sandbox = new DaytonaSandbox();
      const instructions = sandbox.getInstructions();

      expect(typeof instructions).toBe('string');
      expect(instructions).toContain('Cloud sandbox');
    });

    it('includes command timeout in seconds', () => {
      const sandbox = new DaytonaSandbox({ timeout: 60_000 });
      expect(sandbox.getInstructions()).toContain('60s');
    });

    it('always includes language runtime', () => {
      expect(new DaytonaSandbox({ language: 'typescript' }).getInstructions()).toContain('typescript');
      expect(new DaytonaSandbox({ language: 'python' }).getInstructions()).toContain('python');
      expect(new DaytonaSandbox({ language: 'javascript' }).getInstructions()).toContain('javascript');
    });

    it('includes custom user when set', () => {
      const sandbox = new DaytonaSandbox({ user: 'ubuntu' });
      expect(sandbox.getInstructions()).toContain('ubuntu');
    });

    it('defaults to daytona user when not set', () => {
      const sandbox = new DaytonaSandbox();
      expect(sandbox.getInstructions()).toContain('Running as user: daytona');
    });

    it('includes volume count when volumes attached', () => {
      const sandbox = new DaytonaSandbox({
        volumes: [
          { volumeId: 'v1', mountPath: '/a' },
          { volumeId: 'v2', mountPath: '/b' },
        ],
      });
      expect(sandbox.getInstructions()).toContain('2 volume(s)');
    });

    it('includes network blocked notice when networkBlockAll is set', () => {
      const sandbox = new DaytonaSandbox({ networkBlockAll: true });
      expect(sandbox.getInstructions()).toContain('Network access is blocked');
    });

    it('does not include network notice when networkBlockAll is not set', () => {
      const sandbox = new DaytonaSandbox();
      expect(sandbox.getInstructions()).not.toContain('Network access is blocked');
    });

    it('includes working directory when detected', () => {
      const sandbox = new DaytonaSandbox();
      (sandbox as any)._workingDir = '/home/daytona';
      expect(sandbox.getInstructions()).toContain('Default working directory: /home/daytona');
    });

    it('omits working directory when not yet detected', () => {
      const sandbox = new DaytonaSandbox();
      expect(sandbox.getInstructions()).not.toContain('working directory');
    });
  });

  describe('isReady()', () => {
    it('returns false when not started', async () => {
      const sandbox = new DaytonaSandbox();

      expect(await sandbox.isReady()).toBe(false);
    });

    it('returns true when running', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();

      expect(await sandbox.isReady()).toBe(true);
    });

    it('returns false after stop', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._stop();

      expect(await sandbox.isReady()).toBe(false);
    });
  });

  describe('daytona accessor', () => {
    it('throws SandboxNotReadyError when not started', () => {
      const sandbox = new DaytonaSandbox();

      expect(() => sandbox.daytona).toThrow(SandboxNotReadyError);
    });

    it('returns sandbox when started', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();

      expect(sandbox.daytona).toBe(mockSandbox);
    });

    it('deprecated instance getter delegates to daytona', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();

      expect(sandbox.instance).toBe(sandbox.daytona);
    });
  });

  describe('Command Execution (via ProcessManager)', () => {
    it('executes command and returns result', async () => {
      mockSandbox.process.getSessionCommandLogs.mockImplementationOnce(
        async (_sessionId: string, _cmdId: string, onStdout: (chunk: string) => void) => {
          onStdout('hello world');
        },
      );

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('echo', ['hello', 'world']);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello world');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('handles non-zero exit code', async () => {
      mockSandbox.process.getSessionCommand.mockResolvedValueOnce({ id: 'cmd-123', command: '', exitCode: 1 });

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('false');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('captures stderr separately', async () => {
      mockSandbox.process.getSessionCommandLogs.mockImplementationOnce(
        async (
          _sessionId: string,
          _cmdId: string,
          _onStdout: (chunk: string) => void,
          onStderr: (chunk: string) => void,
        ) => {
          onStderr('error message');
        },
      );
      mockSandbox.process.getSessionCommand.mockResolvedValueOnce({ id: 'cmd-123', command: '', exitCode: 1 });

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('sh', ['-c', 'echo error message >&2; exit 1']);

      expect(result.stderr).toContain('error message');
      expect(result.stdout).toBe('');
    });

    it('passes working directory via baked-in cd', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      await sandbox.executeCommand('ls', [], { cwd: '/tmp' });

      // Command is wrapped in subshell: cd /tmp && (ls)
      const calledCommand = mockSandbox.process.executeSessionCommand.mock.calls[0]![1].command;
      expect(calledCommand).toContain('cd');
      expect(calledCommand).toContain('/tmp');
      expect(calledCommand).toContain('(ls)');
    });

    it('enforces timeout via Promise.race', async () => {
      const sandbox = new DaytonaSandbox({ timeout: 100 });
      await sandbox._start();

      // Simulate a command that never finishes
      mockSandbox.process.getSessionCommandLogs.mockImplementationOnce(
        () => new Promise(() => {}), // never resolves
      );

      const result = await sandbox.executeCommand('sleep', ['9999']);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('timed out');
    });

    it('wraps command in subshell', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      await sandbox.executeCommand('echo test');

      const calledCommand = mockSandbox.process.executeSessionCommand.mock.calls[0]![1].command;
      expect(calledCommand).toBe('(echo test)');
    });

    it('streams stdout and stderr chunks to callbacks', async () => {
      mockSandbox.process.getSessionCommandLogs.mockImplementationOnce(
        async (
          _sessionId: string,
          _cmdId: string,
          onStdout: (chunk: string) => void,
          onStderr: (chunk: string) => void,
        ) => {
          onStdout('chunk1');
          onStdout('chunk2');
          onStderr('err1');
        },
      );

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      const result = await sandbox.executeCommand('echo', ['test'], {
        onStdout: c => stdoutChunks.push(c),
        onStderr: c => stderrChunks.push(c),
      });

      expect(stdoutChunks).toEqual(['chunk1', 'chunk2']);
      expect(stderrChunks).toEqual(['err1']);
      expect(result.stdout).toBe('chunk1chunk2');
      expect(result.stderr).toBe('err1');
    });

    it('auto-starts sandbox if not running', async () => {
      const sandbox = new DaytonaSandbox();

      // executeCommand should trigger start via ProcessManager
      await sandbox.executeCommand('echo', ['test']);

      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('has process manager available', () => {
      const sandbox = new DaytonaSandbox();

      expect(sandbox.processes).toBeDefined();
    });
  });

  describe('Error Handling & Retry', () => {
    it('retries once on sandbox-dead error via retryOnDead', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      // First createSession: sandbox dead
      mockSandbox.process.createSession.mockRejectedValueOnce(new Error('sandbox was not found'));
      // Retry: stream 'success' via getSessionCommandLogs
      mockSandbox.process.getSessionCommandLogs.mockImplementationOnce(
        async (_sessionId: string, _cmdId: string, onStdout: (chunk: string) => void) => {
          onStdout('success');
        },
      );

      const result = await sandbox.executeCommand('echo', ['test']);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('success');
      // create called twice: initial _start + retry's ensureRunning
      expect(mockDaytona.create).toHaveBeenCalledTimes(2);
    });

    it('does not retry infinitely', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      // Both calls fail with sandbox dead
      mockSandbox.process.createSession.mockRejectedValue(new Error('sandbox was not found'));

      await expect(sandbox.executeCommand('echo', ['test'])).rejects.toThrow('sandbox was not found');
    });

    it('does not retry on regular execution errors', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      mockSandbox.process.createSession.mockRejectedValue(new Error('command failed'));

      await expect(sandbox.executeCommand('bad-command')).rejects.toThrow('command failed');
      expect(mockDaytona.create).toHaveBeenCalledTimes(1); // No retry
    });

    it('isSandboxDeadError detects known patterns', () => {
      const sandbox = new DaytonaSandbox();

      // SDK error class (preferred detection)
      expect((sandbox as any).isSandboxDeadError(new DaytonaNotFoundError('gone'))).toBe(true);
      // Regex matches (case-insensitive)
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox is not running'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox is not running'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox already destroyed'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('SANDBOX ALREADY DESTROYED'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox was not found'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox not found'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox abc not found'))).toBe(true);
      // Non-dead errors
      expect((sandbox as any).isSandboxDeadError(new Error('timeout'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(new Error('command failed'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(null)).toBe(false);
    });

    it('handleSandboxTimeout clears state', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      (sandbox as any).handleSandboxTimeout();

      expect((sandbox as any)._sandbox).toBeNull();
      expect(sandbox.status).toBe('stopped');
    });
  });

  describe('Shared Conformance', () => {
    let conformanceSandbox: DaytonaSandbox;

    beforeAll(async () => {
      conformanceSandbox = new DaytonaSandbox({ id: `conformance-${Date.now()}` });
      await conformanceSandbox._start();
    });

    afterAll(async () => {
      if (conformanceSandbox) await conformanceSandbox._destroy();
    });

    const getContext = () => ({
      sandbox: conformanceSandbox as any,
      capabilities: {
        supportsMounting: true,
        supportsReconnection: true,
        supportsConcurrency: true,
        supportsEnvVars: true,
        supportsWorkingDirectory: true,
        supportsTimeout: true,
        defaultCommandTimeout: 300000,
        supportsStreaming: true,
        supportsStdin: true,
      },
      testTimeout: 30000,
      fastOnly: true,
      createSandbox: () => new DaytonaSandbox(),
    });

    createSandboxLifecycleTests(getContext);
    createMountOperationsTests(getContext);
  });
});
