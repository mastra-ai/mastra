import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../constants';
import { LocalFilesystem } from '../filesystem';
import { LocalSandbox } from '../sandbox';
import { Workspace } from '../workspace';
import { createWorkspaceTools } from './tools';

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

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
    });

    it('should not create filesystem tools when no filesystem', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    });

    it('should create search tools when BM25 is enabled', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        bm25: true,
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
    });

    it('should not create search tools when search not configured', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
    });

    it('should create sandbox tools when sandbox is available', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    });

    it('should not create sandbox tools when no sandbox', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    });

    it('should create grep tool when filesystem is available', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.GREP);
    });

    it('should not create grep tool when no filesystem', () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SEARCH.GREP);
    });

    it('should create all tools when all capabilities available', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        sandbox: new LocalSandbox({ workingDirectory: tempDir }),
        bm25: true,
      });

      const tools = createWorkspaceTools(workspace);

      // Filesystem tools
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
      // Search tools
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.GREP);
      // Sandbox tools
      expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: '/test.txt' });

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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({
        path: '/test.txt',
        showLineNumbers: false,
      });

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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({
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
      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: '/binary.bin' });

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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute({
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
      await workspace.filesystem!.readFile('/existing.txt');

      await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute({
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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
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
    it('should list directory contents as tree (default depth 1)', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));
      await fs.writeFile(path.join(tempDir, 'dir', 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'dir', 'file2.txt'), 'content2');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/dir' });

      expect(result.tree).toContain('file1.txt');
      expect(result.tree).toContain('file2.txt');
      expect(result.summary).toBe('0 directories, 2 files');
    });

    it('should list files recursively with maxDepth', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));
      await fs.mkdir(path.join(tempDir, 'dir', 'subdir'));
      await fs.writeFile(path.join(tempDir, 'dir', 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'dir', 'subdir', 'file2.txt'), 'content2');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/dir',
        maxDepth: 5,
      });

      expect(result.tree).toContain('subdir');
      expect(result.tree).toContain('file1.txt');
      expect(result.tree).toContain('file2.txt');
      expect(result.summary).toContain('1 directory');
      expect(result.summary).toContain('2 files');
    });

    it('should respect maxDepth parameter (tree -L flag)', async () => {
      await fs.mkdir(path.join(tempDir, 'level1'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'));
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'deep.txt'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/',
        maxDepth: 2,
      });

      expect(result.tree).toContain('level1');
      expect(result.tree).toContain('level2');
      expect(result.tree).not.toContain('level3');
      expect(result.tree).not.toContain('deep.txt');
      expect(result.summary).toContain('truncated at depth 2');
    });

    it('should default maxDepth to 3', async () => {
      await fs.mkdir(path.join(tempDir, 'level1'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3', 'level4'));
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'level4', 'deep.txt'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/' });

      // With default maxDepth of 3, should show up to level3 but not level4 contents
      expect(result.tree).toContain('level1');
      expect(result.tree).toContain('level2');
      // Verify level3 directory itself is shown (confirms depth=3)
      expect(result.tree).toContain('level3');
      expect(result.tree).not.toContain('level4');
      expect(result.tree).not.toContain('deep.txt');
      expect(result.summary).toContain('truncated at depth 3');
    });

    it('should filter by extension (tree -P flag)', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');
      await fs.writeFile(path.join(tempDir, 'utils.ts'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/',
        extension: '.ts',
      });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).toContain('utils.ts');
      expect(result.tree).not.toContain('style.css');
      expect(result.summary).toBe('0 directories, 2 files');
    });

    it('should show hidden files with showHidden (tree -a flag)', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, 'visible.txt'), '');
      await fs.mkdir(path.join(tempDir, '.hidden-dir'));
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      // Without showHidden
      const resultHidden = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/' });
      expect(resultHidden.tree).not.toContain('.gitignore');
      expect(resultHidden.tree).not.toContain('.hidden-dir');
      expect(resultHidden.tree).toContain('visible.txt');

      // With showHidden
      const resultVisible = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/', showHidden: true });
      expect(resultVisible.tree).toContain('.gitignore');
      expect(resultVisible.tree).toContain('.hidden-dir');
      expect(resultVisible.tree).toContain('visible.txt');
    });

    it('should list directories only with dirsOnly (tree -d flag)', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.writeFile(path.join(tempDir, 'package.json'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/',
        maxDepth: 3,
        dirsOnly: true,
      });

      expect(result.tree).toContain('src');
      expect(result.tree).toContain('tests');
      expect(result.tree).not.toContain('package.json');
      expect(result.tree).not.toContain('index.ts');
      expect(result.summary).toContain('0 files');
    });

    it('should exclude patterns with exclude (tree -I flag)', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.mkdir(path.join(tempDir, 'node_modules', 'lodash'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/',
        maxDepth: 3,
        exclude: 'node_modules',
      });

      expect(result.tree).toContain('src');
      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('node_modules');
      expect(result.tree).not.toContain('lodash');
    });
  });

  describe('workspace_list_files with pattern', () => {
    it('should filter files by glob pattern', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'style.css'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/',
        maxDepth: 5,
        pattern: '**/*.ts',
      });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('style.css');
      expect(result.tree).not.toContain('README.md');
    });

    it('should support multiple glob patterns', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'App.tsx'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
        path: '/',
        pattern: ['**/*.ts', '**/*.tsx'],
      });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).toContain('App.tsx');
      expect(result.tree).not.toContain('style.css');
    });
  });

  describe('workspace_delete', () => {
    it('should delete file', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({ path: '/test.txt' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/test.txt');

      // Verify file was deleted
      const exists = await fs
        .access(path.join(tempDir, 'test.txt'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should delete empty directory', async () => {
      await fs.mkdir(path.join(tempDir, 'emptydir'));
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({ path: '/emptydir' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/emptydir');

      // Verify directory was deleted
      const exists = await fs
        .access(path.join(tempDir, 'emptydir'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should delete directory recursively when recursive=true', async () => {
      await fs.mkdir(path.join(tempDir, 'dirwithfiles'));
      await fs.writeFile(path.join(tempDir, 'dirwithfiles', 'file.txt'), 'content');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({
        path: '/dirwithfiles',
        recursive: true,
      });

      expect(result.success).toBe(true);

      // Verify directory was deleted
      const exists = await fs
        .access(path.join(tempDir, 'dirwithfiles'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('workspace_file_stat', () => {
    it('should return full stat for existing file', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute({ path: '/test.txt' });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('file');
      expect(result.size).toBe(7); // 'content' is 7 bytes
      expect(result.modifiedAt).toBeDefined();
      expect(new Date(result.modifiedAt!).getTime()).toBeGreaterThan(0);
    });

    it('should return exists=false for non-existing path', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute({ path: '/nonexistent' });

      expect(result.exists).toBe(false);
      expect(result.type).toBe('none');
      expect(result.size).toBeUndefined();
      expect(result.modifiedAt).toBeUndefined();
    });

    it('should return type=directory for directories', async () => {
      await fs.mkdir(path.join(tempDir, 'subdir'));
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute({ path: '/subdir' });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('directory');
      expect(result.size).toBeDefined();
      expect(result.modifiedAt).toBeDefined();
    });
  });

  describe('workspace_mkdir', () => {
    it('should create directory', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: '/newdir' });

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

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: '/a/b/c' });

      expect(result.success).toBe(true);

      const stat = await fs.stat(path.join(tempDir, 'a', 'b', 'c'));
      expect(stat.isDirectory()).toBe(true);
    });
  });

  // ===========================================================================
  // Grep Tool
  // ===========================================================================
  describe('workspace_grep', () => {
    it('should find basic regex matches across files', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'const foo = 1;\nconst bar = 2;\nconst fooBar = 3;');
      await fs.writeFile(path.join(tempDir, 'src', 'util.ts'), 'export function foo() {}\nexport function bar() {}');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'foo' });

      expect(result.matchCount).toBe(3);
      expect(result.fileCount).toBe(2);
      expect(result.truncated).toBe(false);
      expect(result.matches[0]).toMatchObject({
        file: expect.stringContaining('main.ts'),
        line: 1,
        content: 'const foo = 1;',
      });
    });

    it('should support case-insensitive search', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'Hello World\nhello world\nHELLO WORLD');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const sensitive = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'hello',
        caseSensitive: true,
      });
      expect(sensitive.matchCount).toBe(1);

      const insensitive = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'hello',
        caseSensitive: false,
      });
      expect(insensitive.matchCount).toBe(3);
    });

    it('should scope search to a subdirectory via path', async () => {
      await fs.mkdir(path.join(tempDir, 'a'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'b'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'a', 'file.ts'), 'target');
      await fs.writeFile(path.join(tempDir, 'b', 'file.ts'), 'target');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'target',
        path: '/a',
      });

      expect(result.matchCount).toBe(1);
      expect(result.matches[0].file).toContain('/a/');
    });

    it('should filter files by glob pattern', async () => {
      await fs.writeFile(path.join(tempDir, 'app.ts'), 'match here');
      await fs.writeFile(path.join(tempDir, 'app.js'), 'match here');
      await fs.writeFile(path.join(tempDir, 'style.css'), 'match here');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'match',
        glob: '*.ts',
      });

      expect(result.matchCount).toBe(1);
      expect(result.matches[0].file).toContain('app.ts');
    });

    it('should include context lines', async () => {
      await fs.writeFile(path.join(tempDir, 'ctx.ts'), 'line1\nline2\nTARGET\nline4\nline5');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'TARGET',
        contextLines: 2,
      });

      expect(result.matchCount).toBe(1);
      expect(result.matches[0].context).toBeDefined();
      expect(result.matches[0].context!.before).toEqual(['line1', 'line2']);
      expect(result.matches[0].context!.after).toEqual(['line4', 'line5']);
    });

    it('should truncate at maxResults', async () => {
      const lines = Array.from({ length: 200 }, (_, i) => `match_${i}`).join('\n');
      await fs.writeFile(path.join(tempDir, 'big.ts'), lines);
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'match_',
        maxResults: 10,
      });

      expect(result.matchCount).toBe(10);
      expect(result.truncated).toBe(true);
    });

    it('should return error for invalid regex', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: '[invalid',
      });

      expect(result.matchCount).toBe(0);
      expect((result as any).error).toContain('Invalid regex');
    });

    it('should reject excessively long patterns', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'a'.repeat(1001),
      });

      expect(result.matchCount).toBe(0);
      expect((result as any).error).toContain('Pattern too long');
    });

    it('should support ** globstar patterns', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'match');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), 'match');
      await fs.writeFile(path.join(tempDir, 'src', 'style.css'), 'match');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'match',
        glob: '**/*.ts',
      });

      expect(result.matchCount).toBe(2);
      expect(result.matches.every((m: any) => m.file.endsWith('.ts'))).toBe(true);
    });

    it('should support brace expansion glob patterns', async () => {
      await fs.writeFile(path.join(tempDir, 'app.ts'), 'match');
      await fs.writeFile(path.join(tempDir, 'app.js'), 'match');
      await fs.writeFile(path.join(tempDir, 'style.css'), 'match');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'match',
        glob: '*.{ts,js}',
      });

      expect(result.matchCount).toBe(2);
      expect(result.matches.some((m: any) => m.file.endsWith('.ts'))).toBe(true);
      expect(result.matches.some((m: any) => m.file.endsWith('.js'))).toBe(true);
    });

    it('should skip binary/non-text files', async () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await fs.writeFile(path.join(tempDir, 'image.png'), buffer);
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'findme');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'findme' });

      expect(result.matchCount).toBe(1);
      expect(result.matches[0].file).toContain('code.ts');
    });

    it('should work with empty directories', async () => {
      await fs.mkdir(path.join(tempDir, 'empty'), { recursive: true });
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
        pattern: 'anything',
        path: '/empty',
      });

      expect(result.matchCount).toBe(0);
      expect(result.fileCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should report correct column for match', async () => {
      await fs.writeFile(path.join(tempDir, 'col.ts'), '    findme here');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'findme' });

      expect(result.matches[0].column).toBe(5);
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

      const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'quick' });

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

      const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'elephant' });

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

      const result = await tools[WORKSPACE_TOOLS.SEARCH.INDEX].execute({
        path: '/doc.txt',
        content: 'Document content',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/doc.txt');

      // Verify it's searchable
      const searchResult = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'Document' });
      expect(searchResult.count).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Sandbox Tools
  // ===========================================================================

  // Mock context that satisfies ToolExecutionContext (all properties are optional)
  const mockToolContext = {};

  describe('workspace_execute_command', () => {
    it('should execute command', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir, env: process.env }),
      });
      await workspace.init();
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
        {
          command: 'echo',
          args: ['hello'],
        },
        mockToolContext,
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
      expect(result.exitCode).toBe(0);

      await workspace.destroy();
    });

    it('should handle command failures', async () => {
      const workspace = new Workspace({
        sandbox: new LocalSandbox({ workingDirectory: tempDir, env: process.env }),
      });
      await workspace.init();
      const tools = createWorkspaceTools(workspace);

      // Use a command that fails on all platforms (non-existent path)
      const result = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
        {
          command: process.platform === 'win32' ? 'cmd' : 'ls',
          args:
            process.platform === 'win32'
              ? ['/c', 'dir', 'C:\\nonexistent\\path']
              : ['/nonexistent/path/that/does/not/exist'],
        },
        mockToolContext,
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);

      await workspace.destroy();
    });
  });

  // ===========================================================================
  // WORKSPACE_TOOLS
  // ===========================================================================
  describe('WORKSPACE_TOOLS', () => {
    it('should have all expected tool names with proper namespacing', () => {
      // Filesystem tools
      expect(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE).toBe('mastra_workspace_read_file');
      expect(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE).toBe('mastra_workspace_write_file');
      expect(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE).toBe('mastra_workspace_edit_file');
      expect(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES).toBe('mastra_workspace_list_files');
      expect(WORKSPACE_TOOLS.FILESYSTEM.DELETE).toBe('mastra_workspace_delete');
      expect(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT).toBe('mastra_workspace_file_stat');
      expect(WORKSPACE_TOOLS.FILESYSTEM.MKDIR).toBe('mastra_workspace_mkdir');
      // Search tools
      expect(WORKSPACE_TOOLS.SEARCH.SEARCH).toBe('mastra_workspace_search');
      expect(WORKSPACE_TOOLS.SEARCH.INDEX).toBe('mastra_workspace_index');
      expect(WORKSPACE_TOOLS.SEARCH.GREP).toBe('mastra_workspace_grep');
      // Sandbox tools
      expect(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND).toBe('mastra_workspace_execute_command');
    });
  });
});
