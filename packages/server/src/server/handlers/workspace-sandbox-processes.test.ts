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
  const read = (pid: string, query: { threadId?: string; tail?: number } = {}, requestContext?: RequestContext) =>
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
      const handle = await sandbox.processes!.spawn(
        `node -e "console.log('compiling'); console.log('build done'); process.exit(2)"`,
        { metadata: { threadId: 'thread-a' } },
      );
      await handle.wait();

      const first = await read(handle.pid, { threadId: 'thread-a' });
      expect(first).toMatchObject({ pid: handle.pid, running: false, exitCode: 2, stdoutTruncated: false });
      expect(first.stdout).toContain('compiling');
      expect(first.stdout).toContain('build done');
      expect(await read(handle.pid, { threadId: 'thread-a' })).toEqual(first);
      expect((await read(handle.pid, { threadId: 'thread-a', tail: 1 })).stdout.trim()).toBe('build done');

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

    // Reading through the process manager would start a stopped cloud sandbox (or fail on a destroyed one).
    it('reports no processes for a sandbox that was never started, and leaves it unstarted', async () => {
      expect(await list({})).toEqual({ processes: [] });
      await expectStatus(read('1234'), 404);
      await expectStatus(kill('1234'), 404);
      expect(sandbox.status).not.toBe('running');
    });

    it('reports no processes for a stopped sandbox, and leaves it stopped', async () => {
      const handle = await start(sandbox, 'server', { threadId: 'thread-a' });
      await sandbox._stop();

      expect(await list({ threadId: 'thread-a' })).toEqual({ processes: [] });
      await expectStatus(read(handle.pid, { threadId: 'thread-a' }), 404);
      await expectStatus(kill(handle.pid, { threadId: 'thread-a' }), 404);
      expect(sandbox.status).toBe('stopped');
    });

    it('needs workspaces:read to list or read processes and workspaces:write to kill them', () => {
      expect(getEffectivePermission(WORKSPACE_LIST_SANDBOX_PROCESSES_ROUTE)).toBe('workspaces:read');
      expect(getEffectivePermission(WORKSPACE_GET_SANDBOX_PROCESS_ROUTE)).toBe('workspaces:read');
      expect(getEffectivePermission(WORKSPACE_KILL_SANDBOX_PROCESS_ROUTE)).toBe('workspaces:write');
    });
  });

  describe('with a sandbox resolved per thread', () => {
    // Each resolver call stands for provisioning a cloud sandbox.
    let resolved: string[];

    function threadWorkspace(withCacheKey: boolean) {
      resolved = [];
      const threadOf = (requestContext: RequestContext) =>
        requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
      workspace = new Workspace({
        id: 'ws-processes',
        sandbox: ({ requestContext }) => {
          resolved.push(threadOf(requestContext) ?? '(none)');
          const sandbox = new LocalSandbox({ workingDirectory: dir });
          cleanups.push(() => sandbox.destroy());
          return sandbox;
        },
        ...(withCacheKey ? { sandboxCacheKey: ({ requestContext }) => threadOf(requestContext) } : {}),
      });
      mastra = new Mastra({ logger: false, workspace });
    }

    // The sandbox an agent run on the thread gets.
    async function agentSandbox(threadId: string) {
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
      return (await workspace.resolveSandbox({ requestContext })) as LocalSandbox;
    }

    it("finds a thread's processes in the sandbox its agent used", async () => {
      threadWorkspace(true);
      const handle = await start(await agentSandbox('thread-a'), 'a', { threadId: 'thread-a' });

      expect((await list({ threadId: 'thread-a' })).processes.map(p => p.pid)).toEqual([handle.pid]);
      expect((await read(handle.pid, { threadId: 'thread-a' })).stdout).toContain('a');
      expect(resolved).toEqual(['thread-a']);
    });

    it('never provisions a sandbox for a request without a thread or for a thread that has none', async () => {
      threadWorkspace(true);
      const handle = await start(await agentSandbox('thread-a'), 'a', { threadId: 'thread-a' });

      for (const request of [list({}), list({ threadId: 'thread-b' }), read(handle.pid), kill(handle.pid)]) {
        const error = await expectStatus(request, 404);
        expect(error.message).toContain('pass the threadId or resourceId');
      }
      expect(resolved).toEqual(['thread-a']);
      expect(handle.exitCode).toBeUndefined();
    });

    it('explains how to make the sandbox findable when it has no cache key', async () => {
      threadWorkspace(false);

      const error = await expectStatus(list({ threadId: 'thread-a' }), 404);
      expect(error.message).toContain('configure sandboxCacheKey');
      expect(resolved).toEqual([]);
    });
  });
});
