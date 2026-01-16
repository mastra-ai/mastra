import { describe, it, expect, vi } from 'vitest';

import type { WorkspaceFilesystem, FileEntry, FileStat } from './filesystem';
import type { WorkspaceSandbox, CodeResult, CommandResult, InstallPackageResult } from './sandbox';
import { createWorkspaceTools, WORKSPACE_TOOL_NAMES } from './tools';
import { Workspace } from './workspace';

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
    }),

    readdir: vi.fn().mockImplementation(async (path: string): Promise<FileEntry[]> => {
      const entries: FileEntry[] = [];
      const normalizedPath = path === '/' ? '' : path;

      for (const [filePath, content] of files) {
        if (filePath.startsWith(normalizedPath + '/')) {
          const rest = filePath.slice(normalizedPath.length + 1);
          const parts = rest.split('/');
          if (parts.length === 1) {
            entries.push({
              name: parts[0],
              path: filePath,
              type: 'file',
              size: typeof content === 'string' ? content.length : content.length,
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

    deleteFile: vi.fn().mockImplementation(async (path: string, options?: { force?: boolean }) => {
      if (!files.has(path) && !options?.force) {
        throw new Error(`File not found: ${path}`);
      }
      files.delete(path);
    }),

    stat: vi.fn().mockImplementation(async (path: string): Promise<FileStat> => {
      if (files.has(path)) {
        const content = files.get(path)!;
        return {
          name: path.split('/').pop() || '',
          path,
          type: 'file',
          size: typeof content === 'string' ? content.length : content.length,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      if (dirs.has(path)) {
        return {
          name: path.split('/').pop() || '',
          path,
          type: 'directory',
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      throw new Error(`Not found: ${path}`);
    }),

    isFile: vi.fn().mockImplementation(async (path: string) => {
      return files.has(path);
    }),

    isDirectory: vi.fn().mockImplementation(async (path: string) => {
      return dirs.has(path);
    }),
  };
}

function createMockSandbox(): WorkspaceSandbox {
  return {
    provider: 'mock-sandbox',
    supportedRuntimes: ['node', 'python', 'bash'] as const,

    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),

    executeCode: vi.fn().mockImplementation(async (code: string): Promise<CodeResult> => {
      return {
        success: true,
        stdout: `Executed: ${code.slice(0, 20)}`,
        stderr: '',
        exitCode: 0,
        executionTimeMs: 100,
      };
    }),

    executeCommand: vi.fn().mockImplementation(async (command: string): Promise<CommandResult> => {
      return {
        success: true,
        stdout: `Command: ${command}`,
        stderr: '',
        exitCode: 0,
        executionTimeMs: 50,
      };
    }),

    installPackage: vi.fn().mockImplementation(async (packageName: string): Promise<InstallPackageResult> => {
      return {
        success: true,
        packageName,
        executionTimeMs: 1000,
      };
    }),

    getInfo: vi.fn().mockResolvedValue({
      status: 'running',
      resources: {},
    }),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('createWorkspaceTools', () => {
  // ===========================================================================
  // Tool Creation
  // ===========================================================================
  describe('tool creation', () => {
    it('should create filesystem tools when filesystem is available', () => {
      const files = new Map<string, string>();
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.READ_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.WRITE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.LIST_FILES);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.DELETE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.FILE_EXISTS);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.MKDIR);
    });

    it('should not create filesystem tools when no filesystem', () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.READ_FILE);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.WRITE_FILE);
    });

    it('should create search tools when BM25 is enabled', () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs, bm25: true });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.SEARCH);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INDEX);
    });

    it('should not create search tools when search not configured', () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.SEARCH);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.INDEX);
    });

    it('should create sandbox tools when sandbox is available', () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_CODE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INSTALL_PACKAGE);
    });

    it('should not create sandbox tools when no sandbox', () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_CODE);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND);
    });

    it('should create all tools when all capabilities available', () => {
      const mockFs = createMockFilesystem();
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({
        filesystem: mockFs,
        sandbox: mockSandbox,
        bm25: true,
      });

      const tools = createWorkspaceTools(workspace);

      // Filesystem tools
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.READ_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.WRITE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.LIST_FILES);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.DELETE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.FILE_EXISTS);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.MKDIR);
      // Search tools
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.SEARCH);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INDEX);
      // Sandbox tools
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_CODE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INSTALL_PACKAGE);
    });
  });

  // ===========================================================================
  // Filesystem Tools
  // ===========================================================================
  describe('workspace_read_file', () => {
    it('should read file content', async () => {
      const files = new Map<string, string>([['/test.txt', 'Hello World']]);
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_read_file.execute({ path: '/test.txt' });

      expect(result.content).toBe('Hello World');
      expect(result.size).toBe(11);
      expect(result.path).toBe('/test.txt');
    });

    it('should handle buffer content as base64', async () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02]);
      const files = new Map<string, string | Buffer>([['/binary.bin', buffer]]);
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_read_file.execute({ path: '/binary.bin' });

      expect(result.content).toBe(buffer.toString('base64'));
    });
  });

  describe('workspace_write_file', () => {
    it('should write file content', async () => {
      const files = new Map<string, string>();
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_write_file.execute({
        path: '/new.txt',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/new.txt');
      expect(result.size).toBe(11);
      expect(mockFs.writeFile).toHaveBeenCalledWith('/new.txt', 'New content', { overwrite: true });
    });

    it('should pass overwrite option', async () => {
      const files = new Map<string, string>();
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      await tools.workspace_write_file.execute({
        path: '/new.txt',
        content: 'content',
        overwrite: false,
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith('/new.txt', 'content', { overwrite: false });
    });
  });

  describe('workspace_list_files', () => {
    it('should list directory contents', async () => {
      const files = new Map<string, string>([
        ['/dir/file1.txt', 'content1'],
        ['/dir/file2.txt', 'content2'],
      ]);
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_list_files.execute({ path: '/dir' });

      expect(result.path).toBe('/dir');
      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);
    });

    it('should pass recursive and extension options', async () => {
      const files = new Map<string, string>();
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      await tools.workspace_list_files.execute({
        path: '/',
        recursive: true,
        extension: '.json',
      });

      expect(mockFs.readdir).toHaveBeenCalledWith('/', {
        recursive: true,
        extension: ['.json'],
      });
    });
  });

  describe('workspace_delete_file', () => {
    it('should delete file', async () => {
      const files = new Map<string, string>([['/test.txt', 'content']]);
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_delete_file.execute({ path: '/test.txt' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test.txt');
      expect(mockFs.deleteFile).toHaveBeenCalledWith('/test.txt', { force: false });
    });

    it('should pass force option', async () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      await tools.workspace_delete_file.execute({ path: '/test.txt', force: true });

      expect(mockFs.deleteFile).toHaveBeenCalledWith('/test.txt', { force: true });
    });
  });

  describe('workspace_file_exists', () => {
    it('should return exists=true for existing file', async () => {
      const files = new Map<string, string>([['/test.txt', 'content']]);
      const mockFs = createMockFilesystem(files);
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_file_exists.execute({ path: '/test.txt' });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('file');
    });

    it('should return exists=false for non-existing path', async () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_file_exists.execute({ path: '/nonexistent' });

      expect(result.exists).toBe(false);
      expect(result.type).toBe('none');
    });
  });

  describe('workspace_mkdir', () => {
    it('should create directory', async () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_mkdir.execute({ path: '/newdir' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/newdir');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/newdir', { recursive: true });
    });
  });

  // ===========================================================================
  // Search Tools
  // ===========================================================================
  describe('workspace_search', () => {
    it('should search indexed content', async () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs, bm25: true });
      const tools = createWorkspaceTools(workspace);

      // Index some content
      await workspace.index('/doc.txt', 'The quick brown fox');

      const result = await tools.workspace_search.execute({ query: 'quick' });

      expect(result.count).toBeGreaterThan(0);
      expect(result.mode).toBe('bm25');
    });

    it('should pass search options', async () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs, bm25: true });
      const tools = createWorkspaceTools(workspace);

      await workspace.index('/doc.txt', 'The quick brown fox');

      const result = await tools.workspace_search.execute({
        query: 'quick',
        topK: 10,
        mode: 'bm25',
        minScore: 0.5,
      });

      expect(result.mode).toBe('bm25');
    });
  });

  describe('workspace_index', () => {
    it('should index content', async () => {
      const mockFs = createMockFilesystem();
      const workspace = new Workspace({ filesystem: mockFs, bm25: true });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_index.execute({
        path: '/doc.txt',
        content: 'Document content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/doc.txt');
    });
  });

  // ===========================================================================
  // Sandbox Tools
  // ===========================================================================
  describe('workspace_execute_code', () => {
    it('should execute code', async () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_execute_code.execute({
        code: 'console.log("hello")',
        runtime: 'node',
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Executed');
      expect(result.exitCode).toBe(0);
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should pass options to sandbox', async () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });
      const tools = createWorkspaceTools(workspace);

      await tools.workspace_execute_code.execute({
        code: 'print("hi")',
        runtime: 'python',
        timeout: 5000,
      });

      expect(mockSandbox.executeCode).toHaveBeenCalledWith('print("hi")', {
        runtime: 'python',
        timeout: 5000,
      });
    });
  });

  describe('workspace_execute_command', () => {
    it('should execute command', async () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_execute_command.execute({
        command: 'ls',
        args: ['-la'],
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Command');
      expect(result.exitCode).toBe(0);
    });

    it('should pass options to sandbox', async () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });
      const tools = createWorkspaceTools(workspace);

      await tools.workspace_execute_command.execute({
        command: 'npm',
        args: ['install'],
        timeout: 10000,
        cwd: '/project',
      });

      expect(mockSandbox.executeCommand).toHaveBeenCalledWith('npm', ['install'], {
        timeout: 10000,
        cwd: '/project',
      });
    });
  });

  describe('workspace_install_package', () => {
    it('should install package', async () => {
      const mockSandbox = createMockSandbox();
      const workspace = new Workspace({ sandbox: mockSandbox });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_install_package.execute({
        packageName: 'lodash',
        packageManager: 'npm',
      });

      expect(result.success).toBe(true);
      expect(result.packageName).toBe('lodash');
    });

    it('should handle missing installPackage method', async () => {
      const mockSandbox = createMockSandbox();
      delete (mockSandbox as any).installPackage;
      const workspace = new Workspace({ sandbox: mockSandbox });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_install_package.execute({
        packageName: 'lodash',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('not supported');
    });
  });

  // ===========================================================================
  // WORKSPACE_TOOL_NAMES
  // ===========================================================================
  describe('WORKSPACE_TOOL_NAMES', () => {
    it('should have all expected tool names', () => {
      expect(WORKSPACE_TOOL_NAMES.READ_FILE).toBe('workspace_read_file');
      expect(WORKSPACE_TOOL_NAMES.WRITE_FILE).toBe('workspace_write_file');
      expect(WORKSPACE_TOOL_NAMES.LIST_FILES).toBe('workspace_list_files');
      expect(WORKSPACE_TOOL_NAMES.DELETE_FILE).toBe('workspace_delete_file');
      expect(WORKSPACE_TOOL_NAMES.FILE_EXISTS).toBe('workspace_file_exists');
      expect(WORKSPACE_TOOL_NAMES.MKDIR).toBe('workspace_mkdir');
      expect(WORKSPACE_TOOL_NAMES.SEARCH).toBe('workspace_search');
      expect(WORKSPACE_TOOL_NAMES.INDEX).toBe('workspace_index');
      expect(WORKSPACE_TOOL_NAMES.EXECUTE_CODE).toBe('workspace_execute_code');
      expect(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND).toBe('workspace_execute_command');
      expect(WORKSPACE_TOOL_NAMES.INSTALL_PACKAGE).toBe('workspace_install_package');
    });
  });
});
