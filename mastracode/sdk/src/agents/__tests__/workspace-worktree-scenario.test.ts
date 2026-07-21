import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));
vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

// Capture the workdir each SandboxFilesystem is constructed with so we can
// assert the workspace binds to the active worktree across re-opens.
const sandboxFsCalls: Array<{ workdir: string }> = [];
vi.mock('../sandbox-filesystem.js', () => ({
  SandboxFilesystem: class {
    workdir: string;
    constructor(opts: { workdir: string }) {
      this.workdir = opts.workdir;
      sandboxFsCalls.push({ workdir: opts.workdir });
    }
  },
}));

const reattachCalls: string[] = [];
vi.mock('../sandbox-reattach.js', () => ({
  reattachProjectSandbox: vi.fn(async (sandboxId: string) => {
    reattachCalls.push(sandboxId);
    return { executeCommand: vi.fn(), getInfo: vi.fn() };
  }),
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

/**
 * Minimal Mastra registry stand-in. `getDynamicWorkspace` reuses a workspace
 * only when `mastra.getWorkspaceById(id)` returns one, so the test mirrors the
 * real open/reopen lifecycle by registering each freshly-built workspace and
 * serving it back on the next resolve with the same reuse key.
 */
function createWorkspaceRegistry() {
  const registry = new Map<string, unknown>();
  return {
    getWorkspaceById: (id: string) => registry.get(id),
    register: (ws: { id: string }) => registry.set(ws.id, ws),
    size: () => registry.size,
  };
}

const baseState = {
  factoryProjectId: 'factory-project-1',
  projectRepositoryId: 'project-repository-1',
  sandboxId: 'sbx-1',
  sandboxWorkdir: '/workspace/hello',
  sandboxAllowedPaths: [],
};

afterEach(() => {
  sandboxFsCalls.length = 0;
  reattachCalls.length = 0;
  vi.resetModules();
});

describe('S5 — worktree reattach round-trip through the workspace seam', () => {
  it('binds, reuses on reopen, and rebuilds across a different worktree', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const reg = createWorkspaceRegistry();

    // Resolve helper that mimics how the server registers a newly-built
    // workspace before the next request can reuse it.
    const resolve = async (state: Record<string, unknown>) => {
      const ws = await getDynamicWorkspace({
        requestContext: createSandboxRequestContext(state) as any,
        mastra: reg as any,
      });
      reg.register(ws as { id: string });
      return ws;
    };

    // 1. First open on worktree feat-x: filesystem + sandbox bind to the
    //    worktree path, not the repo root.
    const first = await resolve({
      ...baseState,
      worktreePath: '/workspace/worktrees/feat-x',
      branch: 'feat/x',
    });
    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/worktrees/feat-x');
    expect(first.id).toBe('mastra-code-workspace-repository-project-repository-1-sbx-1-/workspace/worktrees/feat-x');
    expect(reattachCalls).toHaveLength(1);
    const fsCallsAfterFirst = sandboxFsCalls.length;

    // 2. Reopen with the SAME sandbox + worktree: the exact same Workspace
    //    instance is reused (reuse key honors the worktree). No new sandbox
    //    reattach and no new SandboxFilesystem are constructed.
    const second = await resolve({
      ...baseState,
      worktreePath: '/workspace/worktrees/feat-x',
      branch: 'feat/x',
    });
    expect(second).toBe(first);
    expect(reattachCalls).toHaveLength(1);
    expect(sandboxFsCalls.length).toBe(fsCallsAfterFirst);

    // 3. Reopen with the SAME sandbox but a DIFFERENT worktree: a brand new
    //    Workspace is built so no state leaks across feature branches.
    const third = await resolve({
      ...baseState,
      worktreePath: '/workspace/worktrees/feat-y',
      branch: 'feat/y',
    });
    expect(third).not.toBe(first);
    expect(third.id).toBe('mastra-code-workspace-repository-project-repository-1-sbx-1-/workspace/worktrees/feat-y');
    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/worktrees/feat-y');
    expect(reattachCalls).toHaveLength(2);
    expect(reg.size()).toBe(2);
  });

  it('reuses a worktree workspace independently from the base-checkout workspace', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const reg = createWorkspaceRegistry();
    const resolve = async (state: Record<string, unknown>) => {
      const ws = await getDynamicWorkspace({
        requestContext: createSandboxRequestContext(state) as any,
        mastra: reg as any,
      });
      reg.register(ws as { id: string });
      return ws;
    };

    // Base checkout (no worktree active) and a worktree both register distinct
    // workspaces on the same sandbox, and each reopen reuses its own instance.
    const base = await resolve({ ...baseState });
    const wt = await resolve({ ...baseState, worktreePath: '/workspace/worktrees/feat-x' });
    expect(base).not.toBe(wt);

    const baseAgain = await resolve({ ...baseState });
    const wtAgain = await resolve({ ...baseState, worktreePath: '/workspace/worktrees/feat-x' });
    expect(baseAgain).toBe(base);
    expect(wtAgain).toBe(wt);
    expect(reg.size()).toBe(2);
  });
});
