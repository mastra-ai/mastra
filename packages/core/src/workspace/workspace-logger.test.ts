import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { IMastraLogger } from '../logger';
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
  override readonly name = 'TestFilesystem';
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

  override async init(): Promise<void> {
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
  override readonly name = 'TestSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'stopped';

  constructor() {
    super({ name: 'TestSandbox' });
  }

  override async executeCommand(
    _command: string,
    _args?: string[],
    _options?: ExecuteCommandOptions,
  ): Promise<CommandResult> {
    this.logger.debug('TestSandbox.executeCommand called');
    return {
      success: true,
      exitCode: 0,
      stdout: 'test output',
      stderr: '',
      executionTimeMs: 100,
    };
  }

  override async start(): Promise<void> {
    this.logger.debug('TestSandbox.start called');
    this.status = 'running';
  }

  override async stop(): Promise<void> {
    this.logger.debug('TestSandbox.stop called');
    this.status = 'stopped';
  }

  override async destroy(): Promise<void> {
    this.logger.debug('TestSandbox.destroy called');
    this.status = 'destroyed';
  }

  override async getInfo(): Promise<SandboxInfo> {
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

      await filesystem.init();

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
      // Use a path that will fail (nested under a non-existent read-only path)
      const filesystem = new LocalFilesystem({ basePath: '/root/nonexistent/path' });
      filesystem.__setLogger(mockLogger);

      await expect(filesystem.init()).rejects.toThrow();

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

      await sandbox.start();

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting sandbox', expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith('Sandbox started', expect.any(Object));

      await sandbox.destroy();
    });

    it('should log when stopping', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      sandbox.__setLogger(mockLogger);

      await sandbox.start();
      await sandbox.stop();

      expect(mockLogger.debug).toHaveBeenCalledWith('Stopping sandbox', expect.any(Object));

      await sandbox.destroy();
    });

    it('should log when destroying', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir });
      sandbox.__setLogger(mockLogger);

      await sandbox.start();
      await sandbox.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith('Destroying sandbox', expect.any(Object));
    });

    it('should log when executing command', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
      sandbox.__setLogger(mockLogger);

      const result = await sandbox.executeCommand!('echo', ['hello']);

      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing command', expect.objectContaining({ command: 'echo' }));
      expect(mockLogger.info).toHaveBeenCalledWith('Command completed', expect.any(Object));

      await sandbox.destroy();
    });

    it('should log when command fails', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new LocalSandbox({ workingDirectory: tempDir, env: process.env });
      sandbox.__setLogger(mockLogger);

      const result = await sandbox.executeCommand!('nonexistent-command-xyz', []);

      expect(result.success).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing command', expect.any(Object));
      expect(mockLogger.error).toHaveBeenCalledWith('Command failed', expect.any(Object));

      await sandbox.destroy();
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
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting sandbox', expect.any(Object));

      // Filesystem operations should log
      await workspace.filesystem!.writeFile('/test.txt', 'hello');
      expect(mockLogger.debug).toHaveBeenCalledWith('Writing file', expect.any(Object));

      // Sandbox operations should log
      const result = await workspace.sandbox!.executeCommand!('echo', ['hello']);
      expect(result.success).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Executing command', expect.any(Object));

      await workspace.destroy();
    });
  });
});
