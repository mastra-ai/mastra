import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { IMastraLogger } from '../logger';
import { Mastra } from '../mastra';
import { LocalFilesystem } from './filesystem';
import type {
  FileStat,
  FileEntry,
  FileContent,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';
import { MastraFilesystem } from './filesystem/mastra-filesystem';
import type { ProviderStatus } from './lifecycle';
import { LocalSandbox } from './sandbox';
import type { CommandResult, ExecuteCommandOptions, SandboxInfo } from './sandbox';
import { MastraSandbox } from './sandbox/mastra-sandbox';
import { Workspace } from './workspace';

// =============================================================================
// Mock Logger
// =============================================================================

function createMockLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: vi.fn().mockReturnValue(new Map()),
    listLogs: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
    listLogsByRunId: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
  };
}

// =============================================================================
// Test Implementations
// =============================================================================

class TestFilesystem extends MastraFilesystem {
  readonly id = 'test-fs';
  readonly name = 'TestFilesystem';
  readonly provider = 'test';
  status: ProviderStatus = 'stopped';

  constructor() {
    super({ name: 'TestFilesystem' });
  }

  async readFile(_path: string, _options?: ReadOptions): Promise<string | Buffer> {
    this.logger.debug('TestFilesystem.readFile called');
    return 'test content';
  }

  async writeFile(_path: string, _content: FileContent, _options?: WriteOptions): Promise<void> {
    this.logger.debug('TestFilesystem.writeFile called');
  }

  async appendFile(_path: string, _content: FileContent): Promise<void> {
    this.logger.debug('TestFilesystem.appendFile called');
  }

  async deleteFile(_path: string, _options?: RemoveOptions): Promise<void> {
    this.logger.debug('TestFilesystem.deleteFile called');
  }

  async copyFile(_src: string, _dest: string, _options?: CopyOptions): Promise<void> {
    this.logger.debug('TestFilesystem.copyFile called');
  }

  async moveFile(_src: string, _dest: string, _options?: CopyOptions): Promise<void> {
    this.logger.debug('TestFilesystem.moveFile called');
  }

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.logger.debug('TestFilesystem.mkdir called');
  }

  async rmdir(_path: string, _options?: RemoveOptions): Promise<void> {
    this.logger.debug('TestFilesystem.rmdir called');
  }

  async readdir(_path: string, _options?: ListOptions): Promise<FileEntry[]> {
    this.logger.debug('TestFilesystem.readdir called');
    return [];
  }

  async exists(_path: string): Promise<boolean> {
    this.logger.debug('TestFilesystem.exists called');
    return true;
  }

  async stat(_path: string): Promise<FileStat> {
    this.logger.debug('TestFilesystem.stat called');
    return {
      name: 'test',
      path: '/test',
      type: 'file',
      size: 0,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
  }

  async init(): Promise<void> {
    this.logger.debug('TestFilesystem.init called');
    this.status = 'running';
  }

  // Expose logger for testing
  getLogger(): IMastraLogger {
    return this.logger;
  }
}

class TestSandbox extends MastraSandbox {
  readonly id = 'test-sandbox';
  readonly name = 'TestSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'stopped';

  constructor() {
    super({ name: 'TestSandbox' });
  }

  async executeCommand(_command: string, _args?: string[], _options?: ExecuteCommandOptions): Promise<CommandResult> {
    this.logger.debug('TestSandbox.executeCommand called');
    return {
      success: true,
      exitCode: 0,
      stdout: 'test output',
      stderr: '',
      executionTimeMs: 100,
    };
  }

  async start(): Promise<void> {
    this.logger.debug('TestSandbox.start called');
    this.status = 'running';
  }

  async stop(): Promise<void> {
    this.logger.debug('TestSandbox.stop called');
    this.status = 'stopped';
  }

