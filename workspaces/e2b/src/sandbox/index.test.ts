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

import { createSandboxLifecycleTests, createMountOperationsTests } from '@internal/workspace-test-utils';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

import { E2BSandbox } from './index';

// Use vi.hoisted to define the mock before vi.mock is hoisted
const { mockSandbox, createMockSandboxApi, resetMockDefaults, createMockCommandHandle } = vi.hoisted(() => {
  let nextMockPid = 1000;

  /**
   * Create a mock E2B CommandHandle for background process spawning.
   * Emits data through the onStdout/onStderr callbacks when wait() is called
   * (not synchronously — the deferred reference pattern in E2BProcessManager
   * means the handle variable isn't assigned until after commands.run resolves).
   */
  const createMockCommandHandle = (
    result: { exitCode: number; stdout: string; stderr: string },
    opts?: { onStdout?: (data: string) => void; onStderr?: (data: string) => void },
  ) => {
    return {
      pid: nextMockPid++,
      wait: vi.fn().mockImplementation(async () => {
        // Emit data just before resolving (handle is assigned by now)
        if (result.stdout && opts?.onStdout) opts.onStdout(result.stdout);
        if (result.stderr && opts?.onStderr) opts.onStderr(result.stderr);
        return result;
      }),
      kill: vi.fn().mockResolvedValue(true),
    };
  };

  /**
   * Default mock implementation for commands.run that handles both
   * foreground and background modes.
   */
  const createDefaultRunMock = () =>
    vi.fn().mockImplementation((_cmd: string, opts?: any) => {
      const result = { exitCode: 0, stdout: '', stderr: '' };
      if (opts?.background) {
        return Promise.resolve(createMockCommandHandle(result, opts));
      }
      return Promise.resolve(result);
    });

  const mockSandbox = {
    sandboxId: 'mock-sandbox-id',
    commands: {
      run: createDefaultRunMock(),
      list: vi.fn().mockResolvedValue([]),
      sendStdin: vi.fn().mockResolvedValue(undefined),
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

  /**
   * Re-apply default mock implementations.
   * vi.clearAllMocks() only clears call tracking, not implementations.
   * Tests that override mocks with mockResolvedValue/mockReturnValue leak
   * those overrides into subsequent tests. This function restores defaults.
   */
  const resetMockDefaults = async () => {
    const { Sandbox, Template } = await import('e2b');
    (Sandbox.betaCreate as any).mockResolvedValue(mockSandbox);
    (Sandbox.connect as any).mockResolvedValue(mockSandbox);
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([]),
    });
    (Template.exists as any).mockResolvedValue(false);
    (Template.build as any).mockResolvedValue({ templateId: 'mock-template-id' });
    // Default run mock handles both foreground and background modes
    mockSandbox.commands.run.mockImplementation((_cmd: string, opts?: any) => {
      const result = { exitCode: 0, stdout: '', stderr: '' };
      if (opts?.background) {
        return Promise.resolve(createMockCommandHandle(result, opts));
      }
      return Promise.resolve(result);
    });
    mockSandbox.commands.list.mockResolvedValue([]);
    mockSandbox.commands.sendStdin.mockResolvedValue(undefined);
    mockSandbox.files.write.mockResolvedValue(undefined);
    mockSandbox.files.read.mockResolvedValue('');
    mockSandbox.files.list.mockResolvedValue([]);
    mockSandbox.kill.mockResolvedValue(undefined);
    nextMockPid = 1000;
  };

  return { mockSandbox, createMockSandboxApi, resetMockDefaults, createMockCommandHandle };
});

// Mock the E2B SDK
vi.mock('e2b', () => createMockSandboxApi());

