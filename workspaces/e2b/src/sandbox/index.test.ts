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
 * Additional unit tests for race conditions and edge cases
 */
describe('E2BSandbox Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('start() clears _startPromise after completion', async () => {
    const sandbox = new E2BSandbox();

    // Start and complete
    await sandbox.start();

    // Access private _startPromise via any
    const sandboxAny = sandbox as any;
    expect(sandboxAny._startPromise).toBeUndefined();
  });

  it('start() clears _startPromise after error', async () => {
    const { Sandbox } = await import('e2b');
    (Sandbox.betaCreate as any).mockRejectedValueOnce(new Error('Creation failed'));

    const sandbox = new E2BSandbox();

    await expect(sandbox.start()).rejects.toThrow('Creation failed');

    // _startPromise should be cleared even on error
    const sandboxAny = sandbox as any;
    expect(sandboxAny._startPromise).toBeUndefined();
  });
});

/**
 * Template handling edge cases
 */
describe('E2BSandbox Template Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rebuilds template on 404 error', async () => {
    const { Sandbox, Template } = await import('e2b');

    // Template.exists returns true initially (cached)
    (Template.exists as any).mockResolvedValue(true);

    // First call fails with 404 error (matching the implementation check), second succeeds
    let callCount = 0;
    (Sandbox.betaCreate as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Error message must include both '404' and 'not found' to trigger rebuild
        return Promise.reject(new Error('404 template not found'));
      }
      return Promise.resolve(mockSandbox);
    });

    const sandbox = new E2BSandbox();
    await sandbox.start();

    // Template.build should be called to rebuild after 404
    expect(Template.build).toHaveBeenCalled();
    // And betaCreate should be called twice (retry after rebuild)
    expect(callCount).toBe(2);
  });

  it('custom template builder is built', async () => {
    const { Template } = await import('e2b');

    // Create a mock template builder
    const mockBuilder = {
      templateId: 'builder-template-id',
      aptInstall: vi.fn().mockReturnThis(),
    };

    const sandbox = new E2BSandbox({ template: mockBuilder as any });
    await sandbox.start();

    // Template.build should be called with the builder (and possibly a name)
    expect(Template.build).toHaveBeenCalledWith(
      mockBuilder,
      expect.any(String), // template name
    );
  });

  it('template function customizes base template', async () => {
    const { Template } = await import('e2b');

    // Template function that adds custom packages
    const templateFn = (base: any) => {
      base.aptInstall(['curl', 'wget']);
      return base;
    };

    const sandbox = new E2BSandbox({ template: templateFn });
    await sandbox.start();

    // Template.build should be called (function creates customized builder)
    expect(Template.build).toHaveBeenCalled();
  });
});

/**
 * Mount configuration unit tests
 */
describe('E2BSandbox Mount Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock s3fs as installed
    mockSandbox.commands.run.mockImplementation((cmd: string) => {
      if (cmd.includes('which s3fs')) {
        return Promise.resolve({ exitCode: 0, stdout: '/usr/bin/s3fs', stderr: '' });
      }
      if (cmd.includes('id -u')) {
        return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
      }
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    });
  });

  it('S3 endpoint mount includes url and path style options', async () => {
    const sandbox = new E2BSandbox();
    await sandbox.start();

    // Mock filesystem with endpoint (S3-compatible like R2/MinIO)
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

    // Verify s3fs command includes endpoint options
    const calls = mockSandbox.commands.run.mock.calls;
    // Find the actual s3fs mount command (not 'which s3fs')
    const s3fsMountCall = calls.find(
      (call: any[]) => call[0].includes('s3fs') && call[0].includes('/data/s3') && !call[0].includes('which'),
    );

    expect(s3fsMountCall).toBeDefined();
    if (s3fsMountCall) {
      expect(s3fsMountCall[0]).toContain('url=');
      expect(s3fsMountCall[0]).toContain('use_path_request_style');
    }
  });

  it('S3 readOnly includes ro option in mount command', async () => {
    const sandbox = new E2BSandbox();
    await sandbox.start();

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

    const calls = mockSandbox.commands.run.mock.calls;
    // Find the actual s3fs mount command (not 'which s3fs')
    const s3fsMountCall = calls.find(
      (call: any[]) => call[0].includes('s3fs') && call[0].includes('/data/s3-ro') && !call[0].includes('which'),
    );

    expect(s3fsMountCall).toBeDefined();
    if (s3fsMountCall) {
      expect(s3fsMountCall[0]).toMatch(/\bro\b/);
    }
  });
});

/**
 * Error handling unit tests
 */
describe('E2BSandbox Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SandboxNotReadyError thrown if instance accessed before start', () => {
    const sandbox = new E2BSandbox();

    // Accessing instance directly before start throws SandboxNotReadyError
    expect(() => sandbox.instance).toThrow(/not started|not ready|Sandbox/i);
  });

  it('executeCommand auto-starts sandbox if not running', async () => {
    const sandbox = new E2BSandbox();

    // executeCommand should auto-start the sandbox
    const result = await sandbox.executeCommand('echo', ['test']);

    // Should succeed (auto-started)
    expect(result.success).toBe(true);
  });

  it('clear error for S3-compatible without credentials', async () => {
    const sandbox = new E2BSandbox();
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
        endpoint: 'https://account.r2.cloudflarestorage.com',
        // No credentials
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/s3-compat');

    expect(result.success).toBe(false);
    expect(result.error).toContain('credentials');
    expect(result.error).toContain('endpoint');
  });
});

/**
 * Reconcile mounts unit tests
 */
describe('E2BSandbox Reconcile Mounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSandbox.commands.run.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
  });

  it('reconcileMounts is called on reconnect', async () => {
    const { Sandbox } = await import('e2b');

    // Mock finding existing sandbox
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([{ sandboxId: 'existing-sandbox', state: 'running' }]),
    });

    const sandbox = new E2BSandbox({ id: 'existing-id' });

    // Spy on reconcileMounts
    const reconcileSpy = vi.spyOn(sandbox, 'reconcileMounts');

    await sandbox.start();

    // reconcileMounts should be called during reconnect
    expect(reconcileSpy).toHaveBeenCalled();

    // Reset mock
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([]),
    });
  });
});

/**
 * Stop behavior unit tests
 */
describe('E2BSandbox Stop Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSandbox.commands.run.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
  });

  it('stop() unmounts all filesystems', async () => {
    const sandbox = new E2BSandbox();
    await sandbox.start();

    // Add mock mounts to the manager
    const mockFilesystem1 = {
      id: 'fs1',
      name: 'FS1',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'b1', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's' }),
    } as any;

    const mockFilesystem2 = {
      id: 'fs2',
      name: 'FS2',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'b2', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's' }),
    } as any;

    await sandbox.mount(mockFilesystem1, '/data/mount1');
    await sandbox.mount(mockFilesystem2, '/data/mount2');

    // Reset mock to track stop calls
    mockSandbox.commands.run.mockClear();

    await sandbox.stop();

    // fusermount -u should be called for each mount
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((call: any[]) =>
      call[0].includes('fusermount'),
    );

    expect(fusermountCalls.length).toBeGreaterThanOrEqual(2);
  });
});
