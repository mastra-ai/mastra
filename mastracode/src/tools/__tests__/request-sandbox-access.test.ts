import * as os from 'node:os';
import * as path from 'node:path';
import { LocalFilesystem } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { requestSandboxAccessTool } from '../request-sandbox-access.js';

function createMockLocalFilesystem() {
  const tmpDir = os.tmpdir();
  const fs = new LocalFilesystem({ basePath: path.join(tmpDir, 'test-sandbox-access'), contained: true });
  const spy = vi.spyOn(fs, 'setAllowedPaths');
  return { fs, setAllowedPaths: spy };
}

function createAgentControllerCtx(state: Record<string, unknown> = {}) {
  const getState = () => ({ sandboxAllowedPaths: [], ...state });
  const setState = vi.fn();
  return {
    getState,
    setState,
    session: {
      state: {
        get: getState,
        set: setState,
      },
    },
  };
}

/**
 * The tool pauses via the native tool-suspension primitive. The first pass calls
 * `suspend({ kind, path, reason })` and returns; the host resumes the tool with the
 * user's answer as `resumeData`. These helpers exercise both passes.
 */
function suspendPass(agentControllerCtx: any, fs?: any) {
  const suspend = vi.fn();
  const context = {
    agent: { suspend },
    requestContext: { get: (key: string) => (key === 'controller' ? agentControllerCtx : undefined) },
    workspace: fs ? { filesystem: fs } : {},
  };
  return { context, suspend };
}

function resumePass(answer: string, agentControllerCtx: any, fs?: any) {
  const context = {
    agent: { resumeData: answer },
    requestContext: { get: (key: string) => (key === 'controller' ? agentControllerCtx : undefined) },
    workspace: fs ? { filesystem: fs } : {},
  };
  return { context };
}

describe('request_access', () => {
  it('suspends with the request payload on the first pass', async () => {
    const agentControllerCtx = createAgentControllerCtx();
    const { context, suspend } = suspendPass(agentControllerCtx);

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'need to read config' },
      context,
    );

    // Suspending returns no value; the suspend payload carries the request details.
    expect(result).toBeUndefined();
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend.mock.calls[0]![0]).toEqual({
      kind: 'sandbox_access_request',
      path: '/outside/project/dir',
      reason: 'need to read config',
    });
  });

  it('calls setAllowedPaths on workspace filesystem when access is approved', async () => {
    const { fs, setAllowedPaths } = createMockLocalFilesystem();
    const agentControllerCtx = createAgentControllerCtx();
    const { context } = resumePass('yes', agentControllerCtx, fs);

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'need to read config' },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');

    // The grant must be persisted to controller state so the workspace factory
    // re-derives the same allowlist on the next tool call (otherwise the
    // factory's setAllowedPaths rebuild clobbers the in-turn widen below).
    expect(agentControllerCtx.setState).toHaveBeenCalledTimes(1);
    expect(agentControllerCtx.setState).toHaveBeenCalledWith({
      sandboxAllowedPaths: ['/outside/project/dir'],
    });

    // The key assertion: setAllowedPaths must be called mid-turn
    expect(setAllowedPaths).toHaveBeenCalledTimes(1);
    const arg = setAllowedPaths.mock.calls[0]![0];
    expect(typeof arg).toBe('function');
    // The updater should append the new path
    const updater = arg as (current: readonly string[]) => string[];
    expect(updater([])).toEqual(['/outside/project/dir']);
    expect(updater(['/existing'])).toEqual(['/existing', '/outside/project/dir']);
  });

  it('widens the live filesystem via the controller context when tool context has no workspace', async () => {
    // Regression: in the real runtime the tool-execution context does NOT
    // expose `workspace` (it is undefined). The live, resolved workspace is
    // only reachable through the controller request context. Granting access must
    // widen that filesystem so same-turn `view` calls can read the path.
    const { fs, setAllowedPaths } = createMockLocalFilesystem();
    const getState = () => ({ sandboxAllowedPaths: [] });
    const setState = vi.fn();
    const agentControllerCtx: any = {
      getState,
      setState,
      session: {
        state: {
          get: getState,
          set: setState,
        },
      },
      workspace: { filesystem: fs },
    };
    // Tool context intentionally has NO workspace, matching production.
    const context = {
      agent: { resumeData: 'yes' },
      requestContext: { get: (key: string) => (key === 'controller' ? agentControllerCtx : undefined) },
    };

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'need to read config' },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');
    // The live filesystem from the controller context must be widened.
    expect(setAllowedPaths).toHaveBeenCalledTimes(1);
    const updater = setAllowedPaths.mock.calls[0]![0] as (c: readonly string[]) => string[];
    expect(updater(['/existing'])).toEqual(['/existing', '/outside/project/dir']);
  });

  it('does not call setAllowedPaths when access is denied', async () => {
    const { fs, setAllowedPaths } = createMockLocalFilesystem();
    const agentControllerCtx = createAgentControllerCtx();
    const { context } = resumePass('no', agentControllerCtx, fs);

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'need to read config' },
      context,
    );

    expect(result.content).toContain('Access denied');
    expect(setAllowedPaths).not.toHaveBeenCalled();
  });

  it('works when workspace has no filesystem', async () => {
    const agentControllerCtx = createAgentControllerCtx();
    const { context } = resumePass('yes', agentControllerCtx);

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'testing' },
      context,
    );

    // Should still succeed — just won't call setAllowedPaths
    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');
  });

  it('expands tilde paths instead of nesting under project root', async () => {
    const { fs, setAllowedPaths } = createMockLocalFilesystem();
    const agentControllerCtx = createAgentControllerCtx();
    const { context } = resumePass('yes', agentControllerCtx, fs);

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '~/.config/opencode', reason: 'need config access' },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');
    // Must resolve to the real home dir, not nest under project root
    const expectedPath = os.homedir() + '/.config/opencode';
    expect(result.content).toContain(expectedPath);
    expect(result.content).not.toContain('already granted');

    // setAllowedPaths should be called with the expanded path
    expect(setAllowedPaths).toHaveBeenCalledTimes(1);
    const arg = setAllowedPaths.mock.calls[0]![0];
    const updater = arg as (current: readonly string[]) => string[];
    expect(updater([])).toEqual([expectedPath]);
  });

  it('works when filesystem lacks setAllowedPaths method', async () => {
    const agentControllerCtx = createAgentControllerCtx();
    const context = {
      agent: { resumeData: 'yes' },
      requestContext: { get: (key: string) => (key === 'controller' ? agentControllerCtx : undefined) },
      workspace: { filesystem: {} }, // no setAllowedPaths
    };

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'testing' },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');
  });
});