describe('E2BSandbox', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
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

      // Access private timeout field
      expect((sandbox as any).timeout).toBe(300_000);
    });

    it('has correct provider and name', () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.provider).toBe('e2b');
      expect(sandbox.name).toBe('E2BSandbox');
    });

    it('starts template preparation in background', () => {
      // Template preparation starts in constructor
      const sandbox = new E2BSandbox();

      // _templatePreparePromise should be set immediately
      expect((sandbox as any)._templatePreparePromise).toBeDefined();
      expect((sandbox as any)._templatePreparePromise).toBeInstanceOf(Promise);
    });
  });

  describe('Start - Race Condition Prevention', () => {
    it('concurrent start() calls return same promise', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      // Start two concurrent calls
      const promise1 = sandbox._start();
      const promise2 = sandbox._start();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both promises should resolve to the same value (void)
      expect(result1).toBe(result2);

      // betaCreate should only be called once
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(1);
    });

    it('start() is idempotent when already running', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      await sandbox._start();
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(1);

      // Second start should not create another sandbox
      await sandbox._start();
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(1);
    });

    it('status transitions through starting to running', async () => {
      const sandbox = new E2BSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });
  });

  describe('Start - Sandbox Creation', () => {
    it('creates new sandbox if none exists', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      await sandbox._start();

      expect(Sandbox.betaCreate).toHaveBeenCalled();
    });

    it('uses autoPause for sandbox persistence', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();

      await sandbox._start();

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

      await sandbox._start();

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
      await sandbox._start();

      expect(Sandbox.connect).toHaveBeenCalledWith('existing-sandbox', expect.any(Object));
    });
  });

  describe('Start - Template Handling', () => {
    it('uses cached template if exists', async () => {
      const { Template } = await import('e2b');

      // Mock Template.exists to return true (template already cached)
      (Template.exists as any).mockResolvedValueOnce(true);

      const sandbox = new E2BSandbox();
      await sandbox._start();

      // Template.build should NOT be called when template already exists
      expect(Template.build).not.toHaveBeenCalled();
      expect(sandbox.status).toBe('running');
    });

    it('builds default template if not cached', async () => {
      const { Template } = await import('e2b');

      // Mock Template.exists to return false
      (Template.exists as any).mockResolvedValue(false);

      const sandbox = new E2BSandbox();
      await sandbox._start();

      // Template.build should be called to create the template
      expect(Template.build).toHaveBeenCalled();
    });

    it('custom template string is used as-is', async () => {
      const { Sandbox } = await import('e2b');

      const sandbox = new E2BSandbox({ template: 'my-custom-template' });
      await sandbox._start();

      // betaCreate should be called with the custom template ID
      expect(Sandbox.betaCreate).toHaveBeenCalledWith('my-custom-template', expect.any(Object));
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

      await sandbox._start();

      // After start, mount should be processed and state should be 'mounted' or 'error'
      const entry = sandbox.mounts.get('/data');
      expect(entry?.state).not.toBe('pending');
      // On success, the state should be 'mounted'
      expect(['mounted', 'error', 'unsupported']).toContain(entry?.state);
    });
  });

  describe('Environment Variables', () => {
    it('env vars not passed to Sandbox.betaCreate', async () => {
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox({ env: { KEY: 'value' } });

      await sandbox._start();

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
      await sandbox._start();

      await sandbox.executeCommand('echo', ['test'], { env: { B: '3', C: '4' } });

      // executeCommand now goes through processes.spawn (background mode)
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          background: true,
          envs: expect.objectContaining({ A: '1', B: '3', C: '4' }),
        }),
      );
    });
  });

  describe('Stop/Destroy', () => {
    it('destroy kills sandbox', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();

      await sandbox._destroy();

      expect(mockSandbox.kill).toHaveBeenCalled();
      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('getInfo()', () => {
    it('returns SandboxInfo with all fields', async () => {
      const sandbox = new E2BSandbox({ id: 'test-id' });
      await sandbox._start();

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
      await sandbox._start();

      const instructions = sandbox.getInstructions();

      expect(instructions).toContain('sandbox');
    });
  });

  describe('isReady()', () => {
    it('returns false when stopped', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();
      await sandbox._stop();

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
      await sandbox._start();

      const instance = sandbox.instance;

      expect(instance).toBe(mockSandbox);
    });
  });

  describe('Command Execution', () => {
    it('executes command and returns result', async () => {
      const expectedResult = { exitCode: 0, stdout: 'hello\n', stderr: '' };
      mockSandbox.commands.run.mockImplementation((_cmd: string, opts?: any) => {
        if (opts?.background) {
          return Promise.resolve(createMockCommandHandle(expectedResult, opts));
        }
        return Promise.resolve(expectedResult);
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('echo', ['hello']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
      expect(result.success).toBe(true);
    });

    it('captures stderr', async () => {
      const expectedResult = { exitCode: 1, stdout: '', stderr: 'error message' };
      mockSandbox.commands.run.mockImplementation((_cmd: string, opts?: any) => {
        if (opts?.background) {
          return Promise.resolve(createMockCommandHandle(expectedResult, opts));
        }
        return Promise.resolve(expectedResult);
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('sh', ['-c', 'echo error >&2']);

      expect(result.stderr).toContain('error message');
    });

    it('returns non-zero exit code for failing command', async () => {
      const expectedResult = { exitCode: 1, stdout: '', stderr: '' };
      mockSandbox.commands.run.mockImplementation((_cmd: string, opts?: any) => {
        if (opts?.background) {
          // E2B throws for non-zero exit codes in background mode
          const handle = createMockCommandHandle(expectedResult, opts);
          handle.wait.mockRejectedValue(Object.assign(new Error('exit code 1'), { exitCode: 1 }));
          return Promise.resolve(handle);
        }
        return Promise.resolve(expectedResult);
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('exit', ['1']);

      expect(result.exitCode).toBe(1);
      expect(result.success).toBe(false);
    });

    it('respects cwd option', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();

      await sandbox.executeCommand('pwd', [], { cwd: '/tmp' });

      // executeCommand now goes through processes.spawn (background mode)
      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          background: true,
          cwd: '/tmp',
        }),
      );
    });
  });
});

/**
 * Mount-related tests (unit tests with mocks)
 */
describe('E2BSandbox Mounting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
    mockSandbox.commands.run.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
  });

  // Mount property tests are covered by the shared conformance suite

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
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  it('start() clears _startPromise after completion', async () => {
    const sandbox = new E2BSandbox();

    // Start and complete
    await sandbox._start();

    // Access private _startPromise via any
    const sandboxAny = sandbox as any;
    expect(sandboxAny._startPromise).toBeUndefined();
  });

  it('start() clears _startPromise after error', async () => {
    const { Sandbox } = await import('e2b');
    (Sandbox.betaCreate as any).mockRejectedValueOnce(new Error('Creation failed'));

    const sandbox = new E2BSandbox();

    await expect(sandbox._start()).rejects.toThrow('Creation failed');

    // _startPromise should be cleared even on error
    const sandboxAny = sandbox as any;
    expect(sandboxAny._startPromise).toBeUndefined();
  });
});

