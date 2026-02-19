import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_delete', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should delete file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({ path: '/test.txt' });

    expect(typeof result).toBe('string');
    expect(result).toBe('Deleted /test.txt');

    const exists = await fs
      .access(path.join(tempDir, 'test.txt'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should delete empty directory', async () => {
    await fs.mkdir(path.join(tempDir, 'emptydir'));
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({ path: '/emptydir' });

    expect(typeof result).toBe('string');
    expect(result).toBe('Deleted /emptydir');

    const exists = await fs
      .access(path.join(tempDir, 'emptydir'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should delete directory recursively when recursive=true', async () => {
    await fs.mkdir(path.join(tempDir, 'dirwithfiles'));
    await fs.writeFile(path.join(tempDir, 'dirwithfiles', 'file.txt'), 'content');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({
      path: '/dirwithfiles',
      recursive: true,
    });

    expect(typeof result).toBe('string');
    expect(result).toBe('Deleted /dirwithfiles');

    const exists = await fs
      .access(path.join(tempDir, 'dirwithfiles'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});
