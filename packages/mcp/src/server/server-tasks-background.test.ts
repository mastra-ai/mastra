import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { FGADeniedError, MastraFGAPermissions } from '@mastra/core/auth/ee';
import type { BackgroundTask, BackgroundTaskManagerConfig } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import type { SpanRecord } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { DefaultExporter, Observability } from '@mastra/observability';
import type { Client } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TaskRequester } from '../client/tasks/requester';
import { taskKeyOf, tasksCapabilityEntry } from '../shared/tasks';
import type { MCPDetailedTask } from '../shared/tasks';
import { authFor, makeCrashy, runsIn } from './__tests__/background-tasks.mock';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';
import { TASK_EXPIRED_MESSAGE, TASK_LOST_MESSAGE } from './tasks/background-store';
import { InMemoryMCPTaskStore } from './tasks/in-memory-store';

vi.setConfig({ testTimeout: 60_000 });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const LEASE_MS = 3_000;
const here = fileURLToPath(new URL('.', import.meta.url));

class User {
  constructor(readonly id: string) {}
}

interface Probe {
  runs: Array<{ tool: string; resumeData: unknown }>;
}

function makeTools(probe: Probe, counterFile: string) {
  return {
    echo: createTool({
      id: 'echo',
      description: 'Echoes its text',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        probe.runs.push({ tool: 'echo', resumeData: undefined });
        return `echo: ${text}`;
      },
    }),
    approve: createTool({
      id: 'approve',
      description: 'Asks who approves before finishing',
      inputSchema: z.object({ item: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ approver: z.string() }),
      execute: async ({ item }, context) => {
        probe.runs.push({ tool: 'approve', resumeData: context.resumeData });
        if (!context.resumeData) {
          await context.suspend?.({ message: `Who approves ${item}?` });
          return;
        }
        return `${item} approved by ${context.resumeData.approver}`;
      },
    }),
    hang: createTool({
      id: 'hang',
      description: 'Runs until aborted',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        await new Promise<void>(resolve => context.abortSignal?.addEventListener('abort', () => resolve()));
        probe.runs.push({ tool: 'hang', resumeData: 'aborted' });
        return 'stopped';
      },
    }),
    crashy: makeCrashy(counterFile),
    approveTwice: createTool({
      id: 'approveTwice',
      description: 'Asks who approves, then asks them to confirm',
      inputSchema: z.object({}),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ approver: z.string().optional(), confirmed: z.boolean().optional() }),
      execute: async (_input, context) => {
        probe.runs.push({ tool: 'approveTwice', resumeData: context.resumeData });
        if (context.resumeData?.confirmed) return 'confirmed';
        const message = context.resumeData?.approver ? `Confirm, ${context.resumeData.approver}?` : 'Who approves?';
        await context.suspend?.({ message });
      },
    }),
    waits: createTool({
      id: 'waits',
      description: 'Takes a while unless aborted',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        probe.runs.push({ tool: 'waits', resumeData: 'start' });
        const aborted = await new Promise<boolean>(resolve => {
          const timer = setTimeout(() => resolve(false), LEASE_MS * 1.5);
          context.abortSignal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve(true);
          });
        });
        probe.runs.push({ tool: 'waits', resumeData: aborted ? 'aborted' : 'finished' });
        return 'waited';
      },
    }),
    counted: createTool({
      id: 'counted',
      description: 'Takes a while, counting its runs',
      inputSchema: z.object({}),
      execute: async () => {
        probe.runs.push({ tool: 'counted', resumeData: undefined });
        await sleep(LEASE_MS * 2.5);
        return 'counted';
      },
    }),
  };
}

interface Instance {
  url: URL;
  server: MCPServer;
  mastra: Mastra;
  close(): Promise<void>;
}

