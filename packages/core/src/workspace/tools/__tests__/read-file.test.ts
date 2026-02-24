import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_read_file', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should read file content with line numbers by default', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: '/test.txt' });

    expect(typeof result).toBe('string');
    expect(result).toContain('/test.txt');
    expect(result).toContain('11 bytes');
    expect(result).toContain('1→Hello World');
  });

  it('should read file content without line numbers when showLineNumbers is false', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({
      path: '/test.txt',
      showLineNumbers: false,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('Hello World');
    expect(result).not.toContain('→Hello World');
  });

  it('should read file with offset and limit', async () => {
    const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    await fs.writeFile(path.join(tempDir, 'test.txt'), content);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({
      path: '/test.txt',
      offset: 2,
      limit: 2,
      showLineNumbers: false,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('lines 2-3 of 5');
    expect(result).toContain('Line 2\nLine 3');
  });

  it('should handle binary content', async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
    await fs.writeFile(path.join(tempDir, 'binary.bin'), buffer);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: '/binary.bin' });

    expect(typeof result).toBe('string');
    expect(result).toContain('/binary.bin');
    expect(result).toContain('4 bytes');
  });
});