/**
 * Template handling edge cases
 */
describe('E2BSandbox Template Handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
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
    await sandbox._start();

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
    await sandbox._start();

    // Template.build should be called with the builder, a name, and connection opts
    expect(Template.build).toHaveBeenCalledWith(
      mockBuilder,
      expect.any(String), // template name
      expect.any(Object), // connection opts
    );
  });

  it('template function customizes base template', async () => {
    const { Template } = await import('e2b');

    // Template function that adds custom packages
    const aptInstallSpy = vi.fn().mockReturnThis();
    const templateFn = (base: any) => {
      // Replace aptInstall with spy so we can verify it was called
      base.aptInstall = aptInstallSpy;
      base.aptInstall(['curl', 'wget']);
      return base;
    };

    const sandbox = new E2BSandbox({ template: templateFn });
    await sandbox._start();

    // Template.build should be called (function creates customized builder)
    expect(Template.build).toHaveBeenCalled();

    // Verify the function's aptInstall was called on the base template
    expect(aptInstallSpy).toHaveBeenCalledWith(['curl', 'wget']);
  });
});

/**
 * Mount configuration unit tests
 */
describe('E2BSandbox Mount Configuration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
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

  it('S3 endpoint mount includes url, path style, and sigv4 options', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

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
      expect(s3fsMountCall[0]).toContain('sigv4');
      expect(s3fsMountCall[0]).toContain('passwd_file=');
      expect(s3fsMountCall[0]).toMatch(/uid=\d+/);
      expect(s3fsMountCall[0]).toMatch(/gid=\d+/);
    }
  });

  it('S3 readOnly includes ro option in mount command', async () => {
    const sandbox = new E2BSandbox();
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
 * S3 public bucket mount tests
 */
describe('E2BSandbox S3 Public Bucket Mount', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
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

  it('S3 public bucket includes public_bucket=1 in mount command', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // Mock filesystem without credentials (public bucket)
    const mockFilesystem = {
      id: 'test-s3-public',
      name: 'S3Filesystem',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({
        type: 's3',
        bucket: 'public-bucket',
        region: 'us-east-1',
        // No accessKeyId/secretAccessKey
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/s3-public');

    const calls = mockSandbox.commands.run.mock.calls;
    const s3fsMountCall = calls.find(
      (call: any[]) => call[0].includes('s3fs') && call[0].includes('/data/s3-public') && !call[0].includes('which'),
    );

    expect(s3fsMountCall).toBeDefined();
    if (s3fsMountCall) {
      expect(s3fsMountCall[0]).toContain('public_bucket=1');
    }
  });
});

/**
 * GCS mount command flag tests
 */
describe('E2BSandbox GCS Mount Configuration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
    mockSandbox.commands.run.mockImplementation((cmd: string) => {
      if (cmd.includes('which gcsfuse')) {
        return Promise.resolve({ exitCode: 0, stdout: '/usr/bin/gcsfuse', stderr: '' });
      }
      if (cmd.includes('id -u')) {
        return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
      }
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    });
  });

  it('GCS with credentials includes --key-file in gcsfuse command', async () => {
    const sandbox = new E2BSandbox();
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

    const calls = mockSandbox.commands.run.mock.calls;
    const gcsfuseCall = calls.find(
      (call: any[]) => call[0].includes('gcsfuse') && call[0].includes('/data/gcs-auth') && !call[0].includes('which'),
    );

    expect(gcsfuseCall).toBeDefined();
    if (gcsfuseCall) {
      expect(gcsfuseCall[0]).toContain('--key-file=');
    }
  });

  it('GCS without credentials includes --anonymous-access in gcsfuse command', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    const mockFilesystem = {
      id: 'test-gcs-anon',
      name: 'GCSFilesystem',
      provider: 'gcs',
      status: 'ready',
      getMountConfig: () => ({
        type: 'gcs',
        bucket: 'public-bucket',
        // No serviceAccountKey
      }),
    } as any;

    await sandbox.mount(mockFilesystem, '/data/gcs-anon');

    const calls = mockSandbox.commands.run.mock.calls;
    const gcsfuseCall = calls.find(
      (call: any[]) => call[0].includes('gcsfuse') && call[0].includes('/data/gcs-anon') && !call[0].includes('which'),
    );

    expect(gcsfuseCall).toBeDefined();
    if (gcsfuseCall) {
      expect(gcsfuseCall[0]).toContain('--anonymous-access');
    }
  });
});

