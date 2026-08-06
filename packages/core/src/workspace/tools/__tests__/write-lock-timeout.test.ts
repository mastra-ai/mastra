import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RequestContext } from '../../../request-context';
import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

// Regression coverage for the `writeLockTimeoutMs` workspace-tools option:
// `createWorkspaceTools` must forward it to the shared write lock, and leaving
// it unset must preserve the lock's own 30s default. See issue #20807.
describe('workspace write-lock timeout config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-write-lock-timeout-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('honors tools.writeLockTimeoutMs — a hung write is rejected after the configured window, not the 30s default', async () => {
    // Make the underlying write hang forever so the only thing that can end the
    // call is the write lock's timeout.
    vi.spyOn(LocalFilesystem.prototype, 'writeFile').mockImplementation(
      () => new Promise<void>(() => {}),
    );

    const workspace = new Workspace({
      filesystem: () => new LocalFilesystem({ basePath: tempDir }),
      tools: { writeLockTimeoutMs: 50 },
    });
    const tools = await createWorkspaceTools(workspace);

    const ctx = { requestContext: new RequestContext() };
    const write = tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
      { path: 'hang.txt', content: 'never lands' },
      ctx,
    );

    // The configured 50ms timeout — proving the option reached the lock. If it
    // did not, the message would read `after 30000ms` (and the test would hang).
    await expect(write).rejects.toThrow(/write-lock timeout on "hang\.txt" after 50ms/);
  });

  it('leaves the default untouched when writeLockTimeoutMs is unset — writes still succeed', async () => {
    const workspace = new Workspace({
      filesystem: () => new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const ctx = { requestContext: new RequestContext() };
    await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
      { path: 'ok.txt', content: 'hello' },
      ctx,
    );

    expect(await fs.readFile(path.join(tempDir, 'ok.txt'), 'utf-8')).toBe('hello');
  });
});
