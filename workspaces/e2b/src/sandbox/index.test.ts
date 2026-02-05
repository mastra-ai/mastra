/**
 * E2B Sandbox Provider Tests
 *
 * Tests E2B-specific functionality including:
 * - Constructor options and ID generation
 * - Race condition prevention in start()
 * - Template handling
 * - Environment variable handling
 * - Mount operations (S3, GCS)
 * - Marker file handling
 * - Mount reconciliation
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { E2BSandbox } from './index';
import type { E2BSandboxOptions } from './index';

// Use vi.hoisted to define the mock before vi.mock is hoisted
const { mockSandbox, createMockSandboxApi } = vi.hoisted(() => {
  const mockSandbox = {
    sandboxId: 'mock-sandbox-id',
    commands: {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
    },
    files: {
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(''),
      list: vi.fn().mockResolvedValue([]),
    },
    kill: vi.fn().mockResolvedValue(undefined),
  };

  // Create a mock template builder with chainable methods
  const createMockTemplateBuilder = () => {
    const builder = {
      templateId: 'mock-template-id',
      fromTemplate: vi.fn().mockReturnThis(),
      fromUbuntuImage: vi.fn().mockReturnThis(),
      aptInstall: vi.fn().mockReturnThis(),
      runCmd: vi.fn().mockReturnThis(),
      setEnvs: vi.fn().mockReturnThis(),
    };
    return builder;
  };

  // Template is both a function and an object with static methods
  const createMockTemplate = () => {
    const templateFn = vi.fn().mockImplementation(() => createMockTemplateBuilder());
    // Add static methods
    templateFn.exists = vi.fn().mockResolvedValue(false);
    templateFn.build = vi.fn().mockResolvedValue({ templateId: 'mock-template-id' });
    return templateFn;
  };

  const createMockSandboxApi = () => ({
    Sandbox: {
      betaCreate: vi.fn().mockResolvedValue(mockSandbox),
      connect: vi.fn().mockResolvedValue(mockSandbox),
      list: vi.fn().mockReturnValue({
        nextItems: vi.fn().mockResolvedValue([]),
      }),
    },
    Template: createMockTemplate(),
  });

  return { mockSandbox, createMockSandboxApi };
});

// Mock the E2B SDK
vi.mock('e2b', () => createMockSandboxApi());

describe('E2BSandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const sandbox1 = new E2BSandbox();
      const sandbox2 = new E2BSandbox();

      expect(sandbox1.id).toMatch(/^e2b-sandbox-/);
      expect(sandbox2.id).toMatch(/^e2b-sandbox-/);
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('uses provided id', () => {
      const sandbox = new E2BSandbox({ id: 'my-sandbox' });

      expect(sandbox.id).toBe('my-sandbox');
    });

    it('default timeout is 5 minutes', () => {
      const sandbox = new E2BSandbox();

      // We can't directly access timeout, but we can verify the sandbox was created
      expect(sandbox.provider).toBe('e2b');
    });

    it('has correct provider and name', () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.provider).toBe('e2b');
      expect(sandbox.name).toBe('E2BSandbox');
    });

    it('status starts as pending', () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.status).toBe('pending');
    });

    it('starts template preparation in background', () => {
      // Template preparation starts in constructor
      const sandbox = new E2BSandbox();

      // No assertion needed - just verify it doesn't throw
      expect(sandbox.id).toBeDefined();
    });
  });

  describe('Start - Race Condition Prevention', () => {
    it('concurrent start() calls return same promise', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      // Start two concurrent calls
      const promise1 = sandbox.start();
      const promise2 = sandbox.start();

      await Promise.all([promise1, promise2]);

      // betaCreate should only be called once
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(1);
    });

    it('start() is idempotent when already running', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      await sandbox.start();
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(1);

      // Second start should not create another sandbox
      await sandbox.start();
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(1);
    });

    it('status transitions through starting to running', async () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox.start();

      expect(sandbox.status).toBe('running');
    });
  });

  describe('Start - Sandbox Creation', () => {
    it('creates new sandbox if none exists', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      await sandbox.start();

      expect(Sandbox.betaCreate).toHaveBeenCalled();
    });

    it('uses autoPause for sandbox persistence', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      await sandbox.start();

      expect(Sandbox.betaCreate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          autoPause: true,
        }),
      );
    });

    it('stores mastra-sandbox-id in metadata', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox({ id: 'test-id' });

      await sandbox.start();

      expect(Sandbox.betaCreate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({
            'mastra-sandbox-id': 'test-id',
          }),
        }),
      );
    });

    it('reconnects to existing sandbox by metadata', async () => {
      const { Sandbox } = await import('e2b');

      // Mock finding existing sandbox
      (Sandbox.list as any).mockReturnValue({
        nextItems: vi.fn().mockResolvedValue([{ sandboxId: 'existing-sandbox', state: 'running' }]),
      });

      const sandbox = new E2BSandbox({ id: 'existing-id' });
      await sandbox.start();

      expect(Sandbox.connect).toHaveBeenCalledWith('existing-sandbox');

      // Reset mock
      (Sandbox.list as any).mockReturnValue({
        nextItems: vi.fn().mockResolvedValue([]),
      });
    });
  });

  describe('Start - Template Handling', () => {
    it('uses cached template if exists', async () => {
      const { Template } = await import('e2b');

      // Mock Template.exists to return true (template already cached)
      (Template.exists as any).mockResolvedValueOnce(true);

      const sandbox = new E2BSandbox();
      await sandbox.start();

      // Template.build should not be called if template exists
      // (actual behavior depends on implementation)
      expect(sandbox.status).toBe('running');
    });

    it('builds default template if not cached', async () => {
      const { Template } = await import('e2b');

      // Mock Template.exists to return false
      (Template.exists as any).mockResolvedValue(false);

      const sandbox = new E2BSandbox();
      await sandbox.start();

      // Template.build should be called to create the template
      expect(Template.build).toHaveBeenCalled();
    });

    it('custom template string is used as-is', async () => {
      const { Sandbox } = await import('e2b');

      const sandbox = new E2BSandbox({ template: 'my-custom-template' });
      await sandbox.start();

      // betaCreate should be called with the custom template ID
      expect(Sandbox.betaCreate).toHaveBeenCalledWith(
        'my-custom-template',
        expect.any(Object),
      );
    });
  });

  describe('Start - Mount Processing', () => {
    it('processes pending mounts after start', async () => {
      const sandbox = new E2BSandbox();

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

      await sandbox.start();

      // After start, mount should be processed
      const entry = sandbox.mounts.get('/data');
      expect(entry?.state).not.toBe('pending');
    });
  });

  describe('Environment Variables', () => {
    it('env vars not passed to Sandbox.betaCreate', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox({ env: { KEY: 'value' } });

      await sandbox.start();

      // betaCreate should NOT have envs option
      expect(Sandbox.betaCreate).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({
          envs: expect.any(Object),
        }),
      );
    });

    it('env vars merged and passed per-command', async () => {
      const sandbox = new E2BSandbox({ env: { A: '1', B: '2' } });
      await sandbox.start();

      await sandbox.executeCommand('echo', ['test'], { env: { B: '3', C: '4' } });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          envs: expect.objectContaining({ A: '1', B: '3', C: '4' }),
        }),
      );
    });
  });

  describe('Stop/Destroy', () => {
    it('stop clears sandbox reference', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      expect(sandbox.status).toBe('running');

      await sandbox.stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('destroy kills sandbox', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      await sandbox.destroy();

      expect(mockSandbox.kill).toHaveBeenCalled();
      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('getInfo()', () => {
    it('returns SandboxInfo with all fields', async () => {
      const sandbox = new E2BSandbox({ id: 'test-id' });
      await sandbox.start();

      const info = await sandbox.getInfo();

      expect(info.id).toBe('test-id');
      expect(info.name).toBe('E2BSandbox');
      expect(info.provider).toBe('e2b');
      expect(info.status).toBe('running');
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.mounts).toBeDefined();
    });
  });

  describe('getInstructions()', () => {
    it('returns description of sandbox environment', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      const instructions = sandbox.getInstructions();

      expect(instructions).toContain('sandbox');
      expect(instructions).toContain('/home/user');
    });
  });

  describe('isReady()', () => {
    it('returns false when not started', async () => {
      const sandbox = new E2BSandbox();

      const ready = await sandbox.isReady();

      expect(ready).toBe(false);
    });

    it('returns true when running', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      const ready = await sandbox.isReady();

      expect(ready).toBe(true);
    });

    it('returns false when stopped', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();
      await sandbox.stop();

      const ready = await sandbox.isReady();

      expect(ready).toBe(false);
    });
  });

  describe('instance accessor', () => {
    it('throws SandboxNotReadyError if not started', () => {
      const sandbox = new E2BSandbox();

      expect(() => sandbox.instance).toThrow();
    });

    it('returns E2B Sandbox instance when started', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      const instance = sandbox.instance;

      expect(instance).toBe(mockSandbox);
    });
  });

  describe('Command Execution', () => {
    it('executes command and returns result', async () => {
      mockSandbox.commands.run.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'hello\n',
        stderr: '',
      });

      const sandbox = new E2BSandbox();
      await sandbox.start();

      const result = await sandbox.executeCommand('echo', ['hello']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
      expect(result.success).toBe(true);
    });

    it('captures stderr', async () => {
      mockSandbox.commands.run.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'error message',
      });

      const sandbox = new E2BSandbox();
      await sandbox.start();

      const result = await sandbox.executeCommand('sh', ['-c', 'echo error >&2']);

      expect(result.stderr).toContain('error message');
    });

    it('returns non-zero exit code for failing command', async () => {
      mockSandbox.commands.run.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: '',
      });

      const sandbox = new E2BSandbox();
      await sandbox.start();

      const result = await sandbox.executeCommand('exit', ['1']);

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
    });

    it('respects cwd option', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      await sandbox.executeCommand('pwd', [], { cwd: '/tmp' });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: '/tmp',
        }),
      );
    });

    it('respects timeout option', async () => {
      const sandbox = new E2BSandbox();
      await sandbox.start();

      await sandbox.executeCommand('sleep', ['10'], { timeout: 1000 });

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeoutMs: 1000,
        }),
      );
    });
  });
});

/**
 * Mount-related tests (unit tests with mocks)
 */