/**
 * Error handling unit tests
 */
describe('E2BSandbox Error Handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
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
    await sandbox._start();

    // Spy on the logger to verify error is logged
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
        // No credentials
      }),
    } as any;

    const result = await sandbox.mount(mockFilesystem, '/data/s3-compat');

    expect(result.success).toBe(false);
    expect(result.error).toContain('credentials');
    expect(result.error).toContain('endpoint');
    // Should mention public_bucket only works for AWS S3
    expect(result.error).toContain('public_bucket');
    // Should log the error
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error mounting'), expect.any(Error));

    loggerErrorSpy.mockRestore();
  });
});

/**
 * Reconcile mounts unit tests
 */
describe('E2BSandbox Reconcile Mounts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  it('reconcileMounts is called on reconnect before processPending', async () => {
    const { Sandbox } = await import('e2b');

    // Mock finding existing sandbox
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([{ sandboxId: 'existing-sandbox', state: 'running' }]),
    });

    const sandbox = new E2BSandbox({ id: 'existing-id' });

    // Track call order
    const callOrder: string[] = [];
    const reconcileSpy = vi.spyOn(sandbox, 'reconcileMounts').mockImplementation(async () => {
      callOrder.push('reconcile');
    });
    const processPendingSpy = vi.spyOn(sandbox.mounts, 'processPending').mockImplementation(async () => {
      callOrder.push('processPending');
    });

    await sandbox._start();

    // reconcileMounts should be called during reconnect
    expect(reconcileSpy).toHaveBeenCalled();
    // reconcileMounts must run before processPending
    expect(callOrder.indexOf('reconcile')).toBeLessThan(callOrder.indexOf('processPending'));

    reconcileSpy.mockRestore();
    processPendingSpy.mockRestore();

    // Reset mock
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([]),
    });
  });

  it('unmounts stale managed FUSE mounts but keeps expected ones', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // Both mounts have marker files (we created both), but only /data/keep is expected
    const keepMarker = sandbox.mounts.markerFilename('/data/keep');
    const staleMarker = sandbox.mounts.markerFilename('/data/stale');

    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '/data/keep\n/data/stale\n', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return { exitCode: 0, stdout: `${keepMarker}\n${staleMarker}`, stderr: '' };
      }
      if (cmd.includes('cat') && cmd.includes(keepMarker)) {
        return { exitCode: 0, stdout: '/data/keep|hash1', stderr: '' };
      }
      if (cmd.includes('cat') && cmd.includes(staleMarker)) {
        return { exitCode: 0, stdout: '/data/stale|hash2', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await sandbox.reconcileMounts(['/data/keep']);

    // fusermount should only be called for /data/stale, not /data/keep
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('fusermount'));
    expect(fusermountCalls.length).toBe(1);
    expect(fusermountCalls[0][0]).toContain('/data/stale');
  });

  it('never unmounts non-FUSE mounts or unmanaged FUSE mounts', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // grep for fuse mounts returns only FUSE mounts (ext4 etc are filtered by grep).
    // /data/fuse-stale is a FUSE mount but has no marker file — it's external.
    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '/data/fuse-stale\n', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        // No marker files — we didn't create this mount
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await sandbox.reconcileMounts([]);

    // No fusermount calls — the FUSE mount is external (no marker)
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('fusermount'));
    expect(fusermountCalls).toHaveLength(0);
  });

  it('leaves all mounts alone when all are expected', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '/data/mount1\n/data/mount2\n', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await sandbox.reconcileMounts(['/data/mount1', '/data/mount2']);

    // No fusermount calls
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('fusermount'));
    expect(fusermountCalls).toHaveLength(0);
  });

  it('cleans up orphaned marker files and directories', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // Generate the marker filename for /data/orphaned to match what reconcileMounts expects
    const orphanMarker = sandbox.mounts.markerFilename('/data/orphaned');

    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '', stderr: '' }; // no active FUSE mounts
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return { exitCode: 0, stdout: orphanMarker, stderr: '' };
      }
      if (cmd.includes('cat') && cmd.includes(orphanMarker)) {
        return { exitCode: 0, stdout: '/data/orphaned|abc123hash', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await sandbox.reconcileMounts([]); // no expected mounts

    // Marker file should be deleted
    const rmCalls = mockSandbox.commands.run.mock.calls.filter(
      (c: any[]) => c[0].includes('rm -f') && c[0].includes(orphanMarker),
    );
    expect(rmCalls.length).toBe(1);

    // Orphaned directory should be cleaned up
    const rmdirCalls = mockSandbox.commands.run.mock.calls.filter(
      (c: any[]) => c[0].includes('rmdir') && c[0].includes('/data/orphaned'),
    );
    expect(rmdirCalls.length).toBe(1);
  });

  it('deletes malformed marker files without error', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return { exitCode: 0, stdout: 'mount-badfile', stderr: '' };
      }
      if (cmd.includes('cat') && cmd.includes('mount-badfile')) {
        // Malformed content — no pipe separator
        return { exitCode: 0, stdout: 'garbage-content-no-pipe', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    // Should not throw
    await sandbox.reconcileMounts([]);

    // Malformed marker should be deleted
    const rmCalls = mockSandbox.commands.run.mock.calls.filter(
      (c: any[]) => c[0].includes('rm -f') && c[0].includes('mount-badfile'),
    );
    expect(rmCalls.length).toBe(1);
  });

  it('does not unmount external FUSE mounts (no marker file)', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // The sandbox has two FUSE mounts: one managed by us (has marker), one external (no marker)
    const managedMarker = sandbox.mounts.markerFilename('/data/managed');

    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        // Both show up as FUSE mounts
        return { exitCode: 0, stdout: '/data/managed\n/data/external\n', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        // Only /data/managed has a marker file
        return { exitCode: 0, stdout: managedMarker, stderr: '' };
      }
      if (cmd.includes('cat') && cmd.includes(managedMarker)) {
        return { exitCode: 0, stdout: '/data/managed|abc123hash', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    // Neither mount is "expected" (simulating a config change that removed both)
    await sandbox.reconcileMounts([]);

    // Only the managed mount should be unmounted
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('fusermount'));
    expect(fusermountCalls.length).toBe(1);
    expect(fusermountCalls[0][0]).toContain('/data/managed');
    // /data/external should NOT appear in any fusermount call
    expect(fusermountCalls.every((c: any[]) => !c[0].includes('/data/external'))).toBe(true);
  });

  it('treats mount as external when marker file read fails', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // A FUSE mount exists, and a marker file exists, but reading the marker fails
    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '/data/mystery\n', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return { exitCode: 0, stdout: 'mount-broken', stderr: '' };
      }
      if (cmd.includes('cat') && cmd.includes('mount-broken')) {
        // Read fails — empty output
        return { exitCode: 1, stdout: '', stderr: 'No such file' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await sandbox.reconcileMounts([]);

    // Mount should NOT be unmounted — we can't confirm we own it
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('fusermount'));
    expect(fusermountCalls).toHaveLength(0);
  });

  it('does not clean up marker files for expected mounts', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    const expectedMarker = sandbox.mounts.markerFilename('/data/expected');

    mockSandbox.commands.run.mockImplementation(async (cmd: string) => {
      if (cmd.includes('/proc/mounts')) {
        return { exitCode: 0, stdout: '/data/expected\n', stderr: '' };
      }
      if (cmd.includes('ls /tmp/.mastra-mounts')) {
        return { exitCode: 0, stdout: expectedMarker, stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await sandbox.reconcileMounts(['/data/expected']);

    // No rm calls for the expected marker
    const rmCalls = mockSandbox.commands.run.mock.calls.filter(
      (c: any[]) => c[0].includes('rm -f') && c[0].includes(expectedMarker),
    );
    expect(rmCalls).toHaveLength(0);
  });
});

/**
 * Stop/destroy only unmount managed mounts
 */
describe('E2BSandbox stop/destroy only unmount managed mounts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  it('stop() only unmounts mounts in the manager, not all FUSE mounts', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    // Mount one filesystem through the manager
    const mockFs = {
      id: 'fs1',
      name: 'FS1',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'b1', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's' }),
    } as any;

    await sandbox.mount(mockFs, '/data/managed');

    // Clear to track only stop() calls
    mockSandbox.commands.run.mockClear();

    await sandbox._stop();

    // Should only unmount /data/managed — no query of /proc/mounts
    const procMountsCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('/proc/mounts'));
    expect(procMountsCalls).toHaveLength(0);

    // fusermount should be called for the managed mount
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('fusermount'));
    expect(fusermountCalls.length).toBeGreaterThanOrEqual(1);
    expect(fusermountCalls[0][0]).toContain('/data/managed');
  });

  it('destroy() only unmounts mounts in the manager, not all FUSE mounts', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

    const mockFs = {
      id: 'fs1',
      name: 'FS1',
      provider: 's3',
      status: 'ready',
      getMountConfig: () => ({ type: 's3', bucket: 'b1', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's' }),
    } as any;

    await sandbox.mount(mockFs, '/data/managed');

    mockSandbox.commands.run.mockClear();

    await sandbox._destroy();

    // Should not query /proc/mounts during destroy
    const procMountsCalls = mockSandbox.commands.run.mock.calls.filter((c: any[]) => c[0].includes('/proc/mounts'));
    expect(procMountsCalls).toHaveLength(0);
  });
});

