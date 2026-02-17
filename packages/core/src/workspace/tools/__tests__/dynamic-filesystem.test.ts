import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { RequestContext } from '../../../request-context';
import { WORKSPACE_TOOLS } from '../../constants';
import { WorkspaceError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('dynamic filesystem tools', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-dynfs-tools-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should create filesystem tools when workspace has a filesystem resolver', () => {
    const resolver = () => new LocalFilesystem({ basePath: tempDir });
    const workspace = new Workspace({ filesystem: resolver });

    const tools = createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
  });

  it('should resolve filesystem from requestContext during tool execution', async () => {
    await fs.writeFile(path.join(tempDir, 'hello.txt'), 'dynamic content');

    const resolver = () => new LocalFilesystem({ basePath: tempDir });
    const workspace = new Workspace({ filesystem: resolver });
    const tools = createWorkspaceTools(workspace);

    const ctx = { requestContext: new RequestContext() };
    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: '/hello.txt', showLineNumbers: false },
      ctx,
    );

    expect(result).toContain('dynamic content');
  });

  it('should resolve different filesystems per request', async () => {
    const dirA = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-tool-a-'));
    const dirB = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-tool-b-'));
    try {
      await fs.writeFile(path.join(dirA, 'data.txt'), 'admin data');
      await fs.writeFile(path.join(dirB, 'data.txt'), 'user data');

      const resolver = ({ requestContext }: { requestContext: RequestContext }) => {
        const role = requestContext.get('role') as string;
        return role === 'admin' ? new LocalFilesystem({ basePath: dirA }) : new LocalFilesystem({ basePath: dirB });
      };
      const workspace = new Workspace({ filesystem: resolver });
      const tools = createWorkspaceTools(workspace);

      const adminResult = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
        { path: '/data.txt', showLineNumbers: false },
        { requestContext: new RequestContext([['role', 'admin']]) },
      );
      const userResult = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
        { path: '/data.txt', showLineNumbers: false },
        { requestContext: new RequestContext([['role', 'user']]) },
      );

      expect(adminResult).toContain('admin data');
      expect(userResult).toContain('user data');
    } finally {
      await fs.rm(dirA, { recursive: true, force: true });
      await fs.rm(dirB, { recursive: true, force: true });
    }
  });

  it('should block writes on read-only resolved filesystem at execution time', async () => {
    const resolver = () => new LocalFilesystem({ basePath: tempDir, readOnly: true });
    const workspace = new Workspace({ filesystem: resolver });
    const tools = createWorkspaceTools(workspace);

    const ctx = { requestContext: new RequestContext() };

    // write_file should throw WorkspaceReadOnlyError
    await expect(
      tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute({ path: '/test.txt', content: 'fail' }, ctx),
    ).rejects.toThrow(/read.only/i);

    // edit_file should throw WorkspaceReadOnlyError
    await fs.writeFile(path.join(tempDir, 'existing.txt'), 'content');
    await expect(
      tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute(
        { path: '/existing.txt', old_string: 'content', new_string: 'new' },
        ctx,
      ),
    ).rejects.toThrow(/read.only/i);

    // delete should throw WorkspaceReadOnlyError
    await expect(tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute({ path: '/existing.txt' }, ctx)).rejects.toThrow(
      /read.only/i,
    );

    // mkdir should throw WorkspaceReadOnlyError
    await expect(tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute({ path: '/newdir' }, ctx)).rejects.toThrow(
      /read.only/i,
    );
  });

  it('should allow reads on read-only resolved filesystem', async () => {
    await fs.writeFile(path.join(tempDir, 'readable.txt'), 'hello');

    const resolver = () => new LocalFilesystem({ basePath: tempDir, readOnly: true });
    const workspace = new Workspace({ filesystem: resolver });
    const tools = createWorkspaceTools(workspace);

    const ctx = { requestContext: new RequestContext() };
    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: '/readable.txt', showLineNumbers: false },
      ctx,
    );

    expect(result).toContain('hello');
  });
});
