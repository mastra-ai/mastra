import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { PermissionError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_mkdir', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should create directory', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: 'newdir' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toBe('Created directory newdir');

    const stat = await fs.stat(path.join(tempDir, 'newdir'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('should create nested directories', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: 'a/b/c' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toBe('Created directory a/b/c');

    const stat = await fs.stat(path.join(tempDir, 'a', 'b', 'c'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('should refuse to create a directory outside the workspace through a symlinked ancestor', async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-outside-'));
    try {
      await fs.symlink(outsideDir, path.join(tempDir, 'alias'));
      const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
      const tools = await createWorkspaceTools(workspace);

      await expect(
        tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: 'alias/escaped' }, { workspace }),
      ).rejects.toThrow(PermissionError);
      await expect(fs.access(path.join(outsideDir, 'escaped'))).rejects.toThrow();
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });
});