/**
 * Stop behavior unit tests
 */
describe('E2BSandbox Stop Behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  it('stop() unmounts all filesystems', async () => {
    const sandbox = new E2BSandbox();
    await sandbox._start();

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

    await sandbox._stop();

    // fusermount -u should be called for each mount
    const fusermountCalls = mockSandbox.commands.run.mock.calls.filter((call: any[]) => call[0].includes('fusermount'));

    expect(fusermountCalls.length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Runtime Installation unit tests
 *
 * Tests that verify FUSE tools (s3fs, gcsfuse) are installed at runtime
 * if not present in the sandbox template.
 */
describe('E2BSandbox Runtime Installation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  describe('S3 (s3fs)', () => {
    it('installs s3fs if not present', async () => {
      // Track which commands have been run
      const commandsRun: string[] = [];

      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        commandsRun.push(cmd);

        // First 'which s3fs' returns not found, after install it's found
        if (cmd.includes('which s3fs')) {
          const alreadyInstalled = commandsRun.some(c => c.includes('apt-get install'));
          if (alreadyInstalled) {
            return Promise.resolve({ exitCode: 0, stdout: '/usr/bin/s3fs', stderr: '' });
          }
          return Promise.resolve({ exitCode: 0, stdout: 'not found', stderr: '' });
        }

        // apt-get commands succeed
        if (cmd.includes('apt-get')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }

        // id command
        if (cmd.includes('id -u')) {
          return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
        }

        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      // Spy on logger to verify startup warning
      const loggerWarnSpy = vi.spyOn((sandbox as any).logger, 'warn');
      const loggerInfoSpy = vi.spyOn((sandbox as any).logger, 'info');

      const mockFilesystem = {
        id: 'test-s3',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/s3');

      // Verify apt-get install was called for s3fs
      const installCommand = commandsRun.find(cmd => cmd.includes('apt-get install') && cmd.includes('s3fs'));
      expect(installCommand).toBeDefined();

      // Verify warning about runtime installation and startup tip
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('s3fs not found'));
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('createMountableTemplate'));

      loggerWarnSpy.mockRestore();
      loggerInfoSpy.mockRestore();
    });

    it('gives helpful error if s3fs installation fails', async () => {
      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        // which s3fs returns not found
        if (cmd.includes('which s3fs')) {
          return Promise.resolve({ exitCode: 0, stdout: 'not found', stderr: '' });
        }

        // apt-get update succeeds
        if (cmd.includes('apt-get update')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }

        // apt-get install fails
        if (cmd.includes('apt-get install')) {
          return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'E: Unable to locate package s3fs' });
        }

        return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-s3',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        }),
      } as any;

      const result = await sandbox.mount(mockFilesystem, '/data/s3');

      // Should fail with helpful error message
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to install s3fs');
      // Should mention createMountableTemplate as a solution
      expect(result.error).toContain('createMountableTemplate');
    });

    it('skips installation if s3fs is already present', async () => {
      const commandsRun: string[] = [];

      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        commandsRun.push(cmd);

        // s3fs is already installed
        if (cmd.includes('which s3fs')) {
          return Promise.resolve({ exitCode: 0, stdout: '/usr/bin/s3fs', stderr: '' });
        }

        if (cmd.includes('id -u')) {
          return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
        }

        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-s3',
        name: 'S3Filesystem',
        provider: 's3',
        status: 'ready',
        getMountConfig: () => ({
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/s3');

      // apt-get install should NOT be called
      const installCommand = commandsRun.find(cmd => cmd.includes('apt-get install'));
      expect(installCommand).toBeUndefined();
    });
  });

  describe('GCS (gcsfuse)', () => {
    it('installs gcsfuse if not present', async () => {
      const commandsRun: string[] = [];

      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        commandsRun.push(cmd);

        // First 'which gcsfuse' returns not found, after install it's found
        if (cmd.includes('which gcsfuse')) {
          const alreadyInstalled = commandsRun.some(c => c.includes('apt-get install') && c.includes('gcsfuse'));
          if (alreadyInstalled) {
            return Promise.resolve({ exitCode: 0, stdout: '/usr/bin/gcsfuse', stderr: '' });
          }
          return Promise.resolve({ exitCode: 0, stdout: 'not found', stderr: '' });
        }

        // apt-get and other setup commands succeed
        if (cmd.includes('apt-get') || cmd.includes('tee') || cmd.includes('apt-key')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }

        if (cmd.includes('id -u')) {
          return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
        }

        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-gcs',
        name: 'GCSFilesystem',
        provider: 'gcs',
        status: 'ready',
        getMountConfig: () => ({
          type: 'gcs',
          bucket: 'test-bucket',
          serviceAccountKey: JSON.stringify({ type: 'service_account', project_id: 'test' }),
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/gcs');

      // Verify gcsfuse installation commands were run
      const installCommand = commandsRun.find(cmd => cmd.includes('apt-get install') && cmd.includes('gcsfuse'));
      expect(installCommand).toBeDefined();

      // Also verify the apt repo was added
      const repoCommand = commandsRun.find(cmd => cmd.includes('gcsfuse-jammy'));
      expect(repoCommand).toBeDefined();
    });

    it('skips installation if gcsfuse is already present', async () => {
      const commandsRun: string[] = [];

      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        commandsRun.push(cmd);

        // gcsfuse is already installed
        if (cmd.includes('which gcsfuse')) {
          return Promise.resolve({ exitCode: 0, stdout: '/usr/bin/gcsfuse', stderr: '' });
        }

        if (cmd.includes('id -u')) {
          return Promise.resolve({ exitCode: 0, stdout: '1000\n1000', stderr: '' });
        }

        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      const sandbox = new E2BSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-gcs',
        name: 'GCSFilesystem',
        provider: 'gcs',
        status: 'ready',
        getMountConfig: () => ({
          type: 'gcs',
          bucket: 'test-bucket',
          serviceAccountKey: JSON.stringify({ type: 'service_account', project_id: 'test' }),
        }),
      } as any;

      await sandbox.mount(mockFilesystem, '/data/gcs');

      // apt-get install should NOT be called
      const installCommand = commandsRun.find(cmd => cmd.includes('apt-get install'));
      expect(installCommand).toBeUndefined();
    });
  });
});

