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

function portUrlTool(sandbox: object | undefined, found = true) {
  const findSandbox = vi.fn(async () => sandbox);
  const tool = createFactorySandboxTools(scope, {
    sessions: { getSourceControlBySessionId: vi.fn(async () => (found ? sourceControl : null)) },
    resetSandbox: vi.fn(async () => 'reset' as const),
    findSandbox,
  }).factory_sandbox_port_url!;
  const run = (port: number) =>
    (tool.execute as (input: { port: number }, context: unknown) => Promise<unknown>)({ port }, {});
  return { tool, run, findSandbox };
}

describe('factory_sandbox_port_url', () => {
  it("returns the links from the calling session's own sandbox", async () => {
    const links = {
      url: 'https://3000.sbx-1.preview.test/',
      signInUrl: 'https://3000.sbx-1.preview.test/__mastra/grant?g=abc',
    };
    const getPortUrl = vi.fn(async () => links);
    const { run, findSandbox } = portUrlTool({ getPortUrl });

    await expect(run(3000)).resolves.toEqual(links);
    expect(findSandbox).toHaveBeenCalledWith({ sourceControl, orgId: 'org-1', sessionId: 'session-1' });
    expect(getPortUrl).toHaveBeenCalledWith(3000);
  });

  it('tells the agent which link to share and which to keep to itself', () => {
    const { tool } = portUrlTool(undefined);
    expect(tool.description).toContain('`url` is the link to share');
    expect(tool.description).toContain('Never share it or post it anywhere.');
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
