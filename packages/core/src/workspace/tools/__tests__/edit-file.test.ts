import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_edit_file', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should replace unique string in file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
      path: '/test.txt',
      old_string: 'World',
      new_string: 'Universe',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('Replaced 1 occurrence');
    expect(result).toContain('/test.txt');

    const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
    expect(content).toBe('Hello Universe');
  });

  it('should fail when old_string not found', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
      path: '/test.txt',
      old_string: 'foo',
      new_string: 'bar',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('not found');
  });

  it('should fail when old_string not unique without replace_all', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello hello hello');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
      path: '/test.txt',
      old_string: 'hello',
      new_string: 'hi',
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('3 times');
  });

  it('should replace all occurrences with replace_all', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello hello hello');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute({
      path: '/test.txt',
      old_string: 'hello',
      new_string: 'hi',
      replace_all: true,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('Replaced 3 occurrence');

    const content = await fs.readFile(path.join(tempDir, 'test.txt'), 'utf-8');
    expect(content).toBe('hi hi hi');
  });
});
