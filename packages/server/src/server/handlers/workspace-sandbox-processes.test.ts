import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Mastra } from '@mastra/core';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { LocalSandbox, Workspace } from '@mastra/core/workspace';
import type { ProcessMetadata } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { getEffectivePermission } from '../server-adapter/routes/permissions';
import {
  WORKSPACE_GET_SANDBOX_PROCESS_ROUTE,
  WORKSPACE_KILL_SANDBOX_PROCESS_ROUTE,
  WORKSPACE_LIST_SANDBOX_PROCESSES_ROUTE,
} from './workspace';

// `node -e` instead of shell syntax so these run under both sh and cmd.exe.
const longRunning = (label: string) => `node -e "console.log('${label}'); setInterval(() => {}, 1000)"`;

function scopedContext(resourceId: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return requestContext;
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => undefined,
    e => e,
  );
  expect(error).toBeInstanceOf(HTTPException);
  expect(error.status).toBe(status);
  return error as HTTPException;
}

describe('sandbox process routes', () => {
  let dir: string;
  let mastra: Mastra;
  let workspace: Workspace;
  const cleanups: Array<() => Promise<unknown>> = [];

  async function start(sandbox: LocalSandbox, label: string, metadata: ProcessMetadata) {
    const handle = await sandbox.processes!.spawn(longRunning(label), { metadata });
    await vi.waitFor(() => expect(handle.stdout).toContain(label), { timeout: 5000 });
    return handle;
  }

  const route = (requestContext = new RequestContext()) => ({
    mastra,
    workspaceId: 'ws-processes',
    requestContext,
    abortSignal: new AbortController().signal,
  });
  const list = (query: { threadId?: string; resourceId?: string }, requestContext?: RequestContext) =>
    WORKSPACE_LIST_SANDBOX_PROCESSES_ROUTE.handler({ ...route(requestContext), ...query } as any);
  const read = (pid: string, query: { threadId?: string } = {}, requestContext?: RequestContext) =>
    WORKSPACE_GET_SANDBOX_PROCESS_ROUTE.handler({ ...route(requestContext), pid, ...query } as any);
  const kill = (pid: string, query: { threadId?: string } = {}, requestContext?: RequestContext) =>
    WORKSPACE_KILL_SANDBOX_PROCESS_ROUTE.handler({ ...route(requestContext), pid, ...query } as any);

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'server-sandbox-processes-'));
  });

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  describe('with a static sandbox', () => {
    let sandbox: LocalSandbox;

    beforeEach(() => {
      sandbox = new LocalSandbox({ workingDirectory: dir });
      workspace = new Workspace({ id: 'ws-processes', sandbox });
      mastra = new Mastra({ logger: false, workspace });
      cleanups.push(() => workspace.destroy());
    });

    it("lists a thread's processes, and a resource-scoped caller only sees its own", async () => {
      const a = await start(sandbox, 'a', { threadId: 'thread-a', resourceId: 'user-1', toolCallId: 'call-a' });
      const b = await start(sandbox, 'b', { threadId: 'thread-b', resourceId: 'user-1' });
      const c = await start(sandbox, 'c', { threadId: 'thread-c', resourceId: 'user-2' });

      const forThread = await list({ threadId: 'thread-a' });
      expect(forThread.processes).toEqual([
        expect.objectContaining({
          pid: a.pid,
          command: longRunning('a'),
          running: true,
          metadata: expect.objectContaining({ threadId: 'thread-a', resourceId: 'user-1', toolCallId: 'call-a' }),
        }),
      ]);

      const forUser = await list({}, scopedContext('user-1'));
      expect(forUser.processes.map(p => p.pid).sort()).toEqual([a.pid, b.pid].sort());
      expect((await list({})).processes.map(p => p.pid).sort()).toEqual([a.pid, b.pid, c.pid].sort());

      await expectStatus(list({ resourceId: 'user-2' }, scopedContext('user-1')), 403);
    });

    it('does not let another resource read or kill a process, which keeps running', async () => {
      const handle = await start(sandbox, 'mine', { threadId: 'thread-a', resourceId: 'user-1' });

      await expectStatus(read(handle.pid, {}, scopedContext('user-2')), 404);
      await expectStatus(kill(handle.pid, {}, scopedContext('user-2')), 404);
      await expectStatus(kill(handle.pid, { threadId: 'thread-b' }), 404);

      expect(handle.exitCode).toBeUndefined();
      expect(await read(handle.pid, {}, scopedContext('user-1'))).toMatchObject({ running: true });
    });

    it('reads the output of an exited process without taking it from the agent', async () => {
      const handle = await sandbox.processes!.spawn(`node -e "console.log('build done'); process.exit(2)"`, {
        metadata: { threadId: 'thread-a' },
      });
      await handle.wait();

      const first = await read(handle.pid, { threadId: 'thread-a' });
      expect(first).toMatchObject({ pid: handle.pid, running: false, exitCode: 2, stdoutTruncated: false });
      expect(first.stdout).toContain('build done');
      expect(await read(handle.pid, { threadId: 'thread-a' })).toEqual(first);

      // `get_process_output` reads the same way and still gets it.
      expect((await sandbox.processes!.get(handle.pid))?.stdout).toContain('build done');
      await expectStatus(read(handle.pid), 404);
    });

    it('kills a running process and releases it', async () => {
      const handle = await start(sandbox, 'server', { threadId: 'thread-a', resourceId: 'user-1' });

      expect(await kill(handle.pid, { threadId: 'thread-a' }, scopedContext('user-1'))).toEqual({
        pid: handle.pid,
        killed: true,
      });

      expect(handle.exitCode).toBeDefined();
      expect((await list({ threadId: 'thread-a' })).processes).toEqual([]);
      await expectStatus(kill(handle.pid), 404);
    });

    it('needs workspaces:read to list or read processes and workspaces:write to kill them', () => {
      expect(getEffectivePermission(WORKSPACE_LIST_SANDBOX_PROCESSES_ROUTE)).toBe('workspaces:read');
      expect(getEffectivePermission(WORKSPACE_GET_SANDBOX_PROCESS_ROUTE)).toBe('workspaces:read');
      expect(getEffectivePermission(WORKSPACE_KILL_SANDBOX_PROCESS_ROUTE)).toBe('workspaces:write');
    });
  });

  describe('with a sandbox resolved per thread', () => {
    function threadWorkspace(withCacheKey: boolean) {
      const sandboxes = new Map<string, LocalSandbox>();
      const sandboxFor = (threadId: string) => {
        let sandbox = sandboxes.get(threadId);
        if (!sandbox) {
          sandbox = new LocalSandbox({ workingDirectory: dir });
          sandboxes.set(threadId, sandbox);
          cleanups.push(() => sandbox!.destroy());
        }
        return sandbox;
      };
      const threadOf = (requestContext: RequestContext) => requestContext.get(MASTRA_THREAD_ID_KEY) as string;
      workspace = new Workspace({
        id: 'ws-processes',
        // Without a cache key the resolver runs per request; a fresh sandbox has none of the agent's processes.
        sandbox: ({ requestContext }) =>
          withCacheKey ? sandboxFor(threadOf(requestContext)) : new LocalSandbox({ workingDirectory: dir }),
        ...(withCacheKey ? { sandboxCacheKey: ({ requestContext }) => threadOf(requestContext) } : {}),
      });
      mastra = new Mastra({ logger: false, workspace });
      return sandboxFor;
    }

    it("finds a thread's processes in that thread's sandbox", async () => {
      const sandboxFor = threadWorkspace(true);
      const handle = await start(sandboxFor('thread-a'), 'a', { threadId: 'thread-a' });

      expect((await list({ threadId: 'thread-a' })).processes.map(p => p.pid)).toEqual([handle.pid]);
      expect((await read(handle.pid, { threadId: 'thread-a' })).stdout).toContain('a');
      expect((await list({ threadId: 'thread-b' })).processes).toEqual([]);
    });

    it('explains how to make the sandbox findable when it has no cache key', async () => {
      threadWorkspace(false);

      const error = await expectStatus(list({ threadId: 'thread-a' }), 404);
      expect(error.message).toContain('configure sandboxCacheKey');
    });
  });
});
