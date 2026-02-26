/**
 * Blaxel Sandbox Provider Tests
 *
 * Tests Blaxel-specific functionality including:
 * - Constructor options and ID generation
 * - Race condition prevention in start()
 * - Environment variable handling
 * - Mount operations (S3, GCS)
 * - Marker file handling
 * - Mount reconciliation
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { createSandboxLifecycleTests, createMountOperationsTests } from '@internal/workspace-test-utils';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

import { BlaxelSandbox } from './index';

// Use vi.hoisted to define the mock before vi.mock is hoisted
const { mockSandbox, resetMockDefaults } = vi.hoisted(() => {
  const mockProcessExec = vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: '',
    stderr: '',
    pid: '1234',
    status: 'completed',
    command: '',
    logs: '',
    name: '',
    startedAt: '',
    completedAt: '',
    workingDir: '',
  });

  const mockFsWrite = vi.fn().mockResolvedValue(undefined);
  const mockFsRead = vi.fn().mockResolvedValue('');
  const mockFsLs = vi.fn().mockResolvedValue({ files: [], subdirectories: [] });
  const mockDelete = vi.fn().mockResolvedValue(undefined);

  const mockSandbox = {
    metadata: { name: 'test-sandbox' },
    status: 'RUNNING',
    spec: {},
    process: {
      exec: mockProcessExec,
    },
    fs: {
      write: mockFsWrite,
      read: mockFsRead,
      ls: mockFsLs,
    },
    delete: mockDelete,
  };

  const resetMockDefaults = () => {
    mockProcessExec.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      pid: '1234',
      status: 'completed',
      command: '',
      logs: '',
      name: '',
      startedAt: '',
      completedAt: '',
      workingDir: '',
    });
    mockFsWrite.mockResolvedValue(undefined);
    mockFsRead.mockResolvedValue('');
    mockFsLs.mockResolvedValue({ files: [], subdirectories: [] });
    mockDelete.mockResolvedValue(undefined);
  };

  return { mockSandbox, resetMockDefaults };
});

// Mock the @blaxel/core SDK
vi.mock('@blaxel/core', () => ({
  SandboxInstance: {
    create: vi.fn().mockResolvedValue(mockSandbox),
    get: vi.fn().mockRejectedValue(new Error('not found')),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    createIfNotExists: vi.fn().mockResolvedValue(mockSandbox),
  },
}));

describe('BlaxelSandbox', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    // Reset SandboxInstance mock defaults
    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const sandbox1 = new BlaxelSandbox();
      const sandbox2 = new BlaxelSandbox();

      expect(sandbox1.id).toMatch(/^blaxel-sandbox-/);
      expect(sandbox2.id).toMatch(/^blaxel-sandbox-/);
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('uses provided id', () => {
      const sandbox = new BlaxelSandbox({ id: 'my-sandbox' });

      expect(sandbox.id).toBe('my-sandbox');
    });

    it('has correct provider and name', () => {
      const sandbox = new BlaxelSandbox();

      expect(sandbox.provider).toBe('blaxel');
      expect(sandbox.name).toBe('BlaxelSandbox');
    });

    it('uses default image and memory', () => {
      const sandbox = new BlaxelSandbox();

      expect((sandbox as any).image).toBe('blaxel/ts-app:latest');
      expect((sandbox as any).memory).toBe(4096);
    });

    it('accepts custom image and memory', () => {
      const sandbox = new BlaxelSandbox({ image: 'custom:latest', memory: 8192 });

      expect((sandbox as any).image).toBe('custom:latest');
      expect((sandbox as any).memory).toBe(8192);
    });
  });

  describe('Start - Race Condition Prevention', () => {
    it('concurrent start() calls return same promise', async () => {
      const { SandboxInstance } = await import('@blaxel/core');
      const sandbox = new BlaxelSandbox();

      // Start two concurrent calls
      const promise1 = sandbox._start();
      const promise2 = sandbox._start();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both promises should resolve to the same value (void)
      expect(result1).toBe(result2);

      // create should only be called once
      expect(SandboxInstance.create).toHaveBeenCalledTimes(1);
    });

    it('start() is idempotent when already running', async () => {
      const { SandboxInstance } = await import('@blaxel/core');
      const sandbox = new BlaxelSandbox();

      await sandbox._start();
      expect(SandboxInstance.create).toHaveBeenCalledTimes(1);

      // Second start should not create another sandbox
      await sandbox._start();
      expect(SandboxInstance.create).toHaveBeenCalledTimes(1);
    });

    it('status transitions through starting to running', async () => {
      const sandbox = new BlaxelSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });
  });

  describe('Start - Sandbox Creation', () => {
    it('creates new sandbox if none exists', async () => {
      const { SandboxInstance } = await import('@blaxel/core');
      const sandbox = new BlaxelSandbox();

      await sandbox._start();

      expect(SandboxInstance.create).toHaveBeenCalled();
    });

    it('stores mastra-sandbox-id in labels', async () => {
      const { SandboxInstance } = await import('@blaxel/core');
      const sandbox = new BlaxelSandbox({ id: 'test-id' });

      await sandbox._start();

      expect(SandboxInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.objectContaining({
            'mastra-sandbox-id': 'test-id',
          }),
        }),
      );
    });

    it('reconnects to existing sandbox by name', async () => {
      const { SandboxInstance } = await import('@blaxel/core');

      // Mock finding existing sandbox
      (SandboxInstance.get as any).mockResolvedValue({
        ...mockSandbox,
        status: 'DEPLOYED',
      });

      const sandbox = new BlaxelSandbox({ id: 'existing-id' });
      await sandbox._start();

      expect(SandboxInstance.get).toHaveBeenCalledWith('existing-id');
      // Should NOT create a new sandbox
      expect(SandboxInstance.create).not.toHaveBeenCalled();
    });

    it('creates new sandbox if existing one is TERMINATED', async () => {
      const { SandboxInstance } = await import('@blaxel/core');

      // Mock finding terminated sandbox
      (SandboxInstance.get as any).mockResolvedValue({
        ...mockSandbox,
        status: 'TERMINATED',
      });

      const sandbox = new BlaxelSandbox({ id: 'terminated-id' });
      await sandbox._start();

      // Should create a new one since existing is terminated
      expect(SandboxInstance.create).toHaveBeenCalled();
    });
  });

  describe('Start - Mount Processing', () => {
    it('processes pending mounts after start', async () => {
      const sandbox = new BlaxelSandbox();

      // Add a mock filesystem before starting
      const mockFilesystem = {
        id: 'test-fs',
        name: 'TestFS',
        provider: 'test',
        status: 'ready',
        getMountConfig: () => ({ type: 's3', bucket: 'test' }),
      } as any;

      sandbox.mounts.add({ '/data': mockFilesystem });

      expect(sandbox.mounts.get('/data')?.state).toBe('pending');

      await sandbox._start();

      // After start, mount should be processed and state should be 'mounted' or 'error'
      const entry = sandbox.mounts.get('/data');
      expect(entry?.state).not.toBe('pending');
      expect(['mounted', 'error', 'unsupported']).toContain(entry?.state);
    });
  });

  describe('Environment Variables', () => {
    it('env vars are not baked into sandbox creation (applied per-command instead)', async () => {
      const { SandboxInstance } = await import('@blaxel/core');
      const sandbox = new BlaxelSandbox({ env: { KEY: 'value' } });

      await sandbox._start();

      // Env should NOT be passed at creation time — it's merged per-command
      // so that reconnecting to an existing sandbox picks up current env
      expect(SandboxInstance.create).toHaveBeenCalledWith(expect.not.objectContaining({ envs: expect.anything() }));
    });

    it('env vars merged and passed per-command', async () => {
      const sandbox = new BlaxelSandbox({ env: { A: '1', B: '2' } });
      await sandbox._start();

      await sandbox.executeCommand('echo', ['test'], { env: { B: '3', C: '4' } });

      expect(mockSandbox.process.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          env: expect.objectContaining({ A: '1', B: '3', C: '4' }),
        }),
      );
    });
  });

  describe('Stop/Destroy', () => {
    it('destroy deletes sandbox', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      await sandbox._destroy();

      expect(mockSandbox.delete).toHaveBeenCalled();
      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('getInfo()', () => {
    it('returns SandboxInfo with all fields', async () => {
      const sandbox = new BlaxelSandbox({ id: 'test-id' });
      await sandbox._start();

      const info = await sandbox.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.name).toBe('BlaxelSandbox');
      expect(info.provider).toBe('blaxel');
      expect(info.status).toBe('running');
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.mounts).toBeDefined();
    });
  });

  describe('getInstructions()', () => {
    it('returns description of sandbox environment', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      const instructions = sandbox.getInstructions();

      expect(instructions).toContain('sandbox');
    });
  });

  describe('isReady()', () => {
    it('returns false when stopped', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();
      await sandbox._stop();

      const ready = await sandbox.isReady();

      expect(ready).toBe(false);
    });
  });

  describe('instance accessor', () => {
    it('throws SandboxNotReadyError if not started', () => {
      const sandbox = new BlaxelSandbox();

      expect(() => sandbox.instance).toThrow();
    });

    it('returns Blaxel SandboxInstance when started', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      const instance = sandbox.instance;

      expect(instance).toBe(mockSandbox);
    });
  });

  describe('Command Execution', () => {
    it('executes command and returns result', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      // Set mock after start() to isolate from startup operations
      mockSandbox.process.exec.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'hello\n',
        stderr: '',
        pid: '1234',
        status: 'completed',
        command: 'echo hello',
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      });

      const result = await sandbox.executeCommand('echo', ['hello']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
      expect(result.success).toBe(true);
    });

    it('captures stderr', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      // Set mock after start() to isolate from startup operations
      mockSandbox.process.exec.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'error message',
        pid: '1234',
        status: 'completed',
        command: '',
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      });

      const result = await sandbox.executeCommand('sh', ['-c', 'echo error >&2']);

      expect(result.stderr).toContain('error message');
    });

    it('returns non-zero exit code for failing command', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      // Set mock after start() to isolate from startup operations
      mockSandbox.process.exec.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: '',
        pid: '1234',
        status: 'completed',
        command: '',
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      });

      const result = await sandbox.executeCommand('exit', ['1']);

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
    });

    it('respects cwd option', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      await sandbox.executeCommand('pwd', [], { cwd: '/tmp' });

      expect(mockSandbox.process.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDir: '/tmp',
        }),
      );
    });

    it('respects timeout option', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      await sandbox.executeCommand('sleep', ['10'], { timeout: 5000 });

      expect(mockSandbox.process.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5, // converted from ms to seconds
        }),
      );
    });

    it('enforces client-side timeout when server does not', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      // Set mock after start() to isolate from startup operations
      // Simulate a command that never completes (server timeout not enforced)
      mockSandbox.process.exec.mockImplementation(() => new Promise(() => {}));

      const result = await sandbox.executeCommand('sleep', ['600'], { timeout: 100 });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('timed out');
    });
  });
});

/**
 * Mount-related tests (unit tests with mocks)
 */
