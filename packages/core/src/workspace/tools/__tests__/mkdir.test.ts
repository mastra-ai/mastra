import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: '/newdir' });

    expect(typeof result).toBe('string');
    expect(result).toBe('Created directory /newdir');

    const stat = await fs.stat(path.join(tempDir, 'newdir'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('should create nested directories', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: '/a/b/c' });

    expect(typeof result).toBe('string');
    expect(result).toBe('Created directory /a/b/c');

    const stat = await fs.stat(path.join(tempDir, 'a', 'b', 'c'));
    expect(stat.isDirectory()).toBe(true);
  });
});
