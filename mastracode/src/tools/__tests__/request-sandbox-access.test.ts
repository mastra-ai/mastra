import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LocalFilesystem } from '@mastra/core/workspace';

import { requestSandboxAccessTool } from '../request-sandbox-access.js';

function createMockLocalFilesystem() {
  const tmpDir = os.tmpdir();
  const fs = new LocalFilesystem({ basePath: path.join(tmpDir, 'test-sandbox-access'), contained: true });
  const spy = vi.spyOn(fs, 'setAllowedPaths');
  return { fs, setAllowedPaths: spy };
}

describe('request_sandbox_access', () => {
  it('calls setAllowedPaths on workspace filesystem when access is approved', async () => {
    const { fs, setAllowedPaths } = createMockLocalFilesystem();

    const mockHarnessCtx = {
      emitEvent: vi.fn(),
      registerQuestion: vi.fn(({ resolve }: { questionId: string; resolve: (answer: string) => void }) => {
        // Simulate immediate user approval
        resolve('yes');
      }),
      getState: () => ({ sandboxAllowedPaths: [] }),
      setState: vi.fn(),
    };

    const context = {
      requestContext: {
        get: (key: string) => (key === 'harness' ? mockHarnessCtx : undefined),
      },
      workspace: {
        filesystem: fs,
      },
    };

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'need to read config' },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');

    // The key assertion: setAllowedPaths must be called mid-turn
    expect(setAllowedPaths).toHaveBeenCalledTimes(1);
    const arg = setAllowedPaths.mock.calls[0]![0];
    expect(typeof arg).toBe('function');
    // The updater should append the new path
    const updater = arg as (current: readonly string[]) => string[];
    expect(updater([])).toEqual(['/outside/project/dir']);
    expect(updater(['/existing'])).toEqual(['/existing', '/outside/project/dir']);
  });

  it('does not call setAllowedPaths when access is denied', async () => {
    const { fs, setAllowedPaths } = createMockLocalFilesystem();

    const mockHarnessCtx = {
      emitEvent: vi.fn(),
      registerQuestion: vi.fn(({ resolve }: { questionId: string; resolve: (answer: string) => void }) => {
        resolve('no');
      }),
      getState: () => ({ sandboxAllowedPaths: [] }),
      setState: vi.fn(),
    };

    const context = {
      requestContext: {
        get: (key: string) => (key === 'harness' ? mockHarnessCtx : undefined),
      },
      workspace: {
        filesystem: fs,
      },
    };

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'need to read config' },
      context,
    );

    expect(result.content).toContain('Access denied');
    expect(setAllowedPaths).not.toHaveBeenCalled();
  });

  it('works when workspace has no filesystem', async () => {
    const mockHarnessCtx = {
      emitEvent: vi.fn(),
      registerQuestion: vi.fn(({ resolve }: { questionId: string; resolve: (answer: string) => void }) => {
        resolve('yes');
      }),
      getState: () => ({ sandboxAllowedPaths: [] }),
      setState: vi.fn(),
    };

    const context = {
      requestContext: {
        get: (key: string) => (key === 'harness' ? mockHarnessCtx : undefined),
      },
      workspace: {},
    };

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

    const mockHarnessCtx = {
      emitEvent: vi.fn(),
      registerQuestion: vi.fn(({ resolve }: { questionId: string; resolve: (answer: string) => void }) => {
        resolve('yes');
      }),
      getState: () => ({ sandboxAllowedPaths: [] }),
      setState: vi.fn(),
    };

    const context = {
      requestContext: {
        get: (key: string) => (key === 'harness' ? mockHarnessCtx : undefined),
      },
      workspace: {
        filesystem: fs,
      },
    };

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
    const mockHarnessCtx = {
      emitEvent: vi.fn(),
      registerQuestion: vi.fn(({ resolve }: { questionId: string; resolve: (answer: string) => void }) => {
        resolve('yes');
      }),
      getState: () => ({ sandboxAllowedPaths: [] }),
      setState: vi.fn(),
    };

    const context = {
      requestContext: {
        get: (key: string) => (key === 'harness' ? mockHarnessCtx : undefined),
      },
      workspace: {
        filesystem: {}, // no setAllowedPaths
      },
    };

    const result = await (requestSandboxAccessTool as any).execute(
      { path: '/outside/project/dir', reason: 'testing' },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain('Access granted');
  });
});