describe('BlaxelSandbox Mounting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));

    mockSandbox.process.exec.mockResolvedValue({
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      pid: '1234',
      status: 'completed',
      command: '',
      logs: '',
      name: '',
      startedAt: '',
      completedAt: '',
      workingDir: '',
    });
  });

  describe('Marker File Helpers', () => {
    it('markerFilename generates consistent filename', () => {
      const sandbox = new BlaxelSandbox();

      const filename1 = sandbox.mounts.markerFilename('/data/bucket');
      const filename2 = sandbox.mounts.markerFilename('/data/bucket');

      expect(filename1).toBe(filename2);
      expect(filename1).toMatch(/^mount-[a-z0-9]+$/);
    });

    it('markerFilename differs for different paths', () => {
      const sandbox = new BlaxelSandbox();

      const filename1 = sandbox.mounts.markerFilename('/data/bucket1');
      const filename2 = sandbox.mounts.markerFilename('/data/bucket2');

      expect(filename1).not.toBe(filename2);
    });
  });
});

/**
 * Additional unit tests for race conditions and edge cases
 */
describe('BlaxelSandbox Race Conditions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  it('start() clears _startPromise after completion', async () => {
    const sandbox = new BlaxelSandbox();

    await sandbox._start();

    const sandboxAny = sandbox as any;
    expect(sandboxAny._startPromise).toBeUndefined();
  });

  it('start() clears _startPromise after error', async () => {
    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockRejectedValueOnce(new Error('Creation failed'));

    const sandbox = new BlaxelSandbox();

    await expect(sandbox._start()).rejects.toThrow('Creation failed');

    const sandboxAny = sandbox as any;
    expect(sandboxAny._startPromise).toBeUndefined();
  });
});

