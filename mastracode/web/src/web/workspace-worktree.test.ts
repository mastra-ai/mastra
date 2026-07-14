import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Capture the workdir the SandboxFilesystem is constructed with so we can assert
// the workspace binds to the worktree path rather than the repo root.
const sandboxFsCalls: Array<{ workdir: string }> = [];
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
  reattachProjectSandbox: vi.fn(async () => ({
    executeCommand: vi.fn(),
    getInfo: vi.fn(),
  })),
}));

function createSandboxRequestContext(state: Record<string, unknown>) {
  const requestContext = new RequestContext();
  const getState = () => state;
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { state: { get: getState } },
  });
  return requestContext;
}

const baseState = {
  githubProjectId: 'proj-1',
  sandboxId: 'sbx-1',
  sandboxWorkdir: '/workspace/hello',
  sandboxAllowedPaths: [],
};

afterEach(() => {
  sandboxFsCalls.length = 0;
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
    // Reuse key embeds the bound workdir (repo root here).
    expect(workspace.id).toBe('mastra-code-workspace-gh-proj-1-sbx-1-/workspace/hello');
  });

  it('binds the workspace to the worktree path when one is active', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    const workspace = await getWebWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-x',
        branch: 'feat/x',
      }) as any,
    });

    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/worktrees/feat-x');
    // Reuse key includes the worktree path, so a different worktree gets a fresh workspace.
    expect(workspace.id).toBe('mastra-code-workspace-gh-proj-1-sbx-1-/workspace/worktrees/feat-x');
  });

  it('produces distinct reuse keys for different worktrees on the same sandbox', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    const a = await getWebWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-a',
      }) as any,
    });
    const b = await getWebWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-b',
      }) as any,
    });

    expect(a.id).not.toBe(b.id);
  });
});