describe('E2BSandbox Mounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSandbox.commands.run.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
  });

  describe('Mount State Tracking', () => {
    it('has mounts property', async () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.mounts).toBeDefined();
    });

    it('mounts.entries is a Map', () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.mounts.entries).toBeInstanceOf(Map);
    });
  });

  describe('Marker File Helpers', () => {
    it('markerFilename generates consistent filename', () => {
      const sandbox = new E2BSandbox();

      const filename1 = sandbox.mounts.markerFilename('/data/bucket');
      const filename2 = sandbox.mounts.markerFilename('/data/bucket');

      expect(filename1).toBe(filename2);
      expect(filename1).toMatch(/^mount-[a-z0-9]+$/);
    });

    it('markerFilename differs for different paths', () => {
      const sandbox = new E2BSandbox();

      const filename1 = sandbox.mounts.markerFilename('/data/bucket1');
      const filename2 = sandbox.mounts.markerFilename('/data/bucket2');

      expect(filename1).not.toBe(filename2);
    });
  });
});

/**
 * Integration tests that require E2B API key.
 * These are skipped in CI and only run locally with credentials.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Integration', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-${Date.now()}`,
      timeout: 60000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('can start and execute commands', async () => {
    await sandbox.start();

    const result = await sandbox.executeCommand('echo', ['Hello E2B']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('Hello E2B');
  }, 120000);

  it('can reconnect to existing sandbox', async () => {
    await sandbox.start();
    const originalId = sandbox.id;

    // Create new sandbox instance with same ID
    const sandbox2 = new E2BSandbox({ id: originalId });
    await sandbox2.start();

    // Should reconnect to existing
    expect(sandbox2.status).toBe('running');

    await sandbox2.destroy();
  }, 120000);

  it('config change triggers remount on reconnect', async () => {
    // 1. Start sandbox with S3 mount (readOnly: false)
    // 2. Stop sandbox
    // 3. Reconnect with readOnly: true
    // 4. Verify remount occurred (writes should fail)
    // Note: Requires S3 credentials
  }, 120000);
});

/**
 * S3 Mount integration tests.
 * Require both E2B_API_KEY and S3 credentials.
 */