/**
 * Mount configuration unit tests
 */
describe('BlaxelSandbox Mount Configuration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));

    // Mock s3fs as installed
    mockSandbox.process.exec.mockImplementation((req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('which s3fs')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '/usr/bin/s3fs',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      }
      if (cmd.includes('id -u')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '1000\n1000',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      }
      return Promise.resolve({
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      });
    });
  });

  it('S3 endpoint mount includes url, path style, and sigv4 options', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-s3',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket',
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/s3');

    const calls = mockSandbox.process.exec.mock.calls;
    const s3fsMountCall = calls.find((call: any[]) => {
      const cmd = call[0]?.command || '';
      return cmd.includes('s3fs') && cmd.includes('/data/s3') && !cmd.includes('which');
    });

    expect(s3fsMountCall).toBeDefined();
    if (s3fsMountCall) {
      const cmd = s3fsMountCall[0].command;
      expect(cmd).toContain('url=');
      expect(cmd).toContain('use_path_request_style');
      expect(cmd).toContain('sigv4');
      expect(cmd).toContain('passwd_file=');
      expect(cmd).toMatch(/uid=\d+/);
      expect(cmd).toMatch(/gid=\d+/);
    }
  });

  it('S3 readOnly includes ro option in mount command', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-s3-ro',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        readOnly: true,
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/s3-ro');

    const calls = mockSandbox.process.exec.mock.calls;
    const s3fsMountCall = calls.find((call: any[]) => {
      const cmd = call[0]?.command || '';
      return cmd.includes('s3fs') && cmd.includes('/data/s3-ro') && !cmd.includes('which');
    });

    expect(s3fsMountCall).toBeDefined();
    if (s3fsMountCall) {
      expect(s3fsMountCall[0].command).toMatch(/\bro\b/);
    }
  });
});

