import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Capture the workdir the SandboxFilesystem is constructed with so we can assert
// the workspace binds to the worktree path rather than the repo root.
const sandboxFsCalls: Array<{ workdir: string }> = [];
const ensureRepoCheckout = vi.fn(async () => {});
const mintInstallationToken = vi.fn(async () => 'app-token');
const reattachProjectSandbox = vi.fn(async () => ({
  executeCommand: vi.fn(),
  getInfo: vi.fn(),
}));

vi.mock('./github/client.js', () => ({
  mintInstallationToken,
}));

vi.mock('./github/sandbox-filesystem.js', () => ({
  SandboxFilesystem: class {
    workdir: string;
    constructor(opts: { workdir: string }) {
      this.workdir = opts.workdir;
      sandboxFsCalls.push({ workdir: opts.workdir });
    }
  },
}));

vi.mock('./github/sandbox.js', () => ({
  ensureRepoCheckout,
  reattachProjectSandbox,
}));

function createSandboxRequestContext(state: Record<string, unknown>) {
  const requestContext = new RequestContext();
  const getState = () => state;
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { id: 'session-sandbox-1', state: { get: getState } },
  });
  return requestContext;
}

const baseState = {
  githubProjectId: 'proj-1',
  sandboxId: 'sbx-1',
  sandboxWorkdir: '/workspace/hello',
  repoFullName: 'octocat/hello',
  defaultBranch: 'main',
  installationId: 123,
  sandboxAllowedPaths: [],
};

afterEach(() => {
  sandboxFsCalls.length = 0;
  ensureRepoCheckout.mockClear();
  mintInstallationToken.mockClear();
  reattachProjectSandbox.mockClear();
  vi.resetModules();
});

describe('getWebWorkspace', () => {
  it('uses a minimal local filesystem workspace when GitHub metadata is absent', async () => {
    const projectPath = '/tmp/mastracode-web-local-workspace';
    const { LocalFilesystem } = await import('@mastra/core/workspace');
    const { getWebWorkspace } = await import('./workspace.js');

    const workspace = await getWebWorkspace({
      requestContext: createSandboxRequestContext({ projectPath }) as any,
    });

    const filesystem = workspace.filesystem as InstanceType<typeof LocalFilesystem>;
    expect(filesystem).toBeInstanceOf(LocalFilesystem);
    expect(filesystem.basePath).toBe(projectPath);
    expect(workspace.sandbox).toBeUndefined();
    expect(sandboxFsCalls).toHaveLength(0);
  });

  it('binds the workspace to the repo root when no worktree is active', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    const workspace = await getWebWorkspace({
      requestContext: createSandboxRequestContext({ ...baseState }) as any,
    });

    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/hello');
    expect(workspace.id).toBe('mc-session-sandbox-1');
    expect(mintInstallationToken).toHaveBeenCalledWith(123);
    expect(reattachProjectSandbox).toHaveBeenCalledWith({
      sandboxId: 'session-sandbox-1',
    });
    expect(ensureRepoCheckout).toHaveBeenCalledWith(
      expect.anything(),
      '/workspace/hello',
      { repoFullName: 'octocat/hello', defaultBranch: 'main' },
      'app-token',
    );
  });

  it('binds the workspace to the sandbox workdir even when a branch is active', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    const workspace = await getWebWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-x',
        branch: 'feat/x',
      }) as any,
    });

    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/hello');
    expect(workspace.id).toBe('mc-session-sandbox-1');
  });

  it('skips checkout when repo metadata is incomplete', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    await getWebWorkspace({
      requestContext: createSandboxRequestContext({
        githubProjectId: 'proj-1',
        sandboxWorkdir: '/workspace/hello',
      }) as any,
    });

    expect(mintInstallationToken).not.toHaveBeenCalled();
    expect(ensureRepoCheckout).not.toHaveBeenCalled();
  });
});
