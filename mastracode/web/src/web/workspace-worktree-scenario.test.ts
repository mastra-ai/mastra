import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Capture the workdir each SandboxFilesystem is constructed with so we can
// assert the workspace binds to the sandbox workdir carried on session state.
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

const reattachCalls: Array<{ sandboxId: string }> = [];
vi.mock('./github/sandbox.js', () => ({
  reattachProjectSandbox: vi.fn(async (input: string | { sandboxId: string }) => {
    const sandboxId = typeof input === 'string' ? input : input.sandboxId;
    reattachCalls.push({ sandboxId });
    return { executeCommand: vi.fn(), getInfo: vi.fn() };
  }),
  ensureRepoCheckout: vi.fn(async () => {}),
}));

vi.mock('./github/client.js', () => ({
  mintInstallationToken: vi.fn(async () => 'app-token'),
}));

function createSandboxRequestContext(state: Record<string, unknown>, sessionId: string) {
  const requestContext = new RequestContext();
  const getState = () => state;
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { id: sessionId, state: { get: getState } },
  });
  return requestContext;
}

/**
 * Minimal Mastra registry stand-in. `getWebWorkspace` reuses a workspace only
 * when `mastra.getWorkspaceById(id)` returns one, so the test mirrors the real
 * open/reopen lifecycle by registering each freshly-built workspace and
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
  githubProjectId: 'proj-1',
  sandboxId: 'sbx-1',
  sandboxWorkdir: '/workspace/hello',
  sandboxAllowedPaths: [],
};

afterEach(() => {
  sandboxFsCalls.length = 0;
  reattachCalls.length = 0;
  vi.resetModules();
});

describe('S5 — sandbox workspace reattach round-trip through the workspace seam', () => {
  it('binds the workspace to the session id and sandbox workdir, and reuses on reopen', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    const reg = createWorkspaceRegistry();

    // Resolve helper that mimics how the server registers a newly-built
    // workspace before the next request can reuse it.
    const resolve = async (state: Record<string, unknown>, sessionId: string) => {
      const ws = await getWebWorkspace({
        requestContext: createSandboxRequestContext(state, sessionId) as any,
        mastra: reg as any,
      });
      reg.register(ws as { id: string });
      return ws;
    };

    // 1. First open: filesystem is bound to the sandbox workdir from state,
    //    and the workspace id is keyed off the session id.
    const first = await resolve({ ...baseState }, 'session-1');
    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/hello');
    expect(first.id).toBe('mc-session-1');
    expect(reattachCalls).toHaveLength(1);
    const fsCallsAfterFirst = sandboxFsCalls.length;

    // 2. Reopen with the SAME session id: the exact same Workspace instance
    //    is reused. No new sandbox reattach and no new SandboxFilesystem are
    //    constructed.
    const second = await resolve({ ...baseState }, 'session-1');
    expect(second).toBe(first);
    expect(reattachCalls).toHaveLength(1);
    expect(sandboxFsCalls.length).toBe(fsCallsAfterFirst);

    // 3. A DIFFERENT session id: a brand new Workspace is built so no state
    //    leaks across sessions on the same underlying sandbox.
    const third = await resolve({ ...baseState }, 'session-2');
    expect(third).not.toBe(first);
    expect(third.id).toBe('mc-session-2');
    expect(reattachCalls).toHaveLength(2);
    expect(reg.size()).toBe(2);
  });

  it('reuses separate workspaces for each session id independently', async () => {
    const { getWebWorkspace } = await import('./workspace.js');
    const reg = createWorkspaceRegistry();
    const resolve = async (state: Record<string, unknown>, sessionId: string) => {
      const ws = await getWebWorkspace({
        requestContext: createSandboxRequestContext(state, sessionId) as any,
        mastra: reg as any,
      });
      reg.register(ws as { id: string });
      return ws;
    };

    // Two separate sessions register two distinct workspaces on the same
    // sandbox, and each reopen reuses its own instance.
    const a = await resolve({ ...baseState }, 'session-A');
    const b = await resolve({ ...baseState }, 'session-B');
    expect(a).not.toBe(b);

    const aAgain = await resolve({ ...baseState }, 'session-A');
    const bAgain = await resolve({ ...baseState }, 'session-B');
    expect(aAgain).toBe(a);
    expect(bAgain).toBe(b);
  });
});