/**
 * S3 public bucket mount tests
 */
describe('BlaxelSandbox S3 Public Bucket Mount', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));

    mockSandbox.process.exec.mockImplementation((req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('which s3fs')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '/usr/bin/s3fs',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      }
      if (cmd.includes('id -u')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '1000\n1000',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      }
      return Promise.resolve({
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      });
    });
  });

  it('S3 public bucket includes public_bucket=1 in mount command', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-s3-public',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'public-bucket',
        region: 'us-east-1',
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/s3-public');

    const calls = mockSandbox.process.exec.mock.calls;
    const s3fsMountCall = calls.find((call: any[]) => {
      const cmd = call[0]?.command || '';
      return cmd.includes('s3fs') && cmd.includes('/data/s3-public') && !cmd.includes('which');
    });

    expect(s3fsMountCall).toBeDefined();
    if (s3fsMountCall) {
      expect(s3fsMountCall[0].command).toContain('public_bucket=1');
    }
  });
});

/**
 * GCS mount command flag tests
 */
describe('BlaxelSandbox GCS Mount Configuration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));

    mockSandbox.process.exec.mockImplementation((req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('which gcsfuse')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '/usr/bin/gcsfuse',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      }
      if (cmd.includes('id -u')) {
        return Promise.resolve({
          exitCode: 0,
          stdout: '1000\n1000',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      }
      return Promise.resolve({
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      });
    });
  });

  it('GCS with credentials includes --key-file in gcsfuse command', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-gcs-auth',
      name: 'GCSFilesystem',
      provider: 'gcs',
      status: 'ready',
      getMountConfig: () => ({
        type: 'gcs',
        bucket: 'test-bucket',
        serviceAccountKey: JSON.stringify({ type: 'service_account', project_id: 'test' }),
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/gcs-auth');

    const calls = mockSandbox.process.exec.mock.calls;
    const gcsfuseCall = calls.find((call: any[]) => {
      const cmd = call[0]?.command || '';
      return cmd.includes('gcsfuse') && cmd.includes('/data/gcs-auth') && !cmd.includes('which');
    });

    expect(gcsfuseCall).toBeDefined();
    if (gcsfuseCall) {
      expect(gcsfuseCall[0].command).toContain('--key-file=');
    }
  });

  it('GCS without credentials includes --anonymous-access in gcsfuse command', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-gcs-anon',
      name: 'GCSFilesystem',
      provider: 'gcs',
      status: 'ready',
      getMountConfig: () => ({
        type: 'gcs',
        bucket: 'public-bucket',
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/gcs-anon');

    const calls = mockSandbox.process.exec.mock.calls;
    const gcsfuseCall = calls.find((call: any[]) => {
      const cmd = call[0]?.command || '';
      return cmd.includes('gcsfuse') && cmd.includes('/data/gcs-anon') && !cmd.includes('which');
    });

    expect(gcsfuseCall).toBeDefined();
    if (gcsfuseCall) {
      expect(gcsfuseCall[0].command).toContain('--anonymous-access');
    }
  });
});

