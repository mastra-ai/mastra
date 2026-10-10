import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { PermissionError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_write_file', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should write file content', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
      {
        path: 'new.txt',
        content: 'New content',
      },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('Wrote 11 bytes to new.txt');

    const written = await fs.readFile(path.join(tempDir, 'new.txt'), 'utf-8');
    expect(written).toBe('New content');
  });

  it('should overwrite existing file by default', async () => {
    await fs.writeFile(path.join(tempDir, 'existing.txt'), 'original');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    // Read first (required by safety)
    await workspace.filesystem!.readFile('existing.txt');

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
      {
        path: 'existing.txt',
        content: 'updated',
      },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('Wrote');

    const written = await fs.readFile(path.join(tempDir, 'existing.txt'), 'utf-8');
    expect(written).toBe('updated');
  });

  it('should refuse to create a file outside the workspace through a symlinked ancestor', async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-outside-'));
    try {
      await fs.symlink(outsideDir, path.join(tempDir, 'alias'));
      const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
      const tools = await createWorkspaceTools(workspace);

      await expect(
        tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
          { path: 'alias/escaped.txt', content: 'outside' },
          { workspace },
        ),
      ).rejects.toThrow(PermissionError);
      await expect(fs.access(path.join(outsideDir, 'escaped.txt'))).rejects.toThrow();
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });
});