/**
 * Internal method tests
 *
 * Tests for private/internal methods that handle error detection,
 * state management, and retry logic.
 */
describe('E2BSandbox Internal Methods', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  describe('isSandboxDeadError()', () => {
    it('returns true for "sandbox was not found"', () => {
      const sandbox = new E2BSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox was not found'))).toBe(true);
    });

    it('returns true for "Sandbox is probably not running"', () => {
      const sandbox = new E2BSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox is probably not running'))).toBe(true);
    });

    it('returns true for "Sandbox not found"', () => {
      const sandbox = new E2BSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox not found'))).toBe(true);
    });

    it('returns true for "sandbox has been killed"', () => {
      const sandbox = new E2BSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox has been killed'))).toBe(true);
    });

    it('returns false for regular errors', () => {
      const sandbox = new E2BSandbox();
      expect((sandbox as any).isSandboxDeadError(new Error('timeout'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(new Error('command failed'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(new Error('port is not open'))).toBe(false);
    });

    it('returns false for null/undefined', () => {
      const sandbox = new E2BSandbox();
      expect((sandbox as any).isSandboxDeadError(null)).toBe(false);
      expect((sandbox as any).isSandboxDeadError(undefined)).toBe(false);
    });
  });

  describe('handleSandboxTimeout()', () => {
    it('clears sandbox instance and sets status to stopped', async () => {
      const sandbox = new E2BSandbox();
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
      const { Sandbox } = await import('e2b');
      const sandbox = new E2BSandbox();
      await sandbox._start();

      let callCount = 0;
      mockSandbox.commands.run.mockImplementation((_cmd: string, opts?: any) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('sandbox was not found');
        }
        const result = { exitCode: 0, stdout: 'ok', stderr: '' };
        if (opts?.background) {
          return Promise.resolve(createMockCommandHandle(result, opts));
        }
        return Promise.resolve(result);
      });

      const result = await sandbox.executeCommand('echo', ['test']);

      // Should succeed on retry (auto-restarts sandbox)
      expect(result.success).toBe(true);
      // betaCreate called once in initial start(), once in retry start()
      expect(Sandbox.betaCreate).toHaveBeenCalledTimes(2);
    });

    it('does not retry infinitely (only once)', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();

      // Always throw dead sandbox error
      mockSandbox.commands.run.mockImplementation(() => {
        throw new Error('sandbox was not found');
      });

      // Second attempt also fails — should throw (not retry forever)
      await expect(sandbox.executeCommand('echo', ['test'])).rejects.toThrow('sandbox was not found');
    });

    it('extracts result from E2B error object', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();

      // Simulate E2B error with embedded result — spawn throws with result attached
      const e2bError = Object.assign(new Error('Command failed'), {
        result: { exitCode: 127, stdout: '', stderr: 'command not found' },
      });
      mockSandbox.commands.run.mockImplementationOnce((_cmd: string, opts?: any) => {
        if (opts?.background) {
          // E2B handle.wait() rejects with the error
          const handle = createMockCommandHandle({ exitCode: 0, stdout: '', stderr: '' }, opts);
          handle.wait.mockRejectedValue(e2bError);
          return Promise.resolve(handle);
        }
        return Promise.reject(e2bError);
      });

      const result = await sandbox.executeCommand('nonexistent');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('command not found');
    });
  });

  describe('mount() unsupported type', () => {
    it('returns failure for unsupported mount config type', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();

      const mockFilesystem = {
        id: 'test-unknown',
        name: 'UnknownFS',
        provider: 'unknown',
        status: 'ready',
        getMountConfig: () => ({ type: 'ftp', bucket: 'test' }),
      } as any;

      mockSandbox.commands.run.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });

      const result = await sandbox.mount(mockFilesystem, '/data/ftp');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported mount type');
      expect(result.error).toContain('ftp');
    });
  });

  describe('mount() non-empty directory safety check', () => {
    it('rejects mounting to non-empty directory', async () => {
      const sandbox = new E2BSandbox();
      await sandbox._start();

      mockSandbox.commands.run.mockImplementation((cmd: string) => {
        // Safety check: directory exists and is non-empty
        if (cmd.includes('ls -A')) {
          return Promise.resolve({ exitCode: 0, stdout: 'non-empty', stderr: '' });
        }
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
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
    });
  });
});