/**
 * Error handling unit tests
 */
describe('BlaxelSandbox Error Handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  it('SandboxNotReadyError thrown if instance accessed before start', () => {
    const sandbox = new BlaxelSandbox();

    expect(() => sandbox.instance).toThrow(/not started|not ready|Sandbox/i);
  });

  it('executeCommand auto-starts sandbox if not running', async () => {
    const sandbox = new BlaxelSandbox();

    const result = await sandbox.executeCommand('echo', ['test']);

    expect(result.success).toBe(true);
  });

  it('clear error for S3-compatible without credentials', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const loggerErrorSpy = vi.spyOn((sandbox as any).logger, 'error');

    const mockFilesystem = {
      id: 'test-s3-compat',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket',
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/s3-compat');

    expect(result.success).toBe(false);
    expect(result.error).toContain('credentials');
    expect(result.error).toContain('endpoint');
    expect(result.error).toContain('public_bucket');
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error mounting'), expect.any(Error));

    loggerErrorSpy.mockRestore();
  });
});

/**
 * Reconcile mounts unit tests
 */
describe('BlaxelSandbox Reconcile Mounts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  it('reconcileMounts is called on reconnect before processPending', async () => {
    const { SandboxInstance } = await import('@blaxel/core');

    // Mock finding existing sandbox
    (SandboxInstance.get as any).mockResolvedValue({
      ...mockSandbox,
      status: 'DEPLOYED',
    });

    const sandbox = new BlaxelSandbox({ id: 'existing-id' });

    const callOrder: string[] = [];
    const reconcileSpy = vi.spyOn(sandbox, 'reconcileMounts').mockImplementation(async () => {
      callOrder.push('reconcile');
    });
    const processPendingSpy = vi.spyOn(sandbox.mounts, 'processPending').mockImplementation(async () => {
      callOrder.push('processPending');
    });

    await sandbox._start();

    expect(reconcileSpy).toHaveBeenCalled();
    expect(callOrder.indexOf('reconcile')).toBeLessThan(callOrder.indexOf('processPending'));

    reconcileSpy.mockRestore();
    processPendingSpy.mockRestore();

    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  it('unmounts stale managed FUSE mounts but keeps expected ones', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const keepMarker = sandbox.mounts.markerFilename('/data/keep');
    const staleMarker = sandbox.mounts.markerFilename('/data/stale');

    mockSandbox.process.exec.mockImplementation(async (req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('/proc/mounts')) {
        return {
          exitCode: 0,
          stdout: '/data/keep\n/data/stale\n',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return {
          exitCode: 0,
          stdout: `${keepMarker}\n${staleMarker}`,
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('cat') && cmd.includes(keepMarker)) {
        return {
          exitCode: 0,
          stdout: '/data/keep|hash1',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('cat') && cmd.includes(staleMarker)) {
        return {
          exitCode: 0,
          stdout: '/data/stale|hash2',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      };
    });

    await sandbox.reconcileMounts(['/data/keep']);

    const fusermountCalls = mockSandbox.process.exec.mock.calls.filter((c: any[]) =>
      (c[0]?.command || '').includes('fusermount'),
    );
    expect(fusermountCalls.length).toBe(1);
    expect(fusermountCalls[0][0].command).toContain('/data/stale');
  });

  it('never unmounts unmanaged FUSE mounts', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    mockSandbox.process.exec.mockImplementation(async (req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('/proc/mounts')) {
        return {
          exitCode: 0,
          stdout: '/data/fuse-stale\n',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      };
    });

    await sandbox.reconcileMounts([]);

    const fusermountCalls = mockSandbox.process.exec.mock.calls.filter((c: any[]) =>
      (c[0]?.command || '').includes('fusermount'),
    );
    expect(fusermountCalls).toHaveLength(0);
  });

  it('leaves all mounts alone when all are expected', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    mockSandbox.process.exec.mockImplementation(async (req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('/proc/mounts')) {
        return {
          exitCode: 0,
          stdout: '/data/mount1\n/data/mount2\n',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      };
    });

    await sandbox.reconcileMounts(['/data/mount1', '/data/mount2']);

    const fusermountCalls = mockSandbox.process.exec.mock.calls.filter((c: any[]) =>
      (c[0]?.command || '').includes('fusermount'),
    );
    expect(fusermountCalls).toHaveLength(0);
  });

  it('cleans up orphaned marker files and directories', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const orphanMarker = sandbox.mounts.markerFilename('/data/orphaned');

    mockSandbox.process.exec.mockImplementation(async (req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('/proc/mounts')) {
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return {
          exitCode: 0,
          stdout: orphanMarker,
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('cat') && cmd.includes(orphanMarker)) {
        return {
          exitCode: 0,
          stdout: '/data/orphaned|abc123hash',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      };
    });

    await sandbox.reconcileMounts([]);

    const rmCalls = mockSandbox.process.exec.mock.calls.filter(
      (c: any[]) => (c[0]?.command || '').includes('rm -f') && (c[0]?.command || '').includes(orphanMarker),
    );
    expect(rmCalls.length).toBe(1);

    const rmdirCalls = mockSandbox.process.exec.mock.calls.filter(
      (c: any[]) => (c[0]?.command || '').includes('rmdir') && (c[0]?.command || '').includes('/data/orphaned'),
    );
    expect(rmdirCalls.length).toBe(1);
  });

  it('deletes malformed marker files without error', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    mockSandbox.process.exec.mockImplementation(async (req: any) => {
      const cmd = req.command || '';
      if (cmd.includes('/proc/mounts')) {
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return {
          exitCode: 0,
          stdout: 'mount-badfile',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      if (cmd.includes('cat') && cmd.includes('mount-badfile')) {
        return {
          exitCode: 0,
          stdout: 'garbage-content-no-pipe',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        };
      }
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        pid: '1',
        status: 'completed',
        command: cmd,
        logs: '',
        name: '',
        startedAt: '',
        completedAt: '',
        workingDir: '',
      };
    });

    await sandbox.reconcileMounts([]);

    const rmCalls = mockSandbox.process.exec.mock.calls.filter(
      (c: any[]) => (c[0]?.command || '').includes('rm -f') && (c[0]?.command || '').includes('mount-badfile'),
    );
    expect(rmCalls.length).toBe(1);
  });
});

