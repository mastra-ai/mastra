import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { WorkspaceFilesystem, FileEntry } from './filesystem';
import type { WorkspaceSandbox, CodeResult, CommandResult } from './sandbox';
import {
  Workspace,
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
} from './workspace';

// =============================================================================
// Mock Implementations
// =============================================================================

function createMockFilesystem(files: Map<string, string | Buffer> = new Map()): WorkspaceFilesystem {
  const dirs = new Set<string>(['/']);

  return {
    provider: 'mock',

    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`File not found: ${path}`);
      }
      return files.get(path)!;
    }),

    writeFile: vi.fn().mockImplementation(async (path: string, content: string | Buffer) => {
      files.set(path, content);
      // Ensure parent directories exist
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current += '/' + parts[i];
        dirs.add(current);
      }
    }),

    readdir: vi.fn().mockImplementation(async (path: string): Promise<FileEntry[]> => {
      const entries: FileEntry[] = [];
      const normalizedPath = path === '/' ? '' : path;

      for (const [filePath] of files) {
        if (filePath.startsWith(normalizedPath + '/')) {
          const rest = filePath.slice(normalizedPath.length + 1);
          const parts = rest.split('/');
          if (parts.length === 1) {
            entries.push({
              name: parts[0],
              path: filePath,
              type: 'file',
            });
          }
        }
      }

      for (const dir of dirs) {
        if (dir !== path && dir.startsWith(normalizedPath + '/')) {
          const rest = dir.slice(normalizedPath.length + 1);
          const parts = rest.split('/');
          if (parts.length === 1 && !entries.some(e => e.name === parts[0])) {
            entries.push({
              name: parts[0],
              path: dir,
              type: 'directory',
            });
          }
        }
      }

      return entries;
    }),

    exists: vi.fn().mockImplementation(async (path: string) => {
      return files.has(path) || dirs.has(path);
    }),

    mkdir: vi.fn().mockImplementation(async (path: string) => {
      dirs.add(path);
    }),

    deleteFile: vi.fn().mockImplementation(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`File not found: ${path}`);
      }
      files.delete(path);
    }),

    rmdir: vi.fn().mockImplementation(async (path: string) => {
      dirs.delete(path);
      // Delete files in dir
      for (const [filePath] of files) {
        if (filePath.startsWith(path + '/')) {
          files.delete(filePath);
        }
      }
    }),

    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSandbox(): WorkspaceSandbox {
  const sandboxFiles = new Map<string, string | Buffer>();

  return {
    provider: 'mock-sandbox',
    supportedRuntimes: ['node', 'python', 'bash'] as const,

    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),

    executeCode: vi.fn().mockImplementation(async (code: string): Promise<CodeResult> => {
      return {
        success: true,
        stdout: `Executed: ${code.slice(0, 20)}...`,
        stderr: '',
        exitCode: 0,
      };
    }),

    executeCommand: vi.fn().mockImplementation(async (command: string): Promise<CommandResult> => {
      return {
        success: true,
        stdout: `Command executed: ${command}`,
        stderr: '',
        exitCode: 0,
      };
    }),

    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (!sandboxFiles.has(path)) {
        throw new Error(`File not found in sandbox: ${path}`);
      }
      return sandboxFiles.get(path)!.toString();
    }),

    writeFile: vi.fn().mockImplementation(async (path: string, content: string | Buffer) => {
      sandboxFiles.set(path, content);
    }),

    listFiles: vi.fn().mockImplementation(async () => {
      return Array.from(sandboxFiles.keys());
    }),

    getInfo: vi.fn().mockResolvedValue({
      status: 'running',
      resources: {
        memoryMB: 512,
        cpuCores: 2,
      },
    }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Workspace', () => {
  let mockFs: WorkspaceFilesystem;
  let mockSandbox: WorkspaceSandbox;

  beforeEach(() => {
    mockFs = createMockFilesystem();
    mockSandbox = createMockSandbox();
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================
  describe('constructor', () => {
    it('should create workspace with filesystem only', () => {
      const workspace = new Workspace({ filesystem: mockFs });

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toContain('workspace-');
      expect(workspace.status).toBe('pending');
      expect(workspace.filesystem).toBe(mockFs);
      expect(workspace.sandbox).toBeUndefined();
    });

    it('should create workspace with sandbox only', () => {
      const workspace = new Workspace({ sandbox: mockSandbox });

      expect(workspace.sandbox).toBe(mockSandbox);
      expect(workspace.filesystem).toBeUndefined();
    });

    it('should create workspace with both filesystem and sandbox', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      expect(workspace.filesystem).toBe(mockFs);
      expect(workspace.sandbox).toBe(mockSandbox);
    });

    it('should accept custom id and name', () => {
      const workspace = new Workspace({
        id: 'custom-id',
        name: 'Custom Workspace',
        filesystem: mockFs,
      });

      expect(workspace.id).toBe('custom-id');
      expect(workspace.name).toBe('Custom Workspace');
    });

    it('should throw when neither filesystem nor sandbox provided', () => {
      expect(() => new Workspace({})).toThrow('Workspace requires at least a filesystem or sandbox provider');
    });

    it('should auto-initialize when autoInit is true', async () => {
      const _workspace = new Workspace({
        filesystem: mockFs,
        autoInit: true,
      });

      // Give time for async init
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFs.init).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // File Operations
  // ===========================================================================
  describe('file operations', () => {
    let workspace: Workspace;

    beforeEach(() => {
      workspace = new Workspace({ filesystem: mockFs });
    });

    it('should read file from filesystem', async () => {
      const files = new Map<string, string>([['/test.txt', 'Hello World']]);
      mockFs = createMockFilesystem(files);
      workspace = new Workspace({ filesystem: mockFs });

      const content = await workspace.readFile('/test.txt');
      expect(content).toBe('Hello World');
      expect(mockFs.readFile).toHaveBeenCalledWith('/test.txt', undefined);
    });

    it('should write file to filesystem', async () => {
      await workspace.writeFile('/test.txt', 'Hello World');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/test.txt', 'Hello World', undefined);
    });

    it('should list directory contents', async () => {
      const files = new Map<string, string>([['/dir/file.txt', 'content']]);
      mockFs = createMockFilesystem(files);
      workspace = new Workspace({ filesystem: mockFs });

      await workspace.readdir('/dir');
      expect(mockFs.readdir).toHaveBeenCalledWith('/dir', undefined);
    });

    it('should check if path exists', async () => {
      const files = new Map<string, string>([['/exists.txt', 'content']]);
      mockFs = createMockFilesystem(files);
      workspace = new Workspace({ filesystem: mockFs });

      const exists = await workspace.exists('/exists.txt');
      expect(exists).toBe(true);
    });

    it('should update lastAccessedAt on file operations', async () => {
      const initialAccess = workspace.lastAccessedAt;
      await new Promise(resolve => setTimeout(resolve, 5));

      await workspace.writeFile('/test.txt', 'content');
      expect(workspace.lastAccessedAt.getTime()).toBeGreaterThan(initialAccess.getTime());
    });

    it('should throw FilesystemNotAvailableError when no filesystem', async () => {
      const sandboxOnly = new Workspace({ sandbox: mockSandbox });

      await expect(sandboxOnly.readFile('/test.txt')).rejects.toThrow(FilesystemNotAvailableError);
      await expect(sandboxOnly.writeFile('/test.txt', 'content')).rejects.toThrow(FilesystemNotAvailableError);
      await expect(sandboxOnly.readdir('/')).rejects.toThrow(FilesystemNotAvailableError);
      await expect(sandboxOnly.exists('/test.txt')).rejects.toThrow(FilesystemNotAvailableError);
    });
  });

  // ===========================================================================
  // Sandbox Operations
  // ===========================================================================
  describe('sandbox operations', () => {
    let workspace: Workspace;

    beforeEach(() => {
      workspace = new Workspace({ sandbox: mockSandbox });
    });

    it('should execute code in sandbox', async () => {
      const result = await workspace.executeCode('console.log("hello")', { runtime: 'node' });

      expect(result.success).toBe(true);
      expect(mockSandbox.executeCode).toHaveBeenCalledWith('console.log("hello")', { runtime: 'node' });
    });

    it('should execute command in sandbox', async () => {
      const result = await workspace.executeCommand('ls', ['-la']);

      expect(result.success).toBe(true);
      expect(mockSandbox.executeCommand).toHaveBeenCalledWith('ls', ['-la'], undefined);
    });

    it('should throw SandboxNotAvailableError when no sandbox', async () => {
      const fsOnly = new Workspace({ filesystem: mockFs });

      await expect(fsOnly.executeCode('code')).rejects.toThrow(SandboxNotAvailableError);
      await expect(fsOnly.executeCommand('cmd')).rejects.toThrow(SandboxNotAvailableError);
    });
  });

  // ===========================================================================
  // Search Operations
  // ===========================================================================
  describe('search operations', () => {
    it('should have canBM25=true when bm25 is enabled', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      expect(workspace.canBM25).toBe(true);
      expect(workspace.canVector).toBe(false);
      expect(workspace.canHybrid).toBe(false);
    });

    it('should have canBM25=false when bm25 not configured', () => {
      const workspace = new Workspace({ filesystem: mockFs });

      expect(workspace.canBM25).toBe(false);
    });

    it('should index and search content', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.index('/doc1.txt', 'The quick brown fox jumps over the lazy dog');
      await workspace.index('/doc2.txt', 'A lazy cat sleeps all day');

      const results = await workspace.search('lazy');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.id === '/doc1.txt')).toBe(true);
    });

    it('should support indexMany', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.indexMany([
        { path: '/doc1.txt', content: 'First document' },
        { path: '/doc2.txt', content: 'Second document' },
      ]);

      const results = await workspace.search('document');
      expect(results.length).toBe(2);
    });

    it('should unindex document', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
      });

      await workspace.index('/doc1.txt', 'Some content');
      await workspace.unindex('/doc1.txt');

      const results = await workspace.search('content');
      expect(results.length).toBe(0);
    });

    it('should rebuild index from filesystem', async () => {
      const files = new Map<string, string>([
        ['/docs/file1.txt', 'Content of file one'],
        ['/docs/file2.txt', 'Content of file two'],
      ]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        bm25: true,
        autoIndexPaths: ['/docs'],
      });

      await workspace.rebuildIndex();

      const results = await workspace.search('Content');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should throw SearchNotAvailableError when search not configured', async () => {
      const workspace = new Workspace({ filesystem: mockFs });

      await expect(workspace.index('/test', 'content')).rejects.toThrow(SearchNotAvailableError);
      await expect(workspace.search('query')).rejects.toThrow(SearchNotAvailableError);
      await expect(workspace.rebuildIndex()).rejects.toThrow(SearchNotAvailableError);
    });
  });

  // ===========================================================================
  // Skills
  // ===========================================================================
  describe('skills', () => {
    it('should return undefined when no skillsPaths configured', () => {
      const workspace = new Workspace({ filesystem: mockFs });
      expect(workspace.skills).toBeUndefined();
    });

    it('should throw when skillsPaths configured without filesystem', () => {
      expect(
        () =>
          new Workspace({
            sandbox: mockSandbox,
            skillsPaths: ['/skills'],
          }),
      ).toThrow('Skills require a filesystem provider');
    });

    it('should return undefined when no skillsPaths configured', () => {
      const workspace = new Workspace({
        sandbox: mockSandbox,
      });
      expect(workspace.skills).toBeUndefined();
    });

    it('should return skills instance when skillsPaths and filesystem configured', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        skillsPaths: ['/skills'],
      });
      expect(workspace.skills).toBeDefined();
    });

    it('should return same skills instance on repeated access', () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        skillsPaths: ['/skills'],
      });

      const skills1 = workspace.skills;
      const skills2 = workspace.skills;
      expect(skills1).toBe(skills2);
    });
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  describe('lifecycle', () => {
    it('should initialize workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();

      expect(workspace.status).toBe('ready');
      expect(mockFs.init).toHaveBeenCalled();
      expect(mockSandbox.start).toHaveBeenCalled();
    });

    it('should pause workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();
      await workspace.pause();

      expect(workspace.status).toBe('paused');
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should resume workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();
      await workspace.pause();
      await workspace.resume();

      expect(workspace.status).toBe('ready');
    });

    it('should destroy workspace', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      await workspace.init();
      await workspace.destroy();

      expect(workspace.status).toBe('destroyed');
      expect(mockSandbox.destroy).toHaveBeenCalled();
      expect(mockFs.destroy).toHaveBeenCalled();
    });

    it('should set status to error on init failure', async () => {
      (mockFs.init as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Init failed'));

      const workspace = new Workspace({ filesystem: mockFs });

      await expect(workspace.init()).rejects.toThrow('Init failed');
      expect(workspace.status).toBe('error');
    });
  });

  // ===========================================================================
  // Sync Operations
  // ===========================================================================
  describe('sync operations', () => {
    it('should sync files to sandbox', async () => {
      const files = new Map<string, string>([['/app.py', 'print("hello")']]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      const result = await workspace.syncToSandbox(['/app.py']);

      expect(result.synced).toContain('/app.py');
      expect(result.failed).toHaveLength(0);
      expect(mockSandbox.writeFile).toHaveBeenCalledWith('/app.py', 'print("hello")');
    });

    it('should sync files from sandbox', async () => {
      (mockSandbox.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue(['/output.txt']);
      (mockSandbox.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('output content');

      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      const result = await workspace.syncFromSandbox();

      expect(result.synced).toContain('/output.txt');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/output.txt', 'output content');
    });

    it('should throw when sync called without both fs and sandbox', async () => {
      const fsOnly = new Workspace({ filesystem: mockFs });

      await expect(fsOnly.syncToSandbox()).rejects.toThrow('Both filesystem and sandbox are required');
    });
  });

  // ===========================================================================
  // Snapshots
  // ===========================================================================
  describe('snapshots', () => {
    it('should create snapshot of workspace files', async () => {
      const files = new Map<string, string>([
        ['/file1.txt', 'content1'],
        ['/file2.txt', 'content2'],
      ]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({ filesystem: mockFs });
      const snapshot = await workspace.snapshot({ name: 'my-snapshot' });

      expect(snapshot.name).toBe('my-snapshot');
      expect(snapshot.workspaceId).toBe(workspace.id);
      expect(snapshot.data).toHaveProperty('/file1.txt');
      expect(snapshot.data).toHaveProperty('/file2.txt');
    });

    it('should restore snapshot', async () => {
      const files = new Map<string, string>();
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({ filesystem: mockFs });

      const snapshot = {
        id: 'snap-1',
        workspaceId: workspace.id,
        createdAt: new Date(),
        size: 100,
        data: {
          '/restored.txt': 'restored content',
        },
      };

      await workspace.restore(snapshot);

      expect(mockFs.writeFile).toHaveBeenCalledWith('/restored.txt', 'restored content', { recursive: true });
    });

    it('should restore with merge option', async () => {
      const files = new Map<string, string>([['/existing.txt', 'existing']]);
      mockFs = createMockFilesystem(files);

      const workspace = new Workspace({ filesystem: mockFs });

      const snapshot = {
        id: 'snap-1',
        workspaceId: workspace.id,
        createdAt: new Date(),
        size: 100,
        data: {
          '/new.txt': 'new content',
        },
      };

      await workspace.restore(snapshot, { merge: true });

      // Should not delete existing files when merging
      expect(mockFs.deleteFile).not.toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith('/new.txt', 'new content', { recursive: true });
    });
  });

  // ===========================================================================
  // State Storage
  // ===========================================================================
  describe('state storage', () => {
    it('should have state when filesystem is available', () => {
      const workspace = new Workspace({ filesystem: mockFs });
      expect(workspace.state).toBeDefined();
    });

    it('should not have state when only sandbox is available', () => {
      const workspace = new Workspace({ sandbox: mockSandbox });
      expect(workspace.state).toBeUndefined();
    });

    it('should set and get state values', async () => {
      const workspace = new Workspace({ filesystem: mockFs });

      await workspace.state!.set('myKey', { value: 42 });
      const result = await workspace.state!.get<{ value: number }>('myKey');

      expect(result).toEqual({ value: 42 });
    });

    it('should return null for non-existent keys', async () => {
      const workspace = new Workspace({ filesystem: mockFs });

      const result = await workspace.state!.get('nonExistent');
      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const files = new Map<string, string>([['/.state/myKey.json', '{"value":1}']]);
      mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });

      const exists = await workspace.state!.has('myKey');
      expect(exists).toBe(true);
    });

    it('should delete state value', async () => {
      const files = new Map<string, string>([['/.state/myKey.json', '{"value":1}']]);
      mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });

      const deleted = await workspace.state!.delete('myKey');
      expect(deleted).toBe(true);
      expect(mockFs.deleteFile).toHaveBeenCalled();
    });

    it('should list state keys', async () => {
      const files = new Map<string, string>([
        ['/.state/key1.json', '{}'],
        ['/.state/key2.json', '{}'],
      ]);
      mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });

      const keys = await workspace.state!.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  // ===========================================================================
  // Info
  // ===========================================================================
  describe('getInfo', () => {
    it('should return workspace info', async () => {
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
      });

      const info = await workspace.getInfo();

      expect(info.id).toBe(workspace.id);
      expect(info.name).toBe(workspace.name);
      expect(info.status).toBe('pending');
      expect(info.filesystem?.provider).toBe('mock');
      expect(info.sandbox?.provider).toBe('mock-sandbox');
    });

    it('should return info without sandbox when not configured', async () => {
      const workspace = new Workspace({ filesystem: mockFs });

      const info = await workspace.getInfo();

      expect(info.filesystem).toBeDefined();
      expect(info.sandbox).toBeUndefined();
    });
  });

  // ===========================================================================
  // Path Context
  // ===========================================================================
  describe('getPathContext', () => {
    it('should return same-context for local filesystem + local sandbox', () => {
      // Create mocks that identify as 'local' provider
      const localFs = {
        ...mockFs,
        provider: 'local',
        basePath: '/path/to/workspace',
      };
      const localSandbox = {
        ...mockSandbox,
        provider: 'local',
        workingDirectory: '/path/to/workspace',
        scriptDirectory: '/path/to/workspace/.mastra/sandbox',
      };

      const workspace = new Workspace({
        filesystem: localFs as unknown as WorkspaceFilesystem,
        sandbox: localSandbox as unknown as WorkspaceSandbox,
      });

      const context = workspace.getPathContext();

      expect(context.type).toBe('same-context');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem?.provider).toBe('local');
      expect(context.filesystem?.basePath).toBe('/path/to/workspace');
      expect(context.sandbox?.provider).toBe('local');
      expect(context.instructions).toContain('/path/to/workspace');
    });

    it('should return cross-context for different providers', () => {
      // AgentFS (provider: 'agentfs') + LocalSandbox (provider: 'local')
      const agentFs = {
        ...mockFs,
        provider: 'agentfs',
      };
      const localSandbox = {
        ...mockSandbox,
        provider: 'local',
        workingDirectory: '/tmp/sandbox',
      };

      const workspace = new Workspace({
        filesystem: agentFs as unknown as WorkspaceFilesystem,
        sandbox: localSandbox as unknown as WorkspaceSandbox,
      });

      const context = workspace.getPathContext();

      expect(context.type).toBe('cross-context');
      expect(context.requiresSync).toBe(true);
      expect(context.instructions).toContain('sync');
    });

    it('should return filesystem-only when no sandbox configured', () => {
      const workspace = new Workspace({ filesystem: mockFs });

      const context = workspace.getPathContext();

      expect(context.type).toBe('filesystem-only');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem?.provider).toBe('mock');
      expect(context.sandbox).toBeUndefined();
    });

    it('should return sandbox-only when no filesystem configured', () => {
      const workspace = new Workspace({ sandbox: mockSandbox });

      const context = workspace.getPathContext();

      expect(context.type).toBe('sandbox-only');
      expect(context.requiresSync).toBe(false);
      expect(context.filesystem).toBeUndefined();
      expect(context.sandbox?.provider).toBe('mock-sandbox');
    });
  });

  // ===========================================================================
  // Error Classes
  // ===========================================================================
  describe('error classes', () => {
    it('should create WorkspaceError with code', () => {
      const error = new WorkspaceError('Test error', 'TEST_CODE', 'ws-123');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.workspaceId).toBe('ws-123');
      expect(error.name).toBe('WorkspaceError');
    });

    it('should create FilesystemNotAvailableError', () => {
      const error = new FilesystemNotAvailableError();

      expect(error.code).toBe('NO_FILESYSTEM');
      expect(error.name).toBe('FilesystemNotAvailableError');
    });

    it('should create SandboxNotAvailableError', () => {
      const error = new SandboxNotAvailableError();

      expect(error.code).toBe('NO_SANDBOX');
      expect(error.name).toBe('SandboxNotAvailableError');
    });

    it('should create SearchNotAvailableError', () => {
      const error = new SearchNotAvailableError();

      expect(error.code).toBe('NO_SEARCH');
      expect(error.name).toBe('SearchNotAvailableError');
    });
  });
});
