import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SandboxFilesystem } from '@mastra/code-sdk/agents/sandbox-filesystem';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { Workspace, executeCommandTool } from '@mastra/core/workspace';
import type { LocalSandbox } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalFactorySandbox } from './local-factory-sandbox.js';
import {
  __clearSessionSandboxesForTests,
  getSessionSandbox,
  resolveSessionWorkdir,
  sessionLayout,
} from './session-sandbox.js';

const execute = executeCommandTool.execute!;

const SESSION_ID = 'sess-cwd';
const REPO = 'acme/api';
/** The directory `deriveLocalWorkdir` checks the session's own repository out into. */
const REPO_DIR = 'api';

/**
 * A local session's sandbox roots its working directory at the session root,
 * while the workspace filesystem is rooted at the checkout one level below. A
 * shell command and a file tool must still resolve `.artifacts/plans/x.md` to
 * the same file, so a plan written by the shell is the plan the plan card loads.
 */
describe('session shell cwd', () => {
  let root: string;
  let sandbox: LocalSandbox;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'factory-cwd-'));
    sandbox = new LocalFactorySandbox({ root }).create({ sessionId: SESSION_ID, getRepositoryAccess: undefined }, {});
    await sandbox._start();
  });

  afterEach(async () => {
    await sandbox.destroy();
    __clearSessionSandboxesForTests();
    await rm(root, { recursive: true, force: true });
  });

  const workspaceFilesystem = () => {
    const entry = getSessionSandbox(SESSION_ID, REPO, () => sandbox);
    const layout = sessionLayout(entry)!;
    return { filesystem: new SandboxFilesystem({ sandbox, workdir: layout.root }), layout };
  };

  it('roots the sandbox at the session root and the checkout one level below it', async () => {
    const workdir = await resolveSessionWorkdir(SESSION_ID, sandbox, REPO);

    expect(sandbox.workingDirectory).toBe(join(root, SESSION_ID));
    expect(workdir).toBe(join(root, SESSION_ID, REPO_DIR));
  });

  it('reports the checkout as the directory shell commands default to', async () => {
    const { filesystem, layout } = workspaceFilesystem();

    expect(layout.root).toBe(join(root, SESSION_ID, REPO_DIR));
    await expect(filesystem.getCommandCwd()).resolves.toBe(join(root, SESSION_ID, REPO_DIR));
  });

  it('finds a file a shell command wrote by a relative path', async () => {
    const { filesystem, layout } = workspaceFilesystem();
    await mkdir(layout.root, { recursive: true });

    const workspace = new Workspace({ sandbox, filesystem });
    const context = { workspace, writer: { custom: () => {} } } as unknown as ToolExecutionContext;

    await execute(
      {
        command: 'mkdir -p .artifacts/plans && printf "plan\\n" > .artifacts/plans/test.md',
        timeout: null,
        cwd: null,
        tail: null,
      },
      context,
    );

    await expect(filesystem.readFile('.artifacts/plans/test.md', { encoding: 'utf8' })).resolves.toBe('plan\n');
    // The same relative path must not also land at the session root the sandbox
    // itself is rooted at: one path, one file.
    await expect(readFile(join(root, SESSION_ID, '.artifacts/plans/test.md'), 'utf8')).rejects.toThrow();
  });

  it('reads a file a file tool wrote from a shell command at a relative path', async () => {
    const { filesystem, layout } = workspaceFilesystem();
    await mkdir(layout.root, { recursive: true });

    await filesystem.writeFile('.artifacts/plans/written-by-tool.md', 'from the tool\n');

    const workspace = new Workspace({ sandbox, filesystem });
    const context = { workspace, writer: { custom: () => {} } } as unknown as ToolExecutionContext;

    const result = await execute(
      { command: 'cat .artifacts/plans/written-by-tool.md', timeout: null, cwd: null, tail: null },
      context,
    );

    expect(result).toContain('from the tool');
  });
});
