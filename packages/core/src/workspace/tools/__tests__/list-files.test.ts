import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_list_files', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should list directory contents as tree (default depth 1)', async () => {
    await fs.mkdir(path.join(tempDir, 'dir'));
    await fs.writeFile(path.join(tempDir, 'dir', 'file1.txt'), 'content1');
    await fs.writeFile(path.join(tempDir, 'dir', 'file2.txt'), 'content2');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/dir' });

    expect(typeof result).toBe('string');
    expect(result).toContain('file1.txt');
    expect(result).toContain('file2.txt');
    expect(result).toContain('0 directories, 2 files');
  });

  it('should list files recursively with maxDepth', async () => {
    await fs.mkdir(path.join(tempDir, 'dir'));
    await fs.mkdir(path.join(tempDir, 'dir', 'subdir'));
    await fs.writeFile(path.join(tempDir, 'dir', 'file1.txt'), 'content1');
    await fs.writeFile(path.join(tempDir, 'dir', 'subdir', 'file2.txt'), 'content2');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/dir', maxDepth: 5 });

    expect(typeof result).toBe('string');
    expect(result).toContain('subdir');
    expect(result).toContain('file1.txt');
    expect(result).toContain('file2.txt');
    expect(result).toContain('1 directory');
    expect(result).toContain('2 files');
  });

  it('should respect maxDepth parameter (tree -L flag)', async () => {
    await fs.mkdir(path.join(tempDir, 'level1'));
    await fs.mkdir(path.join(tempDir, 'level1', 'level2'));
    await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'));
    await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'deep.txt'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/', maxDepth: 2 });

    expect(typeof result).toBe('string');
    expect(result).toContain('level1');
    expect(result).toContain('level2');
    expect(result).not.toContain('level3');
    expect(result).not.toContain('deep.txt');
    expect(result).toContain('truncated at depth 2');
  });

  it('should default maxDepth to 3', async () => {
    await fs.mkdir(path.join(tempDir, 'level1'));
    await fs.mkdir(path.join(tempDir, 'level1', 'level2'));
    await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'));
    await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3', 'level4'));
    await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'level4', 'deep.txt'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/' });

    expect(typeof result).toBe('string');
    expect(result).toContain('level1');
    expect(result).toContain('level2');
    expect(result).toContain('level3');
    expect(result).not.toContain('level4');
    expect(result).not.toContain('deep.txt');
    expect(result).toContain('truncated at depth 3');
  });

  it('should filter by extension (tree -P flag)', async () => {
    await fs.writeFile(path.join(tempDir, 'index.ts'), '');
    await fs.writeFile(path.join(tempDir, 'style.css'), '');
    await fs.writeFile(path.join(tempDir, 'utils.ts'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/', extension: '.ts' });

    expect(typeof result).toBe('string');
    expect(result).toContain('index.ts');
    expect(result).toContain('utils.ts');
    expect(result).not.toContain('style.css');
    expect(result).toContain('0 directories, 2 files');
  });

  it('should show hidden files with showHidden (tree -a flag)', async () => {
    await fs.writeFile(path.join(tempDir, '.gitignore'), '');
    await fs.writeFile(path.join(tempDir, 'visible.txt'), '');
    await fs.mkdir(path.join(tempDir, '.hidden-dir'));
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const resultHidden = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({ path: '/' });
    expect(resultHidden).not.toContain('.gitignore');
    expect(resultHidden).not.toContain('.hidden-dir');
    expect(resultHidden).toContain('visible.txt');

    const resultVisible = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
      path: '/',
      showHidden: true,
    });
    expect(resultVisible).toContain('.gitignore');
    expect(resultVisible).toContain('.hidden-dir');
    expect(resultVisible).toContain('visible.txt');
  });

  it('should list directories only with dirsOnly (tree -d flag)', async () => {
    await fs.mkdir(path.join(tempDir, 'src'));
    await fs.mkdir(path.join(tempDir, 'tests'));
    await fs.writeFile(path.join(tempDir, 'package.json'), '');
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
      path: '/',
      maxDepth: 3,
      dirsOnly: true,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('src');
    expect(result).toContain('tests');
    expect(result).not.toContain('package.json');
    expect(result).not.toContain('index.ts');
    expect(result).toContain('0 files');
  });

  it('should exclude patterns with exclude (tree -I flag)', async () => {
    await fs.mkdir(path.join(tempDir, 'src'));
    await fs.mkdir(path.join(tempDir, 'node_modules'));
    await fs.mkdir(path.join(tempDir, 'node_modules', 'lodash'));
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
      path: '/',
      maxDepth: 3,
      exclude: 'node_modules',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('src');
    expect(result).toContain('index.ts');
    expect(result).not.toContain('node_modules');
    expect(result).not.toContain('lodash');
  });

  it('should filter files by glob pattern', async () => {
    await fs.mkdir(path.join(tempDir, 'src'));
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
    await fs.writeFile(path.join(tempDir, 'src', 'style.css'), '');
    await fs.writeFile(path.join(tempDir, 'README.md'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
      path: '/',
      maxDepth: 5,
      pattern: '**/*.ts',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('index.ts');
    expect(result).not.toContain('style.css');
    expect(result).not.toContain('README.md');
  });

  it('should support multiple glob patterns', async () => {
    await fs.writeFile(path.join(tempDir, 'index.ts'), '');
    await fs.writeFile(path.join(tempDir, 'App.tsx'), '');
    await fs.writeFile(path.join(tempDir, 'style.css'), '');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute({
      path: '/',
      pattern: ['**/*.ts', '**/*.tsx'],
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('index.ts');
    expect(result).toContain('App.tsx');
    expect(result).not.toContain('style.css');
  });
});