  async destroy(): Promise<void> {
    this.logger.debug('TestSandbox.destroy called');
    this.status = 'destroyed';
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: new Date(),
    };
  }

  // Expose logger for testing
  getLogger(): IMastraLogger {
    return this.logger;
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Workspace Logger Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-logger-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // Workspace.__setLogger
  // ===========================================================================
  describe('Workspace.__setLogger', () => {
    it('should propagate logger to filesystem provider', () => {
      const mockLogger = createMockLogger();
      const filesystem = new TestFilesystem();
      const workspace = new Workspace({ filesystem });

      workspace.__setLogger(mockLogger);

      // Verify logger was propagated
      expect(filesystem.getLogger()).toBe(mockLogger);
    });

    it('should propagate logger to sandbox provider', () => {
      const mockLogger = createMockLogger();
      const sandbox = new TestSandbox();
      const workspace = new Workspace({ sandbox });

      workspace.__setLogger(mockLogger);

      // Verify logger was propagated
      expect(sandbox.getLogger()).toBe(mockLogger);
    });

    it('should propagate logger to both filesystem and sandbox', () => {
      const mockLogger = createMockLogger();
      const filesystem = new TestFilesystem();
      const sandbox = new TestSandbox();
      const workspace = new Workspace({ filesystem, sandbox });

      workspace.__setLogger(mockLogger);

      // Verify logger was propagated to both
      expect(filesystem.getLogger()).toBe(mockLogger);
      expect(sandbox.getLogger()).toBe(mockLogger);
    });

    it('should not fail when filesystem does not have __setLogger', () => {
      const mockLogger = createMockLogger();
      // Create a minimal filesystem without __setLogger
      const minimalFilesystem = {
        id: 'minimal',
        name: 'Minimal',
        provider: 'minimal',
        status: 'running' as ProviderStatus,
        readFile: vi.fn().mockResolvedValue('content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        appendFile: vi.fn().mockResolvedValue(undefined),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined),
        moveFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
        rmdir: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue([]),
        exists: vi.fn().mockResolvedValue(true),
        stat: vi.fn().mockResolvedValue({}),
      };

      const workspace = new Workspace({ filesystem: minimalFilesystem as any });

      // Should not throw
      expect(() => workspace.__setLogger(mockLogger)).not.toThrow();
    });

    it('should not fail when sandbox does not have __setLogger', () => {
      const mockLogger = createMockLogger();
      // Create a minimal sandbox without __setLogger
      const minimalSandbox = {
        id: 'minimal',
        name: 'Minimal',
        provider: 'minimal',
        status: 'running' as ProviderStatus,
        executeCommand: vi
          .fn()
          .mockResolvedValue({ success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 }),
      };

      const workspace = new Workspace({ sandbox: minimalSandbox as any });

      // Should not throw
      expect(() => workspace.__setLogger(mockLogger)).not.toThrow();
    });
  });

  // ===========================================================================
  // MastraFilesystem base class
  // ===========================================================================
  describe('MastraFilesystem', () => {
    it('should have default logger from MastraBase', () => {
      const filesystem = new TestFilesystem();

      // Should have a default ConsoleLogger from MastraBase
      expect(filesystem.getLogger()).toBeDefined();
      expect(filesystem.getLogger().debug).toBeDefined();
    });

    it('should allow setting logger via __setLogger', () => {
      const mockLogger = createMockLogger();
      const filesystem = new TestFilesystem();

      filesystem.__setLogger(mockLogger);

      expect(filesystem.getLogger()).toBe(mockLogger);
    });

    it('should use the set logger in operations', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new TestFilesystem();
      filesystem.__setLogger(mockLogger);

      await filesystem.readFile('/test.txt');

      expect(mockLogger.debug).toHaveBeenCalledWith('TestFilesystem.readFile called');
    });
  });

  // ===========================================================================
  // MastraSandbox base class
  // ===========================================================================
  describe('MastraSandbox', () => {
    it('should propagate logger to MountManager when mount() is implemented', () => {
      // Create a sandbox with mount() implemented
      class MountingSandbox extends MastraSandbox {
        readonly id = 'mounting-sandbox';
        readonly name = 'MountingSandbox';
        readonly provider = 'test';
        status: ProviderStatus = 'pending';

        constructor() {
          super({ name: 'MountingSandbox' });
        }

        async mount(): Promise<{ success: boolean; mountPath: string }> {
          return { success: true, mountPath: '/test' };
        }

        async executeCommand(): Promise<CommandResult> {
          return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 };
        }
      }

      const mockLogger = createMockLogger();
      const sandbox = new MountingSandbox();

      // MountManager should exist
      expect(sandbox.mounts).toBeDefined();

      // Spy on MountManager's __setLogger
      const mountsSetLoggerSpy = vi.spyOn(sandbox.mounts!, '__setLogger');

      // Set logger on sandbox
      sandbox.__setLogger(mockLogger);

      // Verify logger was propagated to MountManager
      expect(mountsSetLoggerSpy).toHaveBeenCalledWith(mockLogger);
    });

    it('should not create MountManager if mount() not implemented', () => {
      // TestSandbox does not implement mount()
      const sandbox = new TestSandbox();

      // MountManager should NOT exist
      expect(sandbox.mounts).toBeUndefined();
    });

    it('should have default logger from MastraBase', () => {
      const sandbox = new TestSandbox();

      // Should have a default ConsoleLogger from MastraBase
      expect(sandbox.getLogger()).toBeDefined();
      expect(sandbox.getLogger().debug).toBeDefined();
    });

    it('should allow setting logger via __setLogger', () => {
      const mockLogger = createMockLogger();
      const sandbox = new TestSandbox();

      sandbox.__setLogger(mockLogger);

      expect(sandbox.getLogger()).toBe(mockLogger);
    });

    it('should use the set logger in operations', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new TestSandbox();
      sandbox.__setLogger(mockLogger);

      await sandbox.executeCommand!('echo', ['hello']);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestSandbox.executeCommand called');
    });
  });

  // ===========================================================================
  // LocalFilesystem logging
  // ===========================================================================
  describe('LocalFilesystem logging', () => {
    it('should log when initializing', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      filesystem.__setLogger(mockLogger);

      await filesystem._init();

      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing filesystem', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('Filesystem initialized', expect.any(Object));
    });

    it('should log when reading file', async () => {
      const mockLogger = createMockLogger();
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      filesystem.__setLogger(mockLogger);

      await filesystem.readFile('/test.txt');

      expect(mockLogger.debug).toHaveBeenCalledWith('Reading file', expect.objectContaining({ path: '/test.txt' }));
    });

    it('should log when writing file', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      filesystem.__setLogger(mockLogger);

      await filesystem.writeFile('/test.txt', 'hello world');

      expect(mockLogger.debug).toHaveBeenCalledWith('Writing file', expect.objectContaining({ path: '/test.txt' }));
    });

    it('should log when deleting file', async () => {
      const mockLogger = createMockLogger();
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello');

      const filesystem = new LocalFilesystem({ basePath: tempDir });
      filesystem.__setLogger(mockLogger);

      await filesystem.deleteFile('/test.txt');

      expect(mockLogger.debug).toHaveBeenCalledWith('Deleting file', expect.objectContaining({ path: '/test.txt' }));
    });

    it('should log when creating directory', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      filesystem.__setLogger(mockLogger);

      await filesystem.mkdir('/newdir');

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating directory', expect.objectContaining({ path: '/newdir' }));
    });

    it('should log when reading directory', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      filesystem.__setLogger(mockLogger);

      await filesystem.readdir('/');

      expect(mockLogger.debug).toHaveBeenCalledWith('Reading directory', expect.objectContaining({ path: '/' }));
    });

    it('should log errors on init failure', async () => {
      const mockLogger = createMockLogger();
      // Use a path with null byte - universally invalid on all platforms
      const filesystem = new LocalFilesystem({ basePath: '/invalid\x00path' });
      filesystem.__setLogger(mockLogger);

      await expect(filesystem._init()).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize filesystem', expect.any(Object));
    });
  });

  // ===========================================================================
  // LocalSandbox logging
  // ===========================================================================
  describe('LocalSandbox logging', () => {
    it('should log when starting', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      sandbox.__setLogger(mockLogger);

      await sandbox._start();

      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Starting sandbox', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Sandbox started', expect.any(Object));

      await sandbox._destroy();
    });

    it('should log when stopping', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      sandbox.__setLogger(mockLogger);

      await sandbox._start();
      await sandbox._stop();

      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Stopping sandbox', expect.any(Object));

      await sandbox._destroy();
    });

    it('should log when destroying', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      sandbox.__setLogger(mockLogger);

      await sandbox._start();
      await sandbox._destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Destroying sandbox', expect.any(Object));
    });

    it('should log when executing command', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
      sandbox.__setLogger(mockLogger);

      const result = await sandbox.executeCommand!('echo', ['hello']);

      expect(result.success).toBe(true);
      // Base class fallback logs: "[LocalSandbox] Executing: echo hello"
      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Executing: echo hello', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[LocalSandbox] Exit code: 0'));

      await sandbox._destroy();
    });

    it('should log when command fails', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
      sandbox.__setLogger(mockLogger);

      const result = await sandbox.executeCommand!('nonexistent-command-xyz', []);

      expect(result.success).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[LocalSandbox] Executing:'),
        expect.any(Object),
      );
      // With shell: true, the shell handles the missing command and returns
      // a non-zero exit code (127) rather than throwing ENOENT, so the
      // command completes normally (debug log) rather than erroring.
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[LocalSandbox] Exit code:'));
      expect(mockLogger.error).not.toHaveBeenCalled();

      await sandbox._destroy();
    });
  });

  // ===========================================================================
  // Integration: Workspace with real providers
  // ===========================================================================
  describe('Integration: Workspace with real providers', () => {
    it('should propagate logger through workspace lifecycle', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });

      const workspace = new Workspace({ filesystem, sandbox });
      workspace.__setLogger(mockLogger);

      // Init should trigger filesystem init and sandbox start
      await workspace.init();

      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing filesystem', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Starting sandbox', expect.any(Object));

      // Filesystem operations should log
      await workspace.filesystem!.writeFile('/test.txt', 'hello');
      expect(mockLogger.debug).toHaveBeenCalledWith('Writing file', expect.any(Object));

      // Sandbox operations should log
      const result = await workspace.sandbox!.executeCommand!('echo', ['hello']);
      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[LocalSandbox] Executing:'),
        expect.any(Object),
      );

      await workspace.destroy();
    });
  });

  // ===========================================================================
  // Integration: Agent with Workspace
  // ===========================================================================
  describe('Integration: Agent with Workspace', () => {
    it('should propagate logger from Mastra to Agent to Workspace', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      // Create agent with workspace
      const { Agent } = await import('../agent');
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'Test agent',
        model: { provider: 'OPEN_AI', name: 'gpt-4o' },
        workspace,
      });

      // Register agent with Mastra (triggers logger propagation)
      new Mastra({
        logger: mockLogger,
        agents: { 'test-agent': agent },
      });

      // Get workspace from agent - should have received logger
      const agentWorkspace = await agent.getWorkspace();
      expect(agentWorkspace).toBe(workspace);

      // Init and verify logger propagated
      await agentWorkspace!.init();

      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing filesystem', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Starting sandbox', expect.any(Object));

      await agentWorkspace!.destroy();
    });

    it('should propagate logger to workspace factory results', async () => {
      const mockLogger = createMockLogger();

      // Create a workspace factory that creates new workspace each time
      const workspaceFactory = () => {
        const filesystem = new LocalFilesystem({ basePath: tempDir });
        return new Workspace({ filesystem });
      };

      // Create agent with workspace factory
      const { Agent } = await import('../agent');
      const agent = new Agent({
        name: 'factory-agent',
        instructions: 'Test agent with factory',
        model: { provider: 'OPEN_AI', name: 'gpt-4o' },
        workspace: workspaceFactory,
      });

      // Register agent with Mastra (triggers logger propagation)
      new Mastra({
        logger: mockLogger,
        agents: { 'factory-agent': agent },
      });

      // Get workspace from agent - factory workspaces receive logger at resolve time
      const workspace1 = await agent.getWorkspace();
      expect(workspace1).toBeDefined();

      // Logger should be propagated to the factory-resolved workspace
      const fs = workspace1!.filesystem;
      expect(fs).toBeDefined();
      expect('__setLogger' in fs!).toBe(true);

      // The filesystem should have received the logger via workspace.__setLogger
      // Trigger a log to verify propagation
      (fs as any).logger?.debug?.('factory-logger-test');
      expect(mockLogger.debug).toHaveBeenCalledWith('factory-logger-test');

      await workspace1!.destroy();
    });
  });

  // ===========================================================================
  // Integration: Mastra with Workspace (full cascade)
  // ===========================================================================
  describe('Integration: Mastra with Workspace', () => {
    it('should propagate logger from Mastra to workspace providers', async () => {
      const mockLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      const workspace = new Workspace({ filesystem, sandbox });

      const mastra = new Mastra({
        logger: mockLogger,
        workspace,
      });

      // Get the workspace from mastra
      const mastraWorkspace = mastra.getWorkspace();
      expect(mastraWorkspace).toBe(workspace);

      // Init the workspace - should use the logger from Mastra
      await mastraWorkspace!.init();

      // Verify logger was propagated through Mastra → Workspace → Providers
      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing filesystem', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('[LocalSandbox] Starting sandbox', expect.any(Object));

      // Filesystem operations should use the Mastra logger
      await mastraWorkspace!.filesystem!.writeFile('/mastra-test.txt', 'hello from mastra');
      expect(mockLogger.debug).toHaveBeenCalledWith('Writing file', expect.any(Object));

      // Sandbox operations should use the Mastra logger
      const result = await mastraWorkspace!.sandbox!.executeCommand!('echo', ['mastra']);
      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[LocalSandbox] Executing:'),
        expect.any(Object),
      );

      await mastraWorkspace!.destroy();
    });

    it('should propagate logger when calling setLogger after construction', async () => {
      const initialLogger = createMockLogger();
      const newLogger = createMockLogger();
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });

      const mastra = new Mastra({
        logger: initialLogger,
        workspace,
      });

      // Change the logger
      mastra.setLogger({ logger: newLogger });

      // Init should use the new logger
      await mastra.getWorkspace()!.init();

      // The new logger should have received the calls, not the initial one
      expect(newLogger.debug).toHaveBeenCalledWith('Initializing filesystem', expect.any(Object));
      expect(initialLogger.debug).not.toHaveBeenCalledWith('Initializing filesystem', expect.any(Object));

      await mastra.getWorkspace()!.destroy();
    });
  });
});

