import type { MastraBrowser } from '@mastra/core/browser';
import { describe, expect, it, vi } from 'vitest';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { createFactorySandboxTools } from './sandbox-tools.js';
import type { FactoryToolScope } from './scope.js';

const scope: FactoryToolScope = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  userId: 'user-1',
  sessionId: 'session-1',
  resourceId: 'resource-1',
  threadId: 'thread-1',
  kind: 'worker',
  interactive: false,
};

const sourceControl = {} as SourceControlStorageHandle;

function recreateTool(outcome: 'reset' | 'not-found' | 'not-here', found = true) {
  const resetSandbox = vi.fn(async () => outcome);
  const getSourceControlBySessionId = vi.fn(async () => (found ? sourceControl : null));
  const tool = createFactorySandboxTools(scope, {
    sessions: { getSourceControlBySessionId },
    resetSandbox,
    findSandbox: vi.fn(async () => undefined),
  }).factory_recreate_sandbox!;
  const run = () =>
    (tool.execute as (input: { reason: string }, context: unknown) => Promise<unknown>)(
      { reason: 'echo ok times out' },
      {},
    );
  return { tool, run, resetSandbox, getSourceControlBySessionId };
}

describe('factory_recreate_sandbox', () => {
  it("resets the calling session's own sandbox, on turns nobody signed in started too", async () => {
    const { run, resetSandbox, getSourceControlBySessionId } = recreateTool('reset');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(run()).resolves.toEqual({ recreated: true, next: 'Your next command starts a fresh sandbox.' });

    expect(getSourceControlBySessionId).toHaveBeenCalledWith('session-1');
    expect(resetSandbox).toHaveBeenCalledWith({ sourceControl, orgId: 'org-1', sessionId: 'session-1' });
  });

  it('warns the agent that uncommitted and unpushed work is lost', () => {
    const { tool } = recreateTool('reset');
    expect(tool.description).toContain('not committed and pushed is lost');
  });

  it.each([
    ['not-found' as const, true, 'This session has no sandbox to recreate.'],
    ['reset' as const, false, 'This session has no sandbox to recreate.'],
    ['not-here' as const, true, 'This session has no sandbox running yet.'],
  ])('reports %s (row found: %s) as an error', async (outcome, found, message) => {
    const { run } = recreateTool(outcome, found);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(run()).rejects.toThrow(message);
  });
});

function portUrlTool(sandbox: object | undefined, found = true, browser?: object) {
  const findSandbox = vi.fn(async () => sandbox);
  const tool = createFactorySandboxTools(scope, {
    sessions: { getSourceControlBySessionId: vi.fn(async () => (found ? sourceControl : null)) },
    resetSandbox: vi.fn(async () => 'reset' as const),
    findSandbox,
    // Only setCookies matters here.
    ...(browser && { browser: browser as unknown as MastraBrowser }),
  }).factory_sandbox_port_url!;
  const run = (port: number, threadId: string | null = 'thread-1') =>
    (tool.execute as (input: { port: number }, context: unknown) => Promise<unknown>)(
      { port },
      threadId ? { agent: { threadId } } : {},
    );
  return { tool, run, findSandbox };
}

describe('factory_sandbox_port_url', () => {
  const cookie = { name: '__mastra_preview', value: 'secret', domain: '3000-sbx-1.preview.test', path: '/' };
  const url = 'https://3000-sbx-1.preview.test/';
  // A Platform sandbox: the standard port URL, plus a cookie for its own browser.
  const platformSandbox = (overrides: { getPortUrl?: () => Promise<string | null> } = {}) => ({
    networking: { getPortUrl: vi.fn(overrides.getPortUrl ?? (async () => url)) },
    getPortAuthCookie: vi.fn(async () => cookie),
  });

  it("returns only the shareable link from the calling session's own sandbox", async () => {
    const sandbox = platformSandbox();
    const { run, findSandbox } = portUrlTool(sandbox);

    await expect(run(3000)).resolves.toEqual({ url });
    expect(findSandbox).toHaveBeenCalledWith({ sourceControl, orgId: 'org-1', sessionId: 'session-1' });
    expect(sandbox.networking.getPortUrl).toHaveBeenCalledWith(3000);
  });

  it("signs the session's own browser in with the port auth cookie", async () => {
    const setCookies = vi.fn(async () => {});
    const sandbox = platformSandbox();
    const { run } = portUrlTool(sandbox, true, { setCookies });

    const result = await run(3000);

    expect(sandbox.getPortAuthCookie).toHaveBeenCalledWith(3000);
    expect(setCookies).toHaveBeenCalledWith([cookie], 'thread-1');
    // Nothing that signs a browser in goes back to the model.
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it("doesn't touch the browser without the calling thread", async () => {
    const setCookies = vi.fn(async () => {});
    const { run } = portUrlTool(platformSandbox(), true, { setCookies });

    await expect(run(3000, null)).resolves.toEqual({ url });
    expect(setCookies).not.toHaveBeenCalled();
  });

  it("still returns the link when the browser can't take cookies", async () => {
    const setCookies = vi.fn(async () => {
      throw new Error('no-cookies does not support setting cookies');
    });
    const { run } = portUrlTool(platformSandbox(), true, { setCookies });

    await expect(run(3000)).resolves.toEqual({ url });
  });

  it("logs why the browser wasn't signed in when the platform fails, and still returns the link", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setCookies = vi.fn(async () => {});
    const sandbox = platformSandbox();
    sandbox.getPortAuthCookie.mockRejectedValueOnce(new Error('Platform API 503'));
    const { run } = portUrlTool(sandbox, true, { setCookies });

    await expect(run(3000)).resolves.toEqual({ url });
    expect(setCookies).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[Mastra Factory] Couldn't sign the session's browser in to a sandbox port",
      expect.objectContaining({ port: 3000, error: 'Platform API 503' }),
    );
    warn.mockRestore();
  });

  it("returns the link alone on sandboxes that don't sign browsers in", async () => {
    const setCookies = vi.fn(async () => {});
    const { run } = portUrlTool({ networking: { getPortUrl: async () => url } }, true, { setCookies });

    await expect(run(3000)).resolves.toEqual({ url });
    expect(setCookies).not.toHaveBeenCalled();
  });

  it('reports a port the sandbox has no URL for as an error', async () => {
    const { run } = portUrlTool(platformSandbox({ getPortUrl: async () => null }));
    await expect(run(3000)).rejects.toThrow("Port 3000 can't be opened from this sandbox.");
  });

  it('tells the agent the link is safe to share and when to call again', () => {
    const { tool } = portUrlTool(undefined);
    expect(tool.description).toContain('so you can share it');
    expect(tool.description).toContain('call this again');
    // Dev servers started with a timeout stop, and some reject the preview's host.
    expect(tool.description).toContain('without a timeout');
    expect(tool.description).toContain('allowedHosts: true');
  });

  it.each([
    ['no session row', undefined, false, 'This session has no sandbox running yet.'],
    ['no running sandbox', undefined, true, 'This session has no sandbox running yet.'],
    ["a sandbox that can't expose ports", {}, true, "This session's sandbox can't expose ports."],
  ])('reports %s as an error', async (_case, sandbox, found, message) => {
    const { run } = portUrlTool(sandbox, found);
    await expect(run(3000)).rejects.toThrow(message);
  });
});
