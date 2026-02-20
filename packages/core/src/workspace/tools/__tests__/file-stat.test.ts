import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_file_stat', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should return stat string for existing file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute({ path: '/test.txt' });

    expect(typeof result).toBe('string');
    expect(result).toContain('/test.txt');
    expect(result).toContain('Type: file');
    expect(result).toContain('Size: 7 bytes');
    expect(result).toContain('Modified:');
  });

  it('should return not found for non-existing path', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute({ path: '/nonexistent' });

    expect(typeof result).toBe('string');
    expect(result).toBe('/nonexistent: not found');
  });

  it('should return type=directory for directories', async () => {
    await fs.mkdir(path.join(tempDir, 'subdir'));
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute({ path: '/subdir' });

    expect(typeof result).toBe('string');
    expect(result).toContain('/subdir');
    expect(result).toContain('Type: directory');
    expect(result).toContain('Modified:');
  });
});