/**
 * Stop/destroy only unmount managed mounts
 */
describe('BlaxelSandbox stop/destroy only unmount managed mounts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  it('stop() only unmounts mounts in the manager, not all FUSE mounts', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFs = {
      id: 'fs1',
      name: 'FS1',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket-one',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      }),
    } as any;

    await sandbox.mount(mockFs, '/data/managed');

    mockSandbox.process.exec.mockClear();

    await sandbox._stop();

    const procMountsCalls = mockSandbox.process.exec.mock.calls.filter((c: any[]) =>
      (c[0]?.command || '').includes('/proc/mounts'),
    );
    expect(procMountsCalls).toHaveLength(0);

    const fusermountCalls = mockSandbox.process.exec.mock.calls.filter((c: any[]) =>
      (c[0]?.command || '').includes('fusermount'),
    );
    expect(fusermountCalls.length).toBeGreaterThanOrEqual(1);
    expect(fusermountCalls[0][0].command).toContain('/data/managed');
  });

  it('destroy() only unmounts mounts in the manager, not all FUSE mounts', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFs = {
      id: 'fs1',
      name: 'FS1',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket-one',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      }),
    } as any;

    await sandbox.mount(mockFs, '/data/managed');

    mockSandbox.process.exec.mockClear();

    await sandbox._destroy();

    const procMountsCalls = mockSandbox.process.exec.mock.calls.filter((c: any[]) =>
      (c[0]?.command || '').includes('/proc/mounts'),
    );
    expect(procMountsCalls).toHaveLength(0);
  });
});