describe('MCPServer tasks on Mastra background tasks (libsql)', () => {
  let dir: string;
  let db: string;
  let counterFile: string;
  let probe: Probe;
  const instances: Instance[] = [];
  const children: ChildProcess[] = [];
  const clients: Client[] = [];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-bg-tasks-'));
    db = `file:${join(dir, 'mastra.db')}`;
    counterFile = join(dir, 'crashy-runs');
    probe = { runs: [] };
  });

  afterEach(async () => {
    for (const child of children.splice(0)) child.kill('SIGKILL');
    await Promise.all(clients.splice(0).map(client => client.close()));
    for (const instance of instances.splice(0)) await instance.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function instance(
    tasks: MCPServerConfig['tasks'],
    {
      backgroundTasks = {},
      extra = {},
      mastraExtra = {},
    }: {
      backgroundTasks?: Partial<BackgroundTaskManagerConfig>;
      extra?: Partial<MCPServerConfig>;
      mastraExtra?: Record<string, unknown>;
    } = {},
  ): Promise<Instance> {
    const server = new MCPServer({
      name: 'Tasks',
      version: '1.0.0',
      tools: makeTools(probe, counterFile),
      tasks,
      ...extra,
    });
    const mastra = new Mastra({
      logger: false,
      storage: new LibSQLStore({ id: 'tasks', url: db }),
      backgroundTasks: { enabled: true, leaseDurationMs: LEASE_MS, ...backgroundTasks },
      mcpServers: { tasks: server },
      ...mastraExtra,
    });
    const served = await serveHTTP(server, {
      auth: req => {
        const info = authFor(String(req.headers['x-test-user'] ?? 'alice'));
        const sub = req.headers['x-test-sub'];
        return typeof sub === 'string' ? { ...info, extra: { sub } } : info;
      },
    });
    let closed = false;
    const created: Instance = {
      url: served.url,
      server,
      mastra,
      close: async () => {
        if (closed) return;
        closed = true;
        await served.close();
        await mastra.shutdown();
      },
    };
    instances.push(created);
    return created;
  }

  async function call(
    url: URL,
    name: string,
    args: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    const response = await rawRequest(url, {
      method: 'tools/call',
      params: { name, arguments: args },
      capabilities: { extensions: tasksCapabilityEntry() },
      headers: { 'x-test-user': 'alice', 'mcp-name': name, ...headers },
    });
    const { result, error } = response.json();
    if (error) throw new Error(JSON.stringify(error));
    expect(result).toMatchObject({ resultType: 'task' });
    return result.taskId as string;
  }

  async function requester(url: URL, user = 'alice', headers: Record<string, string> = {}) {
    const client = await connectClient(url, {}, { 'x-test-user': user, ...headers });
    clients.push(client);
    return new TaskRequester(client);
  }

  async function waitFor(tasks: TaskRequester, taskId: string, status: MCPDetailedTask['status'], ms = 20_000) {
    const deadline = Date.now() + ms;
    let task: MCPDetailedTask | undefined;
    while (Date.now() < deadline) {
      task = await tasks.get(taskId);
      if (task.status === status) return task;
      await sleep(50);
    }
    throw new Error(`task never reached ${status}; last ${JSON.stringify(task)}`);
  }

  async function rows(mastra: Mastra) {
    return (await mastra.backgroundTaskManager!.listTasks({ agentId: 'mcp-server:tasks' })).tasks;
  }

  /** Starts the server in its own process, so it can be killed mid-task. */
  async function child(
    recover: boolean,
    slots = 'default',
    mode = 'always',
    traced = false,
  ): Promise<{ url: URL; process: ChildProcess }> {
    // One node process (no tsx wrapper process), so SIGKILL kills the server itself.
    const proc = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        join(here, '__tests__/background-tasks-child.ts'),
        db,
        counterFile,
        String(recover),
        slots,
        mode,
        traced ? 'traced' : 'untraced',
      ],
      { cwd: join(here, '../..'), stdio: ['ignore', 'pipe', 'inherit'] },
    );
    children.push(proc);
    const url = await new Promise<URL>((resolve, reject) => {
      let out = '';
      proc.stdout!.on('data', chunk => {
        out += String(chunk);
        const ready = out.match(/READY (\S+)/);
        if (ready) resolve(new URL(ready[1]!));
      });
      proc.once('exit', code => reject(new Error(`server process exited (${code}) before it was ready`)));
    });
    return { url, process: proc };
  }

  async function until(check: () => boolean, ms = 20_000) {
    const deadline = Date.now() + ms;
    while (!check()) {
      if (Date.now() > deadline) throw new Error('condition never held');
      await sleep(50);
    }
  }

  it('serves a task created on one instance from another: read, answer, and run there', async () => {
    const a = await instance({ tools: { approve: 'always', echo: 'always' } });
    const b = await instance({ tools: { approve: 'always', echo: 'always' } });

    const echoed = await call(a.url, 'echo', { text: 'hi' });
    const onB = await requester(b.url);
    expect(await waitFor(onB, echoed, 'completed')).toMatchObject({
      result: { content: [{ type: 'text', text: 'echo: hi' }] },
    });

    const taskId = await call(a.url, 'approve', { item: 'invoice' });
    const waiting = await waitFor(onB, taskId, 'input_required');
    const [key] = Object.keys(waiting.inputRequests ?? {});
    await onB.update(taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
    const done = await waitFor(await requester(a.url), taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'invoice approved by bob' }] } });
    // One run per attempt: the first, and one resume.
    expect(probe.runs.filter(run => run.tool === 'approve')).toEqual([
      { tool: 'approve', resumeData: undefined },
      { tool: 'approve', resumeData: { approver: 'bob' } },
    ]);
  });

  it('ignores an answer to a question the task already moved past', async () => {
    const tools = { tools: { approveTwice: 'always' as const } };
    const a = await instance(tools);
    const b = await instance(tools);
    const onA = await requester(a.url);
    const onB = await requester(b.url);
    const taskId = await call(a.url, 'approveTwice');
    const [k1] = Object.keys((await waitFor(onA, taskId, 'input_required')).inputRequests ?? {});

    // B reads the task waiting on K1, then stalls before writing its answer.
    const storageB = await b.mastra.backgroundTaskManager!.getStorage();
    const write = storageB.updateTask.bind(storageB);
    let reachedWrite!: () => void;
    const stalled = new Promise<void>(resolve => (reachedWrite = resolve));
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    vi.spyOn(storageB, 'updateTask').mockImplementation(async (...args) => {
      const responses = (args[1].metadata as { inputResponses?: Record<string, unknown> } | undefined)?.inputResponses;
      if (responses && (k1 as string) in responses) {
        reachedWrite();
        await released;
      }
      return write(...args);
    });
    const stale = onB.update(taskId, { [k1!]: { action: 'accept', content: { approver: 'mallory' } } });
    await stalled;

    // Meanwhile K1 is answered through A, and the tool moves on to ask K2.
    await onA.update(taskId, { [k1!]: { action: 'accept', content: { approver: 'bob' } } });
    let waiting = await onA.get(taskId);
    for (let i = 0; i < 200 && !Object.keys(waiting.inputRequests ?? {}).some(key => key !== k1); i++) {
      await sleep(50);
      waiting = await onA.get(taskId);
    }
    const k2Requests = waiting.inputRequests ?? {};
    const [k2] = Object.keys(k2Requests);
    expect(k2).toBeDefined();
    expect(k2).not.toBe(k1);

    release();
    await stale.catch(() => undefined);
    await sleep(LEASE_MS);

    // K2's question is still open, and the tool never saw mallory's answer.
    expect(await onA.get(taskId)).toMatchObject({ status: 'input_required', inputRequests: k2Requests });
    expect(probe.runs.filter(run => run.tool === 'approveTwice').map(run => run.resumeData)).toEqual([
      undefined,
      { approver: 'bob' },
    ]);

    await onA.update(taskId, { [k2!]: { action: 'accept', content: { confirmed: true } } });
    expect(await waitFor(onA, taskId, 'completed')).toMatchObject({
      result: { content: [{ type: 'text', text: 'confirmed' }] },
    });
  });

  it('stops a run on one instance when another instance cancels its task', async () => {
    const a = await instance({ tools: { hang: 'always' } });
    const b = await instance({ tools: { hang: 'always' } });
    const taskId = await call(a.url, 'hang');
    const onB = await requester(b.url);
    await waitFor(onB, taskId, 'working');
    await sleep(500);
    await onB.cancel(taskId);
    try {
      expect(await onB.get(taskId)).toMatchObject({ status: 'cancelled' });
      // Within one lease A's run has been aborted.
      await sleep(LEASE_MS);
      expect(probe.runs.filter(run => run.tool === 'hang')).toEqual([{ tool: 'hang', resumeData: 'aborted' }]);
    } finally {
      // `drain` skips the cancelled row, so stop A's run while storage is still open.
      const [row] = (await rows(a.mastra)).filter(r => r.toolName === 'mcp-server:tasks:hang');
      await a.mastra.backgroundTaskManager!.shutdown();
      const workflow = a.mastra.__getInternalWorkflow('__background-task');
      for (let i = 0; i < 100 && (await workflow.getWorkflowRunById(row!.id)); i++) await sleep(20);
    }
  });

  describe.each([
    { recover: true, when: 'starts after the crash', before: false },
    { recover: true, when: 'was already running', before: true },
    { recover: false, when: 'starts after the crash', before: false },
    { recover: false, when: 'was already running', before: true },
  ])('when a server dies mid-task (recover: $recover) and the next instance $when', ({ recover, before }) => {
    it(
      recover ? 'runs the tool again there and completes' : 'reports the task lost and never runs it again',
      async () => {
        const tasks = { tools: { crashy: { mode: 'always' as const, recover } } };
        let survivor = before ? await instance(tasks) : undefined;
        const dying = await child(recover);
        const taskId = await call(dying.url, 'crashy');
        await until(() => runsIn(counterFile) === 1);
        dying.process.kill('SIGKILL');

        survivor ??= await instance(tasks);
        const onSurvivor = await requester(survivor.url);
        if (recover) {
          const done = await waitFor(onSurvivor, taskId, 'completed');
          expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'recovered' }] } });
          expect(runsIn(counterFile)).toBe(2);
        } else {
          const lost = await waitFor(onSurvivor, taskId, 'failed');
          expect(lost).toMatchObject({ error: { code: -32603, message: TASK_LOST_MESSAGE } });
          // Another lease and sweep later, it still ran exactly once.
          await sleep(LEASE_MS * 2);
          expect(runsIn(counterFile)).toBe(1);
        }
      },
    );
  });

  it('runs a task again on a peer when its instance shuts down gracefully mid-task (recover: true)', async () => {
    const tasks = { tools: { crashy: { mode: 'always' as const, recover: true } } };
    // Up before the task exists, so core's own stale recovery on B never looks at its row again.
    const b = await instance(tasks);
    const a = await instance(tasks);
    const taskId = await call(a.url, 'crashy');
    await until(() => runsIn(counterFile) === 1);

    await a.mastra.backgroundTaskManager!.shutdown();
    expect((await rows(b.mastra))[0]).toMatchObject({ status: 'running' });

    const done = await waitFor(await requester(b.url), taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'recovered' }] } });
    expect(runsIn(counterFile)).toBe(2);
  });

  it('runs a task again on a peer when its row is running with no owner and no lease (recover: true)', async () => {
    const tasks = { tools: { crashy: { mode: 'always' as const, recover: true } } };
    const b = await instance(tasks);
    const a = await instance(tasks);
    const taskId = await call(a.url, 'crashy');
    await until(() => runsIn(counterFile) === 1);

    // What a graceful stop hands back: the row stays running, without an owner or a lease.
    // Written here because core currently keeps the lease of a run it waited on (see below).
    const manager = a.mastra.backgroundTaskManager!;
    const owner = manager.ownerId;
    await manager.shutdown();
    const [row] = await rows(b.mastra);
    const storage = await b.mastra.backgroundTaskManager!.getStorage();
    expect(
      await storage.updateTask(row!.id, { ownerId: undefined, leaseExpiresAt: undefined }, { expectedOwnerId: owner }),
    ).toBe(true);
    expect((await rows(b.mastra))[0]).toMatchObject({
      status: 'running',
      ownerId: undefined,
      leaseExpiresAt: undefined,
    });

    const done = await waitFor(await requester(b.url), taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'recovered' }] } });
    expect(runsIn(counterFile)).toBe(2);
  });

  // Fails since core #28509: shutdown now waits for aborted runs to settle before it releases
  // leases, and a settled run drops out of `ownedLeases`, so its lease is never handed back.
  // A peer still reruns the task, one lease later, as after a crash.
  it.fails('hands the lease of a running task back when its instance shuts down gracefully', async () => {
    const tasks = { tools: { crashy: { mode: 'always' as const, recover: true } } };
    const a = await instance(tasks);
    await call(a.url, 'crashy');
    await until(() => runsIn(counterFile) === 1);

    await a.mastra.backgroundTaskManager!.shutdown();
    expect((await rows(a.mastra))[0]).toMatchObject({
      status: 'running',
      ownerId: undefined,
      leaseExpiresAt: undefined,
    });
  });

  describe('tracing', () => {
    /** Spans go to the shared storage, as Studio reads them. */
    const traced = () => ({
      mastraExtra: {
        observability: new Observability({
          configs: { default: { serviceName: 'tasks', exporters: [new DefaultExporter({ maxBatchWaitMs: 20 })] } },
        }),
      },
    });

    /** Every stored span of every trace storage lists. */
    async function storedSpans(mastra: Mastra): Promise<SpanRecord[]> {
      const store = (await mastra.getStorage()!.getStore('observability'))!;
      await mastra.observability.getSelectedInstance({})?.flush();
      const { spans: roots } = await store.listTraces({ pagination: { page: 0, perPage: 100 } });
      const traces = await Promise.all(roots.map(root => store.getTrace({ traceId: root.traceId })));
      return traces.flatMap(trace => trace?.spans ?? []);
    }

    async function spanNamed(mastra: Mastra, name: string) {
      for (let i = 0; i < 100; i++) {
        const span = (await storedSpans(mastra)).find(span => span.name === name && span.endedAt);
        if (span) return span;
        await sleep(50);
      }
      throw new Error(`no stored span "${name}"`);
    }

    it('keeps an attempt recovered on a peer in the trace of the call that created the task', async () => {
      const tasks = { tools: { crashy: { mode: 'always' as const, recover: true } } };
      const b = await instance(tasks, traced());
      const a = await instance(tasks, traced());
      const taskId = await call(a.url, 'crashy');
      await until(() => runsIn(counterFile) === 1);
      await a.mastra.backgroundTaskManager!.shutdown();
      await waitFor(await requester(b.url), taskId, 'completed');

      const root = await spanNamed(b.mastra, 'tools/call crashy');
      const recovered = await spanNamed(b.mastra, 'task attempt crashy #2');
      expect(root).toMatchObject({ parentSpanId: null, metadata: { mcpTaskKey: taskKeyOf(taskId) } });
      expect(recovered).toMatchObject({
        traceId: root.traceId,
        parentSpanId: root.spanId,
        metadata: {
          mcpTaskKey: taskKeyOf(taskId),
          attempt: 2,
          resumed: false,
          recovered: true,
          mcpTaskStatus: 'completed',
        },
      });
    });

    it("lists a task's trace even when the instance that created it never flushes its spans again", async () => {
      const tasks = { tools: { crashy: { mode: 'always' as const, recover: true } } };
      const b = await instance(tasks, traced());
      // A batches spans for ten minutes: without the flush on task creation, nothing it records is stored,
      // as when it is killed within its exporter's batch window.
      const a = await instance(tasks, {
        mastraExtra: {
          observability: new Observability({
            configs: {
              default: { serviceName: 'tasks', exporters: [new DefaultExporter({ maxBatchWaitMs: 600_000 })] },
            },
          }),
        },
      });
      const taskId = await call(a.url, 'crashy');
      await until(() => runsIn(counterFile) === 1);
      await a.mastra.backgroundTaskManager!.shutdown();
      await waitFor(await requester(b.url), taskId, 'completed');

      const recovered = await spanNamed(b.mastra, 'task attempt crashy #2');
      const store = (await b.mastra.getStorage()!.getStore('observability'))!;
      const { spans: listed } = await store.listTraces({ pagination: { page: 0, perPage: 100 } });
      expect(listed).toEqual([
        expect.objectContaining({
          name: 'tools/call crashy',
          traceId: recovered.traceId,
          spanId: recovered.parentSpanId,
        }),
      ]);
      await a.mastra.observability.getSelectedInstance({})?.flush();
    });

    it('numbers and marks an attempt rerun after its server was killed, under a root that was already stored', async () => {
      const dying = await child(true, 'default', 'always', true);
      const taskId = await call(dying.url, 'crashy');
      await until(() => runsIn(counterFile) === 1);
      // Within the exporter's 5s batch: only what the server flushed on its own is stored.
      dying.process.kill('SIGKILL');
      const b = await instance({ tools: { crashy: { mode: 'always', recover: true } } }, traced());
      await waitFor(await requester(b.url), taskId, 'completed');

      const recovered = await spanNamed(b.mastra, 'task attempt crashy #2');
      const store = (await b.mastra.getStorage()!.getStore('observability'))!;
      const { spans: listed } = await store.listTraces({ pagination: { page: 0, perPage: 100 } });
      expect(listed).toEqual([
        expect.objectContaining({
          name: 'tools/call crashy',
          traceId: recovered.traceId,
          spanId: recovered.parentSpanId,
        }),
      ]);
      expect(recovered.metadata).toMatchObject({
        attempt: 2,
        resumed: false,
        recovered: true,
        mcpTaskStatus: 'completed',
      });
    });

    it('never stores a task id in a span', async () => {
      const tasks = { tools: { echo: 'always' as const, approve: 'always' as const, hang: 'always' as const } };
      const a = await instance(tasks, traced());
      const onA = await requester(a.url);
      const echoed = await call(a.url, 'echo', { text: 'hi' });
      const approved = await call(a.url, 'approve', { item: 'invoice' });
      const hung = await call(a.url, 'hang');
      await waitFor(onA, echoed, 'completed');
      const waiting = await waitFor(onA, approved, 'input_required');
      const [key] = Object.keys(waiting.inputRequests!);
      await onA.update(approved, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
      await waitFor(onA, approved, 'completed');
      await waitFor(onA, hung, 'working');
      await onA.cancel(hung);
      await expect(onA.update('not-a-task', {})).rejects.toMatchObject({ code: -32602 });
      await spanNamed(a.mastra, 'task attempt approve #2');
      await spanNamed(a.mastra, 'task attempt hang #1');

      const stored = JSON.stringify(await storedSpans(a.mastra));
      expect(stored).toContain(taskKeyOf(echoed));
      for (const taskId of [echoed, approved, hung, 'not-a-task']) expect(stored).not.toContain(taskId);
    });
  });

  describe("an 'auto' task's first attempt, already running under its request", () => {
    const tasks = {
      tools: {
        counted: { mode: 'auto' as const, syncWindowMs: 50 },
        waits: { mode: 'auto' as const, syncWindowMs: 50 },
        hang: 'always' as const,
      },
    };

    it('is stopped by a cancel while its row waits for a slot', async () => {
      const a = await instance(tasks, { backgroundTasks: { perOwnerConcurrency: { 'mcp-server:tasks': 1 } } });
      const onA = await requester(a.url);
      await waitFor(onA, await call(a.url, 'hang'), 'working');
      const taskId = await call(a.url, 'waits');
      await until(() => probe.runs.some(run => run.tool === 'waits'));
      expect((await rows(a.mastra)).find(r => r.toolName === 'mcp-server:tasks:waits')).toMatchObject({
        status: 'pending',
      });

      await onA.cancel(taskId);
      expect(await onA.get(taskId)).toMatchObject({ status: 'cancelled' });
      await until(() => probe.runs.filter(run => run.tool === 'waits').length === 2, LEASE_MS / 3);
      expect(probe.runs.filter(run => run.tool === 'waits').map(run => run.resumeData)).toEqual(['start', 'aborted']);
    });

    it('is not run again by an idle instance', async () => {
      const a = await instance(tasks);
      await instance(tasks);
      const taskId = await call(a.url, 'counted');
      expect(await waitFor(await requester(a.url), taskId, 'completed')).toMatchObject({
        result: { content: [{ type: 'text', text: 'counted' }] },
      });
      expect(probe.runs.filter(run => run.tool === 'counted')).toHaveLength(1);
    });

    it('is not run again by an instance sweeping for stale tasks while its row waits for a slot', async () => {
      const a = await instance(tasks, { backgroundTasks: { perOwnerConcurrency: { 'mcp-server:tasks': 1 } } });
      const onA = await requester(a.url);
      const hung = await call(a.url, 'hang');
      await waitFor(onA, hung, 'working');
      // B starts while A holds a live lease, so it keeps re-running its stale-task sweep.
      await instance(tasks);
      const taskId = await call(a.url, 'counted');
      await sleep(LEASE_MS * 2);
      expect(probe.runs.filter(run => run.tool === 'counted')).toHaveLength(1);
      // Once A has a slot, the row takes the attempt's outcome instead of running the tool again.
      await onA.cancel(hung);
      expect(await waitFor(onA, taskId, 'completed')).toMatchObject({
        result: { content: [{ type: 'text', text: 'counted' }] },
      });
      expect(probe.runs.filter(run => run.tool === 'counted')).toHaveLength(1);
    });

    it.each([
      { slot: 'free', slots: 'default' },
      { slot: 'taken', slots: 'oneSlot' },
    ])(
      'is reported lost, and never run by a peer, when its server dies (recover: false, slot $slot)',
      async ({ slots }) => {
        const survivor = await instance({ tools: { crashy: { mode: 'auto', recover: false }, hang: 'always' } });
        const dying = await child(false, slots, 'auto');
        const onDying = await requester(dying.url);
        if (slots === 'oneSlot') await waitFor(onDying, await call(dying.url, 'hang'), 'working');
        const taskId = await call(dying.url, 'crashy');
        await until(() => runsIn(counterFile) === 1);
        const row = (await rows(survivor.mastra)).find(r => r.toolName === 'mcp-server:tasks:crashy')!;
        // With the slot taken, the row waits pinned to the dying server while its attempt runs.
        expect(row.status).toBe(slots === 'oneSlot' ? 'pending' : 'running');
        expect(row.ownerId).toBeDefined();
        dying.process.kill('SIGKILL');

        const lost = await waitFor(await requester(survivor.url), taskId, 'failed');
        expect(lost).toMatchObject({ error: { code: -32603, message: TASK_LOST_MESSAGE } });
        await sleep(LEASE_MS * 2);
        expect(runsIn(counterFile)).toBe(1);
      },
    );
  });

  it('runs a task that was still queued on an instance that died, on a peer already up', async () => {
    // Up before the task exists, so its own start-up recovery can't be what finds it.
    const survivor = await instance({ tools: { approve: 'always', hang: 'always' } });
    const dying = await child(false, 'oneSlot');
    const onDying = await requester(dying.url);
    await waitFor(onDying, await call(dying.url, 'hang'), 'working');
    const taskId = await call(dying.url, 'approve', { item: 'invoice' });
    const queued = (await rows(survivor.mastra)).find(r => r.toolName === 'mcp-server:tasks:approve')!;
    expect(queued).toMatchObject({ status: 'pending' });
    expect(queued.ownerId).toBeFalsy();

    dying.process.kill('SIGKILL');
    expect(await waitFor(await requester(survivor.url), taskId, 'input_required')).toMatchObject({
      inputRequests: expect.any(Object),
    });
    expect(probe.runs.filter(run => run.tool === 'approve')).toEqual([{ tool: 'approve', resumeData: undefined }]);
  });

  it('never runs a Mastra tool named like the MCP tool for a task row no MCP server serves', async () => {
    const plain = vi.fn(async () => 'plain tool ran');
    const dying = await child(false, 'oneSlot');
    const onDying = await requester(dying.url);
    await waitFor(onDying, await call(dying.url, 'hang'), 'working');
    const taskId = await call(dying.url, 'approve', { item: 'invoice' });
    dying.process.kill('SIGKILL');

    // A worker with the same storage but not the MCP server, and its own tool called `approve`.
    const worker = new Mastra({
      logger: false,
      storage: new LibSQLStore({ id: 'tasks', url: db }),
      backgroundTasks: { enabled: true, leaseDurationMs: LEASE_MS },
      tools: {
        approve: createTool({ id: 'approve', description: 'Not the MCP tool', inputSchema: z.any(), execute: plain }),
      },
    });
    instances.push({
      url: new URL('http://unused'),
      server: undefined as never,
      mastra: worker,
      close: () => worker.shutdown(),
    });
    let row: BackgroundTask | undefined;
    for (let i = 0; i < 100; i++) {
      row = (await rows(worker)).find(r => r.toolName === 'mcp-server:tasks:approve');
      if (row?.status === 'failed') break;
      await sleep(100);
    }
    expect(row).toMatchObject({ status: 'failed' });
    expect(plain).not.toHaveBeenCalled();
    void taskId;
  });

  it('resumes an answered task whose queued resume was lost with its instance', async () => {
    const a = await child(false, 'oneSlot');
    const onA = await requester(a.url);
    const taskId = await call(a.url, 'approve', { item: 'invoice' });
    const waiting = await waitFor(onA, taskId, 'input_required');
    const [key] = Object.keys(waiting.inputRequests ?? {});
    // A's only slot is now held by a task that never ends.
    await waitFor(onA, await call(a.url, 'hang'), 'working');
    // With no slot free, the answer is acknowledged and its resume queued in A's memory.
    await onA.update(taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });

    a.process.kill('SIGKILL');
    const b = await instance({ tools: { approve: 'always', hang: 'always' } });
    const answered = (await rows(b.mastra)).find(row => row.toolName === 'mcp-server:tasks:approve')!;
    expect(answered.status).toBe('suspended');
    expect(answered.metadata).toMatchObject({ inputResponses: { [key!]: { action: 'accept' } } });
    const done = await waitFor(await requester(b.url), taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'invoice approved by bob' }] } });
    expect(probe.runs.filter(run => run.tool === 'approve')).toEqual([
      { tool: 'approve', resumeData: { approver: 'bob' } },
    ]);
  });

  it('fails a task waiting for input past its TTL, and cleanup deletes a finished task at its TTL', async () => {
    const a = await instance({
      tools: { approve: { mode: 'always', ttlMs: 500 }, echo: { mode: 'always', ttlMs: 500 } },
    });
    const onA = await requester(a.url);
    const waitingId = await call(a.url, 'approve', { item: 'invoice' });
    const waiting = await waitFor(onA, waitingId, 'input_required');
    const echoed = await call(a.url, 'echo', { text: 'hi' });
    await waitFor(onA, echoed, 'completed');

    // The sweep runs once per lease.
    await sleep(LEASE_MS + 1_000);
    const expired = (await rows(a.mastra)).find(row => row.toolName === 'mcp-server:tasks:approve')!;
    expect(expired).toMatchObject({ status: 'failed', error: { message: TASK_EXPIRED_MESSAGE } });
    expect(await onA.get(waitingId)).toMatchObject({ status: 'failed', error: { message: TASK_EXPIRED_MESSAGE } });
    // A late answer is not taken.
    const [key] = Object.keys(waiting.inputRequests ?? {});
    await onA.update(waitingId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
    expect(probe.runs.filter(run => run.tool === 'approve' && run.resumeData)).toHaveLength(0);

    await a.mastra.backgroundTaskManager!.cleanup();
    expect((await rows(a.mastra)).map(row => row.toolName)).toEqual(['mcp-server:tasks:approve']);
    await expect(onA.get(echoed)).rejects.toMatchObject({ code: -32602 });
  });

  it('checks FGA on an attempt resumed on another instance against the caller read back from storage', async () => {
    const checked: unknown[] = [];
    const fga = {
      check: vi.fn(),
      filterAccessible: vi.fn(),
      require: vi.fn(async (user: { id: string }, params: { resource: { type: string; id: string } }) => {
        // Only the MCP server's own tool resource; core's tool-level check is a separate resource.
        if (!params.resource.id.startsWith('[')) return;
        checked.push(user);
        if (user.id !== 'alice') throw new FGADeniedError(user, params.resource, MastraFGAPermissions.TOOLS_EXECUTE);
      }),
    };
    const options = {
      extra: { mapAuthInfoToUser: ({ authInfo }: { authInfo: { clientId: string } }) => new User(authInfo.clientId) },
      mastraExtra: { server: { fga } },
    };
    const a = await instance({ tools: { approve: 'always' } }, options);
    const b = await instance({ tools: { approve: 'always' } }, options);

    const taskId = await call(a.url, 'approve', { item: 'invoice' });
    const onB = await requester(b.url);
    const waiting = await waitFor(onB, taskId, 'input_required');
    const [key] = Object.keys(waiting.inputRequests ?? {});
    // Answering through B runs the resume on B, from the row alone.
    await onB.update(taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
    expect(await waitFor(onB, taskId, 'completed')).toMatchObject({
      result: { content: [{ type: 'text', text: 'invoice approved by bob' }] },
    });
    expect(checked[0]).toBeInstanceOf(User);
    const resumed = checked.at(-1);
    expect(resumed).toEqual({ id: 'alice' });
    expect(Object.getPrototypeOf(resumed)).toBe(Object.prototype);
  });

  it('keeps task rows out of agents, resource-scoped listings and plaintext, and passes them to global hooks', async () => {
    const completed: BackgroundTask[] = [];
    const agent = new Agent({ id: 'helper', name: 'helper', instructions: 'help', model: 'openai/gpt-4o-mini' });
    const a = await instance(
      { tools: { echo: 'always' } },
      {
        backgroundTasks: { onTaskComplete: task => void completed.push(task) },
        mastraExtra: { agents: { helper: agent } },
      },
    );
    const taskId = await call(a.url, 'echo', { text: 'hi' });
    await waitFor(await requester(a.url), taskId, 'completed');
    await until(() => completed.length > 0, 5_000);

    const manager = a.mastra.backgroundTaskManager!;
    expect((await manager.listTasks({ agentId: 'helper' })).tasks).toEqual([]);
    // A route scoped to a Mastra resource (here, the caller's own name) sees no MCP rows.
    expect((await manager.listTasks({ resourceId: 'alice' })).tasks).toEqual([]);

    // Unscoped readers and hooks get the row, but nothing that would let them act as the caller.
    const [row] = (await manager.listTasks({})).tasks;
    expect(row).toMatchObject({ agentId: 'mcp-server:tasks', toolName: 'mcp-server:tasks:echo' });
    expect(row!.threadId).toBeUndefined();
    expect(completed[0]).toMatchObject({ id: row!.id, agentId: 'mcp-server:tasks' });
    for (const seen of [row, completed[0]]) {
      const text = JSON.stringify(seen);
      expect(text).not.toContain(taskId);
      expect(text).not.toContain('alice-token');
    }
  });

  it("stores neither the task id, the bearer token nor the caller's principal, and still serves the task to that caller alone", async () => {
    const a = await instance({ tools: { approve: 'always' } });
    const b = await instance({ tools: { approve: 'always' } });
    const taskId = await call(a.url, 'approve', { item: 'invoice' });
    const waiting = await waitFor(await requester(b.url), taskId, 'input_required');

    // What `principalOf` resolves for alice's token (no subject, no user).
    const principal = `alice:token:${createHash('sha256').update('alice-token').digest('base64url')}`;
    const [row] = await rows(a.mastra);
    expect(row!.resourceId).toMatch(/^mcp-server:tasks:/);
    for (const stored of [row!.resourceId, row!.metadata, row!.args, row]) {
      const text = JSON.stringify(stored);
      expect(text).not.toContain(taskId);
      expect(text).not.toContain('alice-token');
      expect(text).not.toContain(principal);
    }

    // Another caller gets the same "not found" from either instance, and can't answer or cancel.
    const [key] = Object.keys(waiting.inputRequests ?? {});
    for (const url of [a.url, b.url]) {
      const asBob = await requester(url, 'bob');
      await expect(asBob.get(taskId)).rejects.toMatchObject({ code: -32602 });
      await expect(
        asBob.update(taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } }),
      ).rejects.toMatchObject({ code: -32602 });
      await expect(asBob.cancel(taskId)).rejects.toMatchObject({ code: -32602 });
    }
    expect(await waitFor(await requester(a.url), taskId, 'input_required')).toMatchObject({ status: 'input_required' });
  });

  it.each([
    { form: 'subject', headers: { 'x-test-sub': 'sub-123' }, label: 'alice:sub:sub-123' },
    { form: 'user id', headers: {}, label: 'alice:user:user-alice', mapsUser: true },
    {
      form: 'token',
      headers: {},
      label: `alice:token:${createHash('sha256').update('alice-token').digest('base64url').slice(0, 8)}`,
    },
  ])('labels the row with the client that sent the task ($form)', async ({ headers, label, mapsUser }) => {
    const a = await instance(
      { tools: { echo: 'always' } },
      mapsUser
        ? {
            extra: {
              mapAuthInfoToUser: ({ authInfo }: { authInfo: { clientId: string } }) => ({
                id: `user-${authInfo.clientId}`,
              }),
            },
          }
        : {},
    );
    const taskId = await call(a.url, 'echo', { text: 'hi' }, headers);
    await waitFor(await requester(a.url, 'alice', headers), taskId, 'completed');
    const [row] = await rows(a.mastra);
    expect(row!.metadata).toMatchObject({ clientLabel: label });
    expect(JSON.stringify(row)).not.toContain('alice-token');
  });

  it('keeps tasks in memory, with a warning, when the storage cannot expire rows', async () => {
    const a = await instance({ tools: { echo: 'always' } });
    const storage = await a.mastra.backgroundTaskManager!.getStorage();
    // What an adapter predating per-row expiry reports.
    Object.defineProperty(storage, 'supportsTaskExpiry', { value: false });
    const warn = vi.spyOn((a.server as unknown as { logger: { warn: (...args: unknown[]) => void } }).logger, 'warn');

    const taskId = await call(a.url, 'echo', { text: 'hi' });
    await waitFor(await requester(a.url), taskId, 'completed');
    expect(await rows(a.mastra)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not support task expiry'));
  });

  it('chooses the store again after storage was unreachable for one request', async () => {
    const a = await instance({ tools: { echo: 'always' } });
    vi.spyOn(a.mastra.backgroundTaskManager!, 'getStorage').mockRejectedValueOnce(new Error('storage unreachable'));
    await expect(call(a.url, 'echo', { text: 'first' })).rejects.toThrow();

    const taskId = await call(a.url, 'echo', { text: 'second' });
    await waitFor(await requester(a.url), taskId, 'completed');
    expect(await rows(a.mastra)).toHaveLength(1);
  });

  it('does not sweep storage for a server that has served no task', async () => {
    const a = await instance({ tools: { echo: 'always' } });
    const list = vi.spyOn(a.mastra.backgroundTaskManager!, 'listTasks');
    await sleep(LEASE_MS * 1.5);
    expect(list.mock.calls.filter(([filter]) => filter?.agentId === 'mcp-server:tasks')).toEqual([]);
  });

  it('warns when tasks are kept in storage under an id generated for this process', async () => {
    const server = new MCPServer({
      name: 'Tasks',
      version: '1.0.0',
      tools: makeTools(probe, counterFile),
      tasks: { tools: { echo: 'always' } },
    });
    const mastra = new Mastra({
      logger: false,
      storage: new LibSQLStore({ id: 'tasks', url: db }),
      backgroundTasks: { enabled: true, leaseDurationMs: LEASE_MS },
    });
    mastra.addMCPServer(server);
    const served = await serveHTTP(server, { auth: () => authFor('alice') });
    instances.push({
      url: served.url,
      server,
      mastra,
      close: async () => (await served.close(), await mastra.shutdown()),
    });
    const warn = vi.spyOn((server as unknown as { logger: { warn: (...args: unknown[]) => void } }).logger, 'warn');

    await waitFor(await requester(served.url), await call(served.url, 'echo', { text: 'hi' }), 'completed');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('generated id'));
  });

  it('uses the store passed in over Mastra background tasks', async () => {
    const store = new InMemoryMCPTaskStore();
    const a = await instance({ tools: { echo: 'always' }, store });
    const taskId = await call(a.url, 'echo', { text: 'hi' });
    await waitFor(await requester(a.url), taskId, 'completed');
    expect(await rows(a.mastra)).toEqual([]);
    store.close();
  });
});