// =============================================================================
// MastraSandbox Base Class Lifecycle Error Paths
// =============================================================================

/**
 * A sandbox that uses the base class lifecycle properly
 * (overrides start/stop/destroy, wrapper is _start/_stop/_destroy).
 */
class LifecycleTestSandbox extends MastraSandbox {
  readonly id = 'lifecycle-test';
  readonly name = 'LifecycleTestSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  doStartFn = vi.fn();
  doStopFn = vi.fn();
  doDestroyFn = vi.fn();

  constructor() {
    super({ name: 'LifecycleTestSandbox' });
  }

  async start(): Promise<void> {
    await this.doStartFn();
  }

  async stop(): Promise<void> {
    await this.doStopFn();
  }

  async destroy(): Promise<void> {
    await this.doDestroyFn();
  }

  async executeCommand(): Promise<CommandResult> {
    return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 };
  }

  async getInfo(): Promise<SandboxInfo> {
    return { id: this.id, name: this.name, provider: this.provider, status: this.status, createdAt: new Date() };
  }
}

describe('MastraSandbox Base Class Lifecycle', () => {
  describe('_start() status transitions', () => {
    it('sets status to running on success', async () => {
      const sandbox = new LifecycleTestSandbox();

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });

    it('sets status to error when start() throws', async () => {
      const sandbox = new LifecycleTestSandbox();
      sandbox.doStartFn.mockRejectedValueOnce(new Error('Start failed'));

      await expect(sandbox._start()).rejects.toThrow('Start failed');

      expect(sandbox.status).toBe('error');
    });

    it('concurrent _start() calls return same promise', async () => {
      const sandbox = new LifecycleTestSandbox();
      sandbox.doStartFn.mockImplementation(() => new Promise(r => setTimeout(r, 10)));

      await Promise.all([sandbox._start(), sandbox._start(), sandbox._start()]);

      expect(sandbox.doStartFn).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already running', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();

      await sandbox._start(); // Should no-op

      expect(sandbox.doStartFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('_stop() status transitions', () => {
    it('sets status to stopped on success', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();

      await sandbox._stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('sets status to error when stop() throws', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();
      sandbox.doStopFn.mockRejectedValueOnce(new Error('Stop failed'));

      await expect(sandbox._stop()).rejects.toThrow('Stop failed');

      expect(sandbox.status).toBe('error');
    });

    it('concurrent _stop() calls return same promise', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();
      sandbox.doStopFn.mockImplementation(() => new Promise(r => setTimeout(r, 10)));

      await Promise.all([sandbox._stop(), sandbox._stop(), sandbox._stop()]);

      expect(sandbox.doStopFn).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already stopped', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();
      await sandbox._stop();

      await sandbox._stop(); // Should no-op

      expect(sandbox.doStopFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('_destroy() status transitions', () => {
    it('sets status to destroyed on success', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();

      await sandbox._destroy();

      expect(sandbox.status).toBe('destroyed');
    });

    it('sets status to error when destroy() throws', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();
      sandbox.doDestroyFn.mockRejectedValueOnce(new Error('Destroy failed'));

      await expect(sandbox._destroy()).rejects.toThrow('Destroy failed');

      expect(sandbox.status).toBe('error');
    });

    it('concurrent _destroy() calls return same promise', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();
      sandbox.doDestroyFn.mockImplementation(() => new Promise(r => setTimeout(r, 10)));

      await Promise.all([sandbox._destroy(), sandbox._destroy(), sandbox._destroy()]);

      expect(sandbox.doDestroyFn).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already destroyed', async () => {
      const sandbox = new LifecycleTestSandbox();
      await sandbox._start();
      await sandbox._destroy();

      await sandbox._destroy(); // Should no-op

      expect(sandbox.doDestroyFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureRunning()', () => {
    it('auto-starts if not running', async () => {
      const sandbox = new LifecycleTestSandbox();

      await (sandbox as any).ensureRunning();

      expect(sandbox.status).toBe('running');
      expect(sandbox.doStartFn).toHaveBeenCalledTimes(1);
    });

    it('propagates start error when start() fails', async () => {
      const sandbox = new LifecycleTestSandbox();
      sandbox.doStartFn.mockRejectedValue(new Error('Start failed'));

      await expect((sandbox as any).ensureRunning()).rejects.toThrow('Start failed');
      expect(sandbox.status).toBe('error');
    });

    it('_startPromise is cleared after error so retry is possible', async () => {
      const sandbox = new LifecycleTestSandbox();
      let shouldFail = true;
      sandbox.doStartFn.mockImplementation(async () => {
        if (shouldFail) throw new Error('Start failed');
      });

      // First start fails
      await expect(sandbox._start()).rejects.toThrow('Start failed');
      expect(sandbox.status).toBe('error');

      // Fix the issue and retry
      shouldFail = false;
      await sandbox._start();
      expect(sandbox.status).toBe('running');
    });
  });
});