/**
 * Stop behavior unit tests
 */
describe('BlaxelSandbox Stop Behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  it('stop() unmounts all filesystems', async () => {
    const sandbox = new BlaxelSandbox();
    await sandbox._start();

    const mockFilesystem1 = {
      id: 'fs1',
      name: 'FS1',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket-one',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      }),
    } as any;

    const mockFilesystem2 = {
      id: 'fs2',
      name: 'FS2',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'test-bucket-two',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      }),
    } as any;

    await sandbox.mount(mockFilesystem1, '/data/mount1');
    await sandbox.mount(mockFilesystem2, '/data/mount2');

    mockSandbox.process.exec.mockClear();

    await sandbox._stop();

    const fusermountCalls = mockSandbox.process.exec.mock.calls.filter((call: any[]) =>
      (call[0]?.command || '').includes('fusermount'),
    );

    expect(fusermountCalls.length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Internal method tests
 */
describe('BlaxelSandbox Internal Methods', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMockDefaults();

    const { SandboxInstance } = await import('@blaxel/core');
    (SandboxInstance.create as any).mockResolvedValue(mockSandbox);
    (SandboxInstance.get as any).mockRejectedValue(new Error('not found'));
  });

  describe('isSandboxDeadError()', () => {
    it('returns true for "TERMINATED"', () => {
      const sandbox = new BlaxelSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('TERMINATED'))).toBe(true);
    });

    it('returns true for "sandbox was not found"', () => {
      const sandbox = new BlaxelSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox was not found'))).toBe(true);
    });

    it('returns true for "Sandbox not found"', () => {
      const sandbox = new BlaxelSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox not found'))).toBe(true);
    });

    it('returns false for generic "not found" errors', () => {
      const sandbox = new BlaxelSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('File not found'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(new Error('bucket not found'))).toBe(false);
    });

    it('returns false for regular errors', () => {
      const sandbox = new BlaxelSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('timeout'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(new Error('command failed'))).toBe(false);
    });

    it('returns false for null/undefined', () => {
      const sandbox = new BlaxelSandbox();
      expect((sandbox as any).isSandboxDeadError(null)).toBe(false);
      expect((sandbox as any).isSandboxDeadError(undefined)).toBe(false);
    });
  });

  describe('handleSandboxTimeout()', () => {
    it('clears sandbox instance and sets status to stopped', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      expect(sandbox.status).toBe('running');
      expect((sandbox as any)._sandbox).not.toBeNull();

      (sandbox as any).handleSandboxTimeout();

      expect((sandbox as any)._sandbox).toBeNull();
      expect(sandbox.status).toBe('stopped');
    });
  });

  describe('executeCommand retry on dead sandbox', () => {
    it('retries once when sandbox is dead', async () => {
      const { SandboxInstance } = await import('@blaxel/core');
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      let callCount = 0;
      mockSandbox.process.exec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('sandbox was not found');
        }
        return Promise.resolve({
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: '',
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      });

      const result = await sandbox.executeCommand('echo', ['test']);

      expect(result.success).toBe(true);
      expect(SandboxInstance.create).toHaveBeenCalledTimes(2);
    });

    it('does not retry infinitely (only once)', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      mockSandbox.process.exec.mockImplementation(() => {
        throw new Error('sandbox was not found');
      });

      const result = await sandbox.executeCommand('echo', ['test']);

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('sandbox was not found');
    });
  });

  describe('mount() unsupported type', () => {
    it('returns failure for unsupported mount config type', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-unknown',
        name: 'UnknownFS',
        provider: 'unknown',
        status: 'ready',
        getMountConfig: () => ({ type: 'ftp', bucket: 'test' }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/ftp');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported mount type');
      expect(result.error).toContain('ftp');
    });
  });

  describe('mount() non-empty directory safety check', () => {
    it('rejects mounting to non-empty directory', async () => {
      const sandbox = new BlaxelSandbox();
      await sandbox._start();

      mockSandbox.process.exec.mockImplementation((req: any) => {
        const cmd = req.command || '';
        if (cmd.includes('ls -A')) {
          return Promise.resolve({
            exitCode: 0,
            stdout: 'non-empty',
            stderr: '',
            pid: '1',
            status: 'completed',
            command: cmd,
            logs: '',
            name: '',
            startedAt: '',
            completedAt: '',
            workingDir: '',
          });
        }
        return Promise.resolve({
          exitCode: 0,
          stdout: '',
          stderr: '',
          pid: '1',
          status: 'completed',
          command: cmd,
          logs: '',
          name: '',
          startedAt: '',
          completedAt: '',
          workingDir: '',
        });
      });

      const mockFilesystem = {
        id: 'fs',
        name: 'FS',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({ type: 's3', bucket: 'b', region: 'r', accessKeyId: 'k', secretAccessKey: 's' }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/existing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not empty');

      // Reset mocks so the custom mockImplementation doesn't leak into subsequent tests
      resetMockDefaults();
    });
  });
});

/**
 * Shared conformance tests from _test-utils.
 * These validate that BlaxelSandbox conforms to the WorkspaceSandbox contract.
 */
describe('BlaxelSandbox Shared Conformance', () => {
  let sandbox: BlaxelSandbox;

  beforeAll(async () => {
    sandbox = new BlaxelSandbox({ id: `conformance-${Date.now()}` });
    await sandbox._start();
  });

  afterAll(async () => {
    await sandbox._destroy();
  });

  const getContext = () => ({
    sandbox: sandbox as any,
    capabilities: {
      supportsMounting: true,
      supportsReconnection: false,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      defaultCommandTimeout: 5000,
      supportsStreaming: true,
    },
    testTimeout: 5000,
    fastOnly: false,
    createSandbox: () => new BlaxelSandbox(),
  });

  createSandboxLifecycleTests(getContext);
  createMountOperationsTests(getContext);
});