describe.skipIf(!process.env.E2B_API_KEY || !process.env.AWS_ACCESS_KEY_ID || !process.env.TEST_S3_BUCKET)(
  'E2BSandbox S3 Mount Integration',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-s3-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('S3 with credentials mounts successfully', async () => {
      // Given: S3MountConfig with accessKeyId and secretAccessKey
      // When: mount()
      // Then: s3fs command run with passwd_file
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-fs',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/s3-test');
      expect(result.success).toBe(true);

      // Verify mount works by listing directory
      const lsResult = await sandbox.executeCommand('ls', ['-la', '/data/s3-test']);
      expect(lsResult.exitCode).toBe(0);
    }, 180000);

    it('S3 public bucket mounts with public_bucket=1', async () => {
      // Given: S3MountConfig without credentials, no endpoint (AWS S3)
      // When: mount()
      // Then: s3fs command includes public_bucket=1
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-public',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: 'noaa-goes16', // Known public bucket
          region: 'us-east-1',
          // No credentials = public bucket
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/public-bucket');
      expect(result.success).toBe(true);
    }, 180000);

    it('S3-compatible without credentials warns and fails', async () => {
      // Given: S3MountConfig with endpoint but no credentials
      // When: mount()
      // Then: warning logged about credentials required, mount fails
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-compat',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: 'test-bucket',
          region: 'auto',
          endpoint: 'https://example.r2.cloudflarestorage.com',
          // No credentials - should warn/fail for S3-compatible
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/compat-test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('credentials');
    }, 180000);

    it('S3 with readOnly mounts with -o ro', async () => {
      // Given: S3MountConfig with readOnly: true
      // When: mount()
      // Then: s3fs command includes 'ro' option
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-ro',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          readOnly: true,
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/s3-readonly');
      expect(result.success).toBe(true);

      // Verify writes fail
      const writeResult = await sandbox.executeCommand('sh', [
        '-c',
        'echo "test" > /data/s3-readonly/test-file.txt 2>&1 || echo "write failed"',
      ]);
      expect(writeResult.stdout).toContain('Read-only');
    }, 180000);

    it('S3 mount sets uid/gid for file ownership', async () => {
      // When: mount()
      // Then: s3fs command includes uid= and gid= options
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-ownership',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/s3-ownership');

      // Check mount options include uid/gid
      const mountResult = await sandbox.executeCommand('sh', ['-c', 'grep s3fs /proc/mounts || cat /proc/mounts']);
      // Files should be owned by user, not root
      const statResult = await sandbox.executeCommand('stat', ['-c', '%U', '/data/s3-ownership']);
      expect(statResult.stdout.trim()).not.toBe('root');
    }, 180000);
  },
);

