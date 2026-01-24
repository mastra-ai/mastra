import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LocalFilesystem } from './local-filesystem';
import { LocalSandbox } from './local-sandbox';
import { createWorkspaceTools, WORKSPACE_TOOL_NAMES } from './tools';
import { Workspace } from './workspace';

describe('createWorkspaceTools', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // Tool Creation
  // ===========================================================================
  describe('tool creation', () => {
    it('should create filesystem tools when filesystem is available', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.READ_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.WRITE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.LIST_FILES);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.DELETE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.FILE_EXISTS);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.MKDIR);
    });

    it('should not create filesystem tools when no filesystem', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.READ_FILE);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.WRITE_FILE);
    });

    it('should create search tools when BM25 is enabled', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.SEARCH);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INDEX);
    });

    it('should not create search tools when search not configured', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.SEARCH);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.INDEX);
    });

    it('should create sandbox tools when sandbox is available', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INSTALL_PACKAGE);
    });

    it('should not create sandbox tools when no sandbox', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND);
    });

    it('should create all tools when all capabilities available', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
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
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND);
      expect(tools).toHaveProperty(WORKSPACE_TOOL_NAMES.INSTALL_PACKAGE);
    });
  });

  // ===========================================================================
  // Filesystem Tools
  // ===========================================================================
  describe('workspace_read_file', () => {
    it('should read file content with line numbers by default', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_read_file.execute({ path: '/test.txt' });

      expect(result.content).toBe('     1→Hello World');
      expect(result.size).toBe(11);
      expect(result.path).toBe('/test.txt');
    });

    it('should read file content without line numbers when showLineNumbers is false', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_read_file.execute({ path: '/test.txt', showLineNumbers: false });

      expect(result.content).toBe('Hello World');
      expect(result.size).toBe(11);
      expect(result.path).toBe('/test.txt');
    });

    it('should read file with offset and limit', async () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      await fs.writeFile(path.join(tempDir, 'test.txt'), content);
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_read_file.execute({
        path: '/test.txt',
        offset: 2,
        limit: 2,
        showLineNumbers: false,
      });

      expect(result.content).toBe('Line 2\nLine 3');
      expect(result.lines).toEqual({ start: 2, end: 3 });
      expect(result.totalLines).toBe(5);
    });

    it('should handle binary content', async () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
      await fs.writeFile(path.join(tempDir, 'binary.bin'), buffer);
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      // With utf-8 encoding (default), binary content is read as string
      // The tool should still return something readable
      const result = await tools.workspace_read_file.execute({ path: '/binary.bin' });

      expect(result.path).toBe('/binary.bin');
      expect(result.size).toBe(4);
      // Content will be the binary bytes interpreted as utf-8 string with line numbers
      expect(result.content).toBeDefined();
    });
  });

  describe('workspace_write_file', () => {
    it('should write file content', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_write_file.execute({
        path: '/new.txt',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/new.txt');
      expect(result.size).toBe(11);

      // Verify file was actually written
      const written = await fs.readFile(path.join(tempDir, 'new.txt'), 'utf-8');
      expect(written).toBe('New content');
    });

    it('should overwrite existing file by default', async () => {
      await fs.writeFile(path.join(tempDir, 'existing.txt'), 'original');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      // Read first (required by safety)
      await workspace.readFile('/existing.txt');

      await tools.workspace_write_file.execute({
        path: '/existing.txt',
        content: 'updated',
      });

      const written = await fs.readFile(path.join(tempDir, 'existing.txt'), 'utf-8');
      expect(written).toBe('updated');
    });
  });

  describe('workspace_edit_file', () => {
    it('should replace unique string in file', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_edit_file.execute({
        path: '/test.txt',
        old_string: 'World',
        new_string: 'Universe',
      });

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('Hello Universe');
    });

    it('should fail when old_string not found', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_edit_file.execute({
        path: '/test.txt',
        old_string: 'foo',
        new_string: 'bar',
      });

      expect(result.success).toBe(false);
      expect(result.replacements).toBe(0);
      expect(result.error).toContain('not found');
    });

    it('should fail when old_string not unique without replace_all', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello hello hello');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_edit_file.execute({
        path: '/test.txt',
        old_string: 'hello',
        new_string: 'hi',
      });

      expect(result.success).toBe(false);
      expect(result.replacements).toBe(0);
      expect(result.error).toContain('3 times');
    });

    it('should replace all occurrences with replace_all', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello hello hello');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_edit_file.execute({
        path: '/test.txt',
        old_string: 'hello',
        new_string: 'hi',
        replace_all: true,
      });

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(3);

      const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('hi hi hi');
    });
  });

  describe('workspace_list_files', () => {
    it('should list directory contents', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));
      await fs.writeFile(path.join(tempDir, 'dir', 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'dir', 'file2.txt'), 'content2');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_list_files.execute({ path: '/dir' });

      expect(result.path).toBe('/dir');
      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);
    });

    it('should list files recursively', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));
      await fs.mkdir(path.join(tempDir, 'dir', 'subdir'));
      await fs.writeFile(path.join(tempDir, 'dir', 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'dir', 'subdir', 'file2.txt'), 'content2');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_list_files.execute({
        path: '/dir',
        recursive: true,
      });

      expect(result.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('workspace_delete_file', () => {
    it('should delete file', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_delete_file.execute({ path: '/test.txt' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test.txt');

      // Verify file was deleted
      const exists = await fs.access(path.join(tempDir, 'test.txt')).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should handle force option for non-existent file', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_delete_file.execute({ path: '/nonexistent.txt', force: true });

      expect(result.success).toBe(true);
    });
  });

  describe('workspace_file_exists', () => {
    it('should return exists=true for existing file', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_file_exists.execute({ path: '/test.txt' });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('file');
    });

    it('should return exists=false for non-existing path', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_file_exists.execute({ path: '/nonexistent' });

      expect(result.exists).toBe(false);
      expect(result.type).toBe('none');
    });

    it('should return type=directory for directories', async () => {
      await fs.mkdir(path.join(tempDir, 'subdir'));
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_file_exists.execute({ path: '/subdir' });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('directory');
    });
  });

  describe('workspace_mkdir', () => {
    it('should create directory', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_mkdir.execute({ path: '/newdir' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/newdir');

      // Verify directory was created
      const stat = await fs.stat(path.join(tempDir, 'newdir'));
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create nested directories', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_mkdir.execute({ path: '/a/b/c' });

      expect(result.success).toBe(true);

      const stat = await fs.stat(path.join(tempDir, 'a', 'b', 'c'));
      expect(stat.isDirectory()).toBe(true);
    });
  });

  // ===========================================================================
  // Search Tools
  // ===========================================================================
  describe('workspace_search', () => {
    it('should search indexed content', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
      });
      const tools = createWorkspaceTools(workspace);

      // Index some content
      await workspace.index('/doc.txt', 'The quick brown fox');

      const result = await tools.workspace_search.execute({ query: 'quick' });

      expect(result.count).toBeGreaterThan(0);
      expect(result.mode).toBe('bm25');
    });

    it('should return empty results for no matches', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
      });
      const tools = createWorkspaceTools(workspace);

      await workspace.index('/doc.txt', 'The quick brown fox');

      const result = await tools.workspace_search.execute({ query: 'elephant' });

      expect(result.count).toBe(0);
    });
  });

  describe('workspace_index', () => {
    it('should index content', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_index.execute({
        path: '/doc.txt',
        content: 'Document content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/doc.txt');

      // Verify it's searchable
      const searchResult = await tools.workspace_search.execute({ query: 'Document' });
      expect(searchResult.count).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Sandbox Tools
  // ===========================================================================
  describe('workspace_execute_command', () => {
    it('should execute command', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir, inheritEnv: true }),
      });
      await workspace.init();
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_execute_command.execute(
        {
          command: 'echo',
          args: ['hello'],
        },
        {} as any,
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
      expect(result.exitCode).toBe(0);

      await workspace.destroy();
    });

    it('should handle command failures', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir, inheritEnv: true }),
      });
      await workspace.init();
      const tools = createWorkspaceTools(workspace);

      const result = await tools.workspace_execute_command.execute(
        {
          command: 'ls',
          args: ['/nonexistent/path/that/does/not/exist'],
        },
        {} as any,
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);

      await workspace.destroy();
    });
  });

  describe('workspace_install_package', () => {
    it('should have install_package tool', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      // Just verify the tool exists - actually installing packages is slow
      expect(tools.workspace_install_package).toBeDefined();
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
      expect(WORKSPACE_TOOL_NAMES.EXECUTE_COMMAND).toBe('workspace_execute_command');
      expect(WORKSPACE_TOOL_NAMES.INSTALL_PACKAGE).toBe('workspace_install_package');
    });
  });
});