/**
 * Self-hosted connection options tests
 */
describe('E2BSandbox Self-Hosted Connection Options', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetMockDefaults();
  });

  it('forwards domain/apiUrl/apiKey/accessToken to Sandbox.betaCreate', async () => {
    const { Sandbox } = await import('e2b');
    const sandbox = new E2BSandbox({
      domain: 'custom.dev',
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      accessToken: 'test-token',
    });

    await sandbox._start();

    expect(Sandbox.betaCreate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        domain: 'custom.dev',
        apiUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        accessToken: 'test-token',
      }),
    );
  });

  it('forwards connection opts to Sandbox.list', async () => {
    const { Sandbox } = await import('e2b');
    const sandbox = new E2BSandbox({
      domain: 'custom.dev',
      apiKey: 'test-key',
    });

    await sandbox._start();

    expect(Sandbox.list).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'custom.dev',
        apiKey: 'test-key',
      }),
    );
  });

  it('forwards connection opts to Sandbox.connect', async () => {
    const { Sandbox } = await import('e2b');

    // Mock finding existing sandbox so connect is called
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([{ sandboxId: 'existing-sandbox', state: 'running' }]),
    });

    const sandbox = new E2BSandbox({
      id: 'connect-test',
      domain: 'custom.dev',
      apiKey: 'test-key',
    });

    await sandbox._start();

    expect(Sandbox.connect).toHaveBeenCalledWith(
      'existing-sandbox',
      expect.objectContaining({
        domain: 'custom.dev',
        apiKey: 'test-key',
      }),
    );

    // Reset mock
    (Sandbox.list as any).mockReturnValue({
      nextItems: vi.fn().mockResolvedValue([]),
    });
  });

  it('forwards connection opts to Template.exists and Template.build', async () => {
    const { Template } = await import('e2b');

    // Template.exists returns false so build is called
    (Template.exists as any).mockResolvedValue(false);

    const sandbox = new E2BSandbox({
      domain: 'custom.dev',
      apiKey: 'test-key',
    });

    await sandbox._start();

    expect(Template.exists).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        domain: 'custom.dev',
        apiKey: 'test-key',
      }),
    );

    expect(Template.build).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({
        domain: 'custom.dev',
        apiKey: 'test-key',
      }),
    );
  });

  it('omits connection opts when not configured', async () => {
    const { Sandbox, Template } = await import('e2b');

    (Template.exists as any).mockResolvedValue(false);

    const sandbox = new E2BSandbox();
    await sandbox._start();

    // betaCreate should not contain domain/apiUrl/apiKey/accessToken
    const betaCreateOpts = (Sandbox.betaCreate as any).mock.calls[0][1];
    expect(betaCreateOpts).not.toHaveProperty('domain');
    expect(betaCreateOpts).not.toHaveProperty('apiUrl');
    expect(betaCreateOpts).not.toHaveProperty('apiKey');
    expect(betaCreateOpts).not.toHaveProperty('accessToken');

    // list should not contain connection opts
    const listOpts = (Sandbox.list as any).mock.calls[0][0];
    expect(listOpts).not.toHaveProperty('domain');
    expect(listOpts).not.toHaveProperty('apiUrl');
    expect(listOpts).not.toHaveProperty('apiKey');
    expect(listOpts).not.toHaveProperty('accessToken');
  });
});

/**
 * Shared conformance tests from _test-utils.
 * These validate that E2BSandbox conforms to the WorkspaceSandbox contract.
 */
describe('E2BSandbox Shared Conformance', () => {
  let sandbox: E2BSandbox;

  beforeAll(async () => {
    sandbox = new E2BSandbox({ id: `conformance-${Date.now()}` });
    await sandbox._start();
  });

  afterAll(async () => {
    if (sandbox?.destroy) await sandbox._destroy();
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
    createSandbox: () => new E2BSandbox(),
  });

  createSandboxLifecycleTests(getContext);
  createMountOperationsTests(getContext);
});