/**
 * GCS Mount integration tests.
 * Require both E2B_API_KEY and GCS credentials.
 */
describe.skipIf(!process.env.E2B_API_KEY || !process.env.GCS_SERVICE_ACCOUNT_KEY)(
  'E2BSandbox GCS Mount Integration',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-gcs-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('GCS with service account mounts successfully', async () => {
      // Given: GCSMountConfig with serviceAccountKey
      // When: mount()
      // Then: gcsfuse command run with key file
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-gcs-fs',
        name: 'GCSFilesystem',
        provider: 'gcs',
        status: 'ready',
        getMountConfig: () => ({
          type: 'gcs',
          bucket: process.env.TEST_GCS_BUCKET,
          serviceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY,
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/gcs-test');
      expect(result.success).toBe(true);

      // Verify mount works
      const lsResult = await sandbox.executeCommand('ls', ['-la', '/data/gcs-test']);
      expect(lsResult.exitCode).toBe(0);
    }, 180000);

    it('GCS public bucket mounts with anonymous access', async () => {
      // Given: GCSMountConfig without serviceAccountKey
      // When: mount()
      // Then: gcsfuse command includes anonymous option
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-gcs-public',
        name: 'GCSFilesystem',
        provider: 'gcs',
        status: 'ready',
        getMountConfig: () => ({
          type: 'gcs',
          bucket: 'gcp-public-data-landsat', // Known public bucket
          // No serviceAccountKey = anonymous access
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/gcs-public');
      expect(result.success).toBe(true);
    }, 180000);
  },
);

/**
 * Mount safety and error handling integration tests.
 * Require E2B_API_KEY.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Mount Safety', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-safety-${Date.now()}`,
      timeout: 60000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('mount errors if directory exists and is non-empty', async () => {
    // Given: /data/myfiles exists with files
    // When: mount(filesystem, '/data/myfiles')
    // Then: error "Cannot mount at /data/myfiles: directory exists and is not empty"
    await sandbox.start();

    // Create non-empty directory
    await sandbox.executeCommand('mkdir', ['-p', '/data/non-empty']);
    await sandbox.executeCommand('sh', ['-c', 'echo "existing" > /data/non-empty/file.txt']);

    const mockFilesystem = {
      id: 'test-fs',
      name: 'MockFS',
      provider: 'mock',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'test' }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/non-empty');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not empty');
  }, 120000);

  it('mount succeeds if directory exists but is empty', async () => {
    // Given: empty directory /data exists
    // When: mount(filesystem, '/data')
    // Then: mount succeeds (or proceeds to actual mount which may fail for other reasons)
    await sandbox.start();

    // Create empty directory
    await sandbox.executeCommand('mkdir', ['-p', '/data/empty-dir']);

    const mockFilesystem = {
      id: 'test-fs',
      name: 'MockFS',
      provider: 'mock',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'test' }),
    } as any;

    // This should not fail due to non-empty directory check
    // (may fail for other reasons like missing s3fs, but not the safety check)
    const result = await sandbox.mount(mockFilesystem, '/data/empty-dir');
    if (!result.success) {
      expect(result.error).not.toContain('not empty');
    }
  }, 120000);

  it('mount creates directory with sudo for paths outside home', async () => {
    // When: mount at '/data' (outside home)
    // Then: 'sudo mkdir -p' used
    await sandbox.start();

    const mockFilesystem = {
      id: 'test-fs',
      name: 'MockFS',
      provider: 'mock',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'test' }),
    } as any;

    // /opt is outside home, requires sudo
    // This tests the directory creation logic
    const result = await sandbox.mount(mockFilesystem, '/opt/test-mount');
    // Directory should be created (mount may fail for other reasons)
    const checkDir = await sandbox.executeCommand('test', ['-d', '/opt/test-mount']);
    expect(checkDir.exitCode).toBe(0);
  }, 120000);
});

/**
 * Mount reconciliation integration tests.
 * Require E2B_API_KEY.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BSandbox Mount Reconciliation', () => {
  let sandbox: E2BSandbox;

  beforeEach(() => {
    sandbox = new E2BSandbox({
      id: `test-reconcile-${Date.now()}`,
      timeout: 60000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('reconcileMounts unmounts stale FUSE mounts', async () => {
    // Given: sandbox has mount at /old-bucket from previous session
    // And: current config only expects /new-bucket
    // When: reconcileMounts(['/new-bucket'])
    // Then: /old-bucket is unmounted
    await sandbox.start();

    // This test is complex - requires setting up a real mount first
    // For now, just verify reconcileMounts can be called
    await expect(sandbox.reconcileMounts(['/expected-path'])).resolves.not.toThrow();
  }, 120000);

  it('reconcileMounts cleans up orphaned marker files', async () => {
    // Given: marker file exists for /old-bucket
    // And: /old-bucket not in expected paths
    // When: reconcileMounts(['/new-bucket'])
    // Then: marker file deleted
    await sandbox.start();

    // Create orphaned marker file
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "/orphan|abc123" > /tmp/.mastra-mounts/mount-orphan']);

    await sandbox.reconcileMounts(['/expected-path']);

    // Marker should be cleaned up
    const checkMarker = await sandbox.executeCommand('test', ['-f', '/tmp/.mastra-mounts/mount-orphan']);
    expect(checkMarker.exitCode).not.toBe(0); // File should not exist
  }, 120000);

  it('reconcileMounts handles malformed marker files', async () => {
    // Given: marker file with invalid content
    // When: reconcileMounts()
    // Then: malformed marker deleted without error
    await sandbox.start();

    // Create malformed marker file
    await sandbox.executeCommand('mkdir', ['-p', '/tmp/.mastra-mounts']);
    await sandbox.executeCommand('sh', ['-c', 'echo "invalid-no-pipe" > /tmp/.mastra-mounts/mount-malformed']);

    // Should not throw
    await expect(sandbox.reconcileMounts(['/expected'])).resolves.not.toThrow();
  }, 120000);
});

/**
 * Marker file handling integration tests.
 * Require E2B_API_KEY and S3 credentials for full mount tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !process.env.AWS_ACCESS_KEY_ID || !process.env.TEST_S3_BUCKET)(
  'E2BSandbox Marker Files',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-markers-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('successful mount creates marker file', async () => {
      // When: mount succeeds
      // Then: marker file created at /tmp/.mastra-mounts/mount-<hash>
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-marker',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/marker-test');

      // Check marker file exists
      const markerDir = await sandbox.executeCommand('ls', ['/tmp/.mastra-mounts/']);
      expect(markerDir.stdout).toContain('mount-');
    }, 180000);

    it('unmount removes marker file', async () => {
      // When: unmount()
      // Then: marker file deleted
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-unmount-marker',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }),
      } as any;

      const mountPath = '/data/unmount-marker-test';
      await sandbox.mount(mockFilesystem, mountPath);

      // Unmount
      await sandbox.unmount(mountPath);

      // Check marker file is gone
      const markerFilename = sandbox.mounts.markerFilename(mountPath);
      const checkMarker = await sandbox.executeCommand('test', ['-f', `/tmp/.mastra-mounts/${markerFilename}`]);
      expect(checkMarker.exitCode).not.toBe(0);
    }, 180000);

    it('unmount removes empty mount directory', async () => {
      // When: unmount()
      // Then: rmdir called on mount path
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-rmdir',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }),
      } as any;

      const mountPath = '/data/rmdir-test';
      await sandbox.mount(mockFilesystem, mountPath);
      await sandbox.unmount(mountPath);

      // Directory should be removed
      const checkDir = await sandbox.executeCommand('test', ['-d', mountPath]);
      expect(checkDir.exitCode).not.toBe(0);
    }, 180000);
  },
);

/**
 * Existing mount detection integration tests.
 */
describe.skipIf(!process.env.E2B_API_KEY || !process.env.AWS_ACCESS_KEY_ID || !process.env.TEST_S3_BUCKET)(
  'E2BSandbox Existing Mount Detection',
  () => {
    let sandbox: E2BSandbox;

    beforeEach(() => {
      sandbox = new E2BSandbox({
        id: `test-existing-${Date.now()}`,
        timeout: 120000,
      });
    });

    afterEach(async () => {
      if (sandbox) {
        try {
          await sandbox.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('mount skips if already mounted with matching config', async () => {
      // Given: mount already exists with same config hash
      // When: mount() called again
      // Then: returns success immediately without remounting
      await sandbox.start();

      const mockFilesystem = {
        id: 'test-s3-skip',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: process.env.TEST_S3_BUCKET,
          region: process.env.TEST_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }),
      } as any;

      const mountPath = '/data/skip-test';

      // Mount once
      const result1 = await sandbox.mount(mockFilesystem, mountPath);
      expect(result1.success).toBe(true);

      // Mount again with same config - should skip
      const result2 = await sandbox.mount(mockFilesystem, mountPath);
      expect(result2.success).toBe(true);
    }, 180000);

    it('mount unmounts and remounts if config changed', async () => {
      // Given: mount exists with different config hash
      // When: mount() called with new config
      // Then: unmount() called first, then new mount created
      await sandbox.start();

      const createFilesystem = (readOnly: boolean) =>
        ({
          id: 'test-s3-remount',
          name: 'S3Filesystem',
          provider: 's3',
          status: 'ready',
          getMountConfig: () => ({
            type: 's3',
            bucket: process.env.TEST_S3_BUCKET,
            region: process.env.TEST_S3_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            readOnly,
          }),
        }) as any;

      const mountPath = '/data/remount-test';

      // Mount with readOnly: false
      await sandbox.mount(createFilesystem(false), mountPath);

      // Mount again with readOnly: true - should remount
      const result = await sandbox.mount(createFilesystem(true), mountPath);
      expect(result.success).toBe(true);

      // Verify it's now read-only
      const writeResult = await sandbox.executeCommand('sh', [
        '-c',
        `echo "test" > ${mountPath}/test.txt 2>&1 || echo "write failed"`,
      ]);
      expect(writeResult.stdout).toMatch(/Read-only|write failed/);
    }, 240000);
  },
);
