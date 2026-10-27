import { createHash } from 'node:crypto';
import { FGADeniedError, MastraFGAPermissions } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Client } from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TaskRequester } from '../client/tasks/requester';
import { TASKS_EXTENSION_ID, tasksCapabilityEntry } from '../shared/tasks';
import type { MCPDetailedTask } from '../shared/tasks';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';
import { resolveTasksConfig } from './tasks/config';
import { InMemoryMCPTaskStore } from './tasks/in-memory-store';
import type { MCPTaskStore } from './tasks/store';

vi.setConfig({ testTimeout: 20_000 });

const TASKS_CLIENT = { extensions: tasksCapabilityEntry() };

/** Each test header value is its own OAuth client, so its own principal. */
const authFor = (user: string): AuthInfo => ({ token: `${user}-token`, clientId: user, scopes: [] });

class User {
  constructor(readonly id: string) {}
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Probe {
  runs: Array<{ tool: string; resumeData: unknown }>;
  aborted: string[];
  authInfos: unknown[];
  contexts: Array<{ authInfo: unknown; hasMcp: boolean }>;
}

function makeTools(probe: Probe) {
  const echo = createTool({
    id: 'echo',
    description: 'Echoes its text',
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ echoed: z.string() }),
    execute: async ({ text }) => {
      probe.runs.push({ tool: 'echo', resumeData: undefined });
      return { echoed: text };
    },
  });
  const delayed = (id: string, ms: number) =>
    createTool({
      id,
      description: `Answers after ${ms}ms`,
      inputSchema: z.object({}),
      execute: async () => {
        await sleep(ms);
        return `${id} done`;
      },
    });
  const approve = createTool({
    id: 'approve',
    description: 'Asks who approves before finishing',
    inputSchema: z.object({ item: z.string() }),
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: z.object({ approver: z.string() }).describe('Who approves?'),
    execute: async ({ item }, context) => {
      probe.runs.push({ tool: 'approve', resumeData: context.resumeData });
      if (!context.resumeData) {
        await context.suspend?.({ message: `Who approves ${item}?` });
        return;
      }
      return `${item} approved by ${context.resumeData.approver}`;
    },
  });
  const boom = createTool({
    id: 'boom',
    description: 'Always throws',
    inputSchema: z.object({}),
    execute: async () => {
      throw new Error('kaboom');
    },
  });
  const hang = (id: string) =>
    createTool({
      id,
      description: 'Runs until aborted',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        const signal = context.abortSignal!;
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
        probe.aborted.push(id);
        return 'stopped';
      },
    });
  const plain = createTool({
    id: 'plain',
    description: 'Never a task',
    inputSchema: z.object({}),
    execute: async () => 'plain',
  });
  const slowApprove = createTool({
    id: 'slowApprove',
    description: 'Works a while, then asks who approves',
    inputSchema: z.object({}),
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: z.object({ approver: z.string() }),
    execute: async (_input, context) => {
      probe.authInfos.push(context.requestContext?.get('authInfo'));
      if (!context.resumeData) {
        await sleep(200);
        await context.suspend?.({ message: 'Who approves?' });
        return;
      }
      return `approved by ${context.resumeData.approver}`;
    },
  });
  const inspect = createTool({
    id: 'inspect',
    description: 'Reports the context it ran with',
    inputSchema: z.object({}),
    execute: async (_input, context) => {
      probe.contexts.push({ authInfo: context.requestContext?.get('authInfo'), hasMcp: context.mcp !== undefined });
      return 'inspected';
    },
  });
  return {
    inspect,
    echo,
    quick: delayed('quick', 10),
    slow: delayed('slow', 500),
    approve,
    boom,
    hang: hang('hang'),
    expiring: hang('expiring'),
    slowHang: hang('slowHang'),
    slowApprove,
    plain,
  };
}

// Every case runs on both stores a server picks on its own: in memory when standalone, and on
// Mastra's background tasks when registered on a Mastra instance that has them.
describe.each([
  { store: 'in-memory', mastra: false },
  { store: 'Mastra background tasks', mastra: true },
])('MCPServer tasks ($store)', ({ mastra: onMastra }) => {
  let served: ServedHTTP | undefined;
  let mastra: Mastra | undefined;
  const clients: Client[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map(client => client.close()));
    await served?.close();
    served = undefined;
    await mastra?.shutdown();
    mastra = undefined;
  });

  async function start(tasks: MCPServerConfig['tasks'], extra: Partial<MCPServerConfig> = {}) {
    const probe: Probe = { runs: [], aborted: [], authInfos: [], contexts: [] };
    const server = new MCPServer({ name: 'Tasks', version: '1.0.0', tools: makeTools(probe), tasks, ...extra });
    if (onMastra && !tasks?.store) {
      mastra = new Mastra({
        logger: false,
        storage: new InMemoryStore(),
        backgroundTasks: { enabled: true },
        mcpServers: { tasks: server },
      });
    }
    served = await serveHTTP(server, { auth: req => authFor(String(req.headers['x-test-user'] ?? 'alice')) });
    return { probe, server, url: served.url };
  }

  /** `tools/call` as a client that declared the Tasks extension (unless `tasks: false`). */
  async function call(name: string, args: Record<string, unknown> = {}, { tasks = true, user = 'alice' } = {}) {
    const response = await rawRequest(served!.url, {
      method: 'tools/call',
      params: { name, arguments: args },
      capabilities: tasks ? TASKS_CLIENT : {},
      headers: { 'x-test-user': user, 'mcp-name': name },
    });
    return response.json();
  }

  async function requester(user = 'alice') {
    const client = await connectClient(served!.url, {}, { 'x-test-user': user });
    clients.push(client);
    return new TaskRequester(client);
  }

  async function waitFor(tasks: TaskRequester, taskId: string, status: MCPDetailedTask['status']) {
    for (let i = 0; i < 200; i++) {
      const task = await tasks.get(taskId);
      if (task.status === status) return task;
      await sleep(20);
    }
    throw new Error(`task never reached ${status}`);
  }

  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (error: { code?: number; message?: string }) => ({ code: error.code, message: error.message }),
    );

  it('advertises nothing and serves no tasks/* without a tasks config', async () => {
    await start(undefined);
    const client = await connectClient(served!.url);
    clients.push(client);
    expect(client.getServerCapabilities()?.extensions?.[TASKS_EXTENSION_ID]).toBeUndefined();
    const response = await rawRequest(served!.url, {
      method: 'tasks/get',
      params: { taskId: 'anything' },
      headers: { 'mcp-name': 'anything' },
    });
    expect(response.json().error).toMatchObject({ code: -32601 });
  });

  it('advertises the Tasks extension when a tool is served as a task', async () => {
    await start({ tools: { echo: 'always' } });
    const client = await connectClient(served!.url);
    clients.push(client);
    expect(client.getServerCapabilities()?.extensions?.[TASKS_EXTENSION_ID]).toEqual({});
  });

  it('answers synchronously when the client did not declare the extension', async () => {
    await start({ tools: { echo: 'always' } });
    const response = await call('echo', { text: 'hi' }, { tasks: false });
    expect(response.result).toMatchObject({ structuredContent: { echoed: 'hi' } });
    expect(response.result.resultType).not.toBe('task');
  });

  it('refuses a required task tool with -32021 when the client did not declare the extension', async () => {
    await start({ tools: { echo: 'always' }, required: ['echo'] });
    const response = await call('echo', { text: 'hi' }, { tasks: false });
    expect(response.error).toMatchObject({ code: -32021 });
    expect(response.result).toBeUndefined();
  });

  it("returns a task for an 'always' tool that is readable at once and completes with the tool's result", async () => {
    await start({ tools: { echo: 'always' } });
    const { result } = await call('echo', { text: 'hi' });
    expect(result).toMatchObject({ resultType: 'task', ttlMs: 86_400_000, pollIntervalMs: 2_000 });
    expect(result.taskId).toEqual(expect.any(String));
    const tasks = await requester();
    // Durability: the task exists before the handle is answered.
    expect((await tasks.get(result.taskId)).taskId).toBe(result.taskId);
    const done = await waitFor(tasks, result.taskId, 'completed');
    expect(done).toMatchObject({ result: { structuredContent: { echoed: 'hi' } } });
  });

  it("answers an 'auto' tool synchronously within the window and as a task past it", async () => {
    await start({ tools: { quick: 'auto', slow: { mode: 'auto', syncWindowMs: 100 } } });
    const fast = await call('quick');
    expect(fast.result).toMatchObject({ content: [{ type: 'text', text: 'quick done' }] });
    expect(fast.result.resultType).not.toBe('task');

    const { result } = await call('slow');
    expect(result).toMatchObject({ resultType: 'task', status: 'working' });
    const done = await waitFor(await requester(), result.taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'slow done' }] } });
  });

  it("resumes an 'auto' task that outlived its window from the persisted request context, not the live one", async () => {
    const { probe } = await start({ tools: { slowApprove: { mode: 'auto', syncWindowMs: 50 } } });
    const { result } = await call('slowApprove');
    expect(result).toMatchObject({ resultType: 'task' });
    const tasks = await requester();
    const waiting = await waitFor(tasks, result.taskId, 'input_required');
    const [key] = Object.keys(waiting.inputRequests ?? {});
    await tasks.update(result.taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
    const done = await waitFor(tasks, result.taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'approved by bob' }] } });

    // The adopted first attempt ran under the request; the resumed one was rebuilt without the token.
    expect(probe.authInfos).toEqual([
      expect.objectContaining({ clientId: 'alice', token: 'alice-token' }),
      { clientId: 'alice', scopes: [] },
    ]);
  });

  it("aborts an 'auto' tool still running its adopted first attempt on tasks/cancel", async () => {
    const { probe } = await start({ tools: { slowHang: { mode: 'auto', syncWindowMs: 50 } } });
    const { result } = await call('slowHang');
    expect(result).toMatchObject({ resultType: 'task', status: 'working' });
    const tasks = await requester();
    expect(probe.aborted).toEqual([]);
    await tasks.cancel(result.taskId);
    await vi.waitFor(() => expect(probe.aborted).toEqual(['slowHang']));
    expect((await tasks.get(result.taskId)).status).toBe('cancelled');
  });

  it("aborts an 'auto' tool when its task can't be created after the window", async () => {
    const memory = new InMemoryMCPTaskStore();
    const store: MCPTaskStore = {
      create: async () => {
        throw new Error('store unavailable');
      },
      get: (taskId, access) => memory.get(taskId, access),
      update: (taskId, responses, access) => memory.update(taskId, responses, access),
      cancel: (taskId, access) => memory.cancel(taskId, access),
      run: (taskId, work, options) => memory.run(taskId, work, options),
    };
    const { probe } = await start({ tools: { slowHang: { mode: 'auto', syncWindowMs: 50 } }, store });
    const { result } = await call('slowHang');
    expect(result).toMatchObject({ isError: true });
    expect(result.content[0].text).toContain('store unavailable');
    await vi.waitFor(() => expect(probe.aborted).toEqual(['slowHang']));
  });

  it("runs an 'always' task's first attempt from the persisted context too: no token, no context.mcp", async () => {
    const { probe } = await start({ tools: { inspect: 'always' } });
    const { result } = await call('inspect');
    expect(result).toMatchObject({ resultType: 'task' });
    await waitFor(await requester(), result.taskId, 'completed');
    expect(probe.contexts).toEqual([{ authInfo: { clientId: 'alice', scopes: [] }, hasMcp: false }]);

    // The same tool called synchronously runs under the live request.
    await call('inspect', {}, { tasks: false });
    expect(probe.contexts[1]).toEqual({
      authInfo: expect.objectContaining({ token: 'alice-token' }),
      hasMcp: true,
    });
  });

  it('warns when a request context key cannot be persisted with a task', async () => {
    const cyclic: Record<string, unknown> = { id: 'alice' };
    cyclic.self = cyclic;
    const { server } = await start({ tools: { inspect: 'always' } }, { mapAuthInfoToUser: () => cyclic });
    const warn = vi.spyOn((server as unknown as { logger: { warn: (...args: unknown[]) => void } }).logger, 'warn');
    const { result } = await call('inspect');
    expect(result).toMatchObject({ resultType: 'task' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("can't persist"), { tool: 'inspect', keys: ['user'] });
  });

  it('checks FGA again before a resumed attempt, against the persisted caller', async () => {
    let deny = false;
    // Only the MCP server's own tool resource; core's tool-level check is a separate resource.
    const deniesServerTool = (resource: { id: string }) => deny && resource.id.startsWith('[');
    const fga = {
      check: vi.fn(),
      filterAccessible: vi.fn(),
      require: vi.fn(async (user: { id: string }, params: { resource: { type: string; id: string } }) => {
        if (deniesServerTool(params.resource)) {
          throw new FGADeniedError(user, params.resource, MastraFGAPermissions.TOOLS_EXECUTE);
        }
      }),
    };
    const { probe, server } = await start(
      { tools: { approve: 'always' } },
      { mapAuthInfoToUser: ({ authInfo }) => new User(authInfo.clientId) },
    );
    server.__registerMastra({
      getServer: () => ({ fga }),
      getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
      addTool: vi.fn(),
      removeTool: vi.fn(),
    } as any);

    const { result } = await call('approve', { item: 'invoice' });
    const tasks = await requester();
    const waiting = await waitFor(tasks, result.taskId, 'input_required');
    const [key] = Object.keys(waiting.inputRequests ?? {});

    deny = true;
    await tasks.update(result.taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
    const done = await waitFor(tasks, result.taskId, 'completed');
    expect(done).toMatchObject({ result: { isError: true } });
    expect(JSON.stringify(done.result)).toContain('denied');
    expect(probe.runs).toEqual([{ tool: 'approve', resumeData: undefined }]);
    const serverToolChecks = fga.require.mock.calls.filter(([, params]) => params.resource.id.startsWith('['));
    // tools/call checked the live `User`; the resume got the plain object a durable store would read back.
    expect(serverToolChecks[0]?.[0]).toBeInstanceOf(User);
    const resumedUser = serverToolChecks.at(-1)?.[0];
    expect(resumedUser).toEqual({ id: 'alice' });
    expect(Object.getPrototypeOf(resumedUser)).toBe(Object.prototype);
  });

  it('asks for input when the tool suspends and re-runs it with the answer', async () => {
    const { probe } = await start({ tools: { approve: 'always' } });
    const { result } = await call('approve', { item: 'invoice' });
    const tasks = await requester();
    const waiting = await waitFor(tasks, result.taskId, 'input_required');
    const keys = Object.keys(waiting.inputRequests ?? {});
    expect(keys).toHaveLength(1);
    expect(waiting.inputRequests![keys[0]!]).toMatchObject({
      method: 'elicitation/create',
      params: {
        message: 'Who approves invoice?',
        requestedSchema: { type: 'object', properties: { approver: { type: 'string' } } },
      },
    });

    await tasks.update(result.taskId, { stale: { action: 'accept', content: { approver: 'mallory' } } });
    expect((await tasks.get(result.taskId)).status).toBe('input_required');

    await tasks.update(result.taskId, { [keys[0]!]: { action: 'accept', content: { approver: 'bob' } } });
    const done = await waitFor(tasks, result.taskId, 'completed');
    expect(done).toMatchObject({ result: { content: [{ type: 'text', text: 'invoice approved by bob' }] } });
    expect(probe.runs).toEqual([
      { tool: 'approve', resumeData: undefined },
      { tool: 'approve', resumeData: { approver: 'bob' } },
    ]);
  });

  it('completes with isError when the input request is declined', async () => {
    const { probe } = await start({ tools: { approve: 'always' } });
    const { result } = await call('approve', { item: 'invoice' });
    const tasks = await requester();
    const waiting = await waitFor(tasks, result.taskId, 'input_required');
    const [key] = Object.keys(waiting.inputRequests ?? {});
    await tasks.update(result.taskId, { [key!]: { action: 'decline' } });
    const done = await waitFor(tasks, result.taskId, 'completed');
    expect(done).toMatchObject({
      result: { isError: true, content: [{ type: 'text', text: "Tool 'approve' was declined" }] },
    });
    expect(probe.runs).toHaveLength(1);
  });

  it("aborts the tool's abortSignal on tasks/cancel", async () => {
    const { probe } = await start({ tools: { hang: 'always' } });
    const { result } = await call('hang');
    const tasks = await requester();
    await tasks.cancel(result.taskId);
    expect((await tasks.get(result.taskId)).status).toBe('cancelled');
    await vi.waitFor(() => expect(probe.aborted).toEqual(['hang']));
    expect((await tasks.get(result.taskId)).status).toBe('cancelled');
  });

  it('completes with isError, not failed, when the tool throws', async () => {
    await start({ tools: { boom: 'always' } });
    const { result } = await call('boom');
    const done = await waitFor(await requester(), result.taskId, 'completed');
    expect(done.result).toMatchObject({ isError: true });
    expect(JSON.stringify(done.result)).toContain('kaboom');
  });

  it('hides a task from other principals and from callers authorize refuses, as if unknown', async () => {
    const authorize = vi.fn(({ requestContext }) => requestContext.get('authInfo')?.clientId !== 'carol');
    await start({ tools: { hang: 'always' }, authorize });
    const { result } = await call('hang', {}, { user: 'alice' });

    const unknown = await requester('alice');
    const expected = await failure(unknown.get('no-such-task'));
    expect(expected).toEqual({ code: -32602, message: expect.any(String) });

    const bob = await requester('bob');
    expect(await failure(bob.get(result.taskId))).toEqual(expected);
    expect(await failure(bob.update(result.taskId, {}))).toEqual(expected);
    expect(await failure(bob.cancel(result.taskId))).toEqual(expected);

    // authorize refuses carol even on her own task.
    const carolsTask = (await call('hang', {}, { user: 'carol' })).result.taskId;
    const carol = await requester('carol');
    expect(await failure(carol.get(carolsTask))).toEqual(expected);
    expect(await failure(carol.update(carolsTask, {}))).toEqual(expected);
    expect(await failure(carol.cancel(carolsTask))).toEqual(expected);
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: expect.stringContaining('carol'),
        task: expect.objectContaining({ taskId: carolsTask }),
      }),
    );

    // alice's own access passes authorize.
    expect((await unknown.get(result.taskId)).status).toBe('working');
  });

  it('describes its task surfaces for Studio without changing tools/list', async () => {
    const { server } = await start({
      default: 'off',
      tools: { echo: 'always', quick: { mode: 'auto', ttlMs: 5_000, recover: true } },
      required: ['echo'],
    });
    expect(server.getTasksInfo()).toEqual({
      enabled: true,
      listable: true,
      surfaces: [
        { name: 'echo', type: 'tool', mode: 'always', recover: false, required: true, ttlMs: 86_400_000 },
        { name: 'quick', type: 'tool', mode: 'auto', recover: true, required: false, ttlMs: 5_000 },
      ],
    });
    const listed = await rawRequest(served!.url, { method: 'tools/list', params: {}, capabilities: TASKS_CLIENT });
    expect(JSON.stringify(await listed.json())).not.toMatch(/"(mode|recover|surfaces)"/);
  });

  it('has no task info or inspector without a tasks config', async () => {
    const { server } = await start(undefined);
    expect(server.getTasksInfo()).toBeUndefined();
    expect(server.getTasksInspector()).toBeUndefined();
  });

  it("lets Studio list every principal's tasks by key and answer or cancel them like tasks/update and tasks/cancel", async () => {
    const { server } = await start({ tools: { approve: 'always', hang: 'always' } });
    const asking = (await call('approve', { item: 'invoice' }, { user: 'alice' })).result.taskId;
    const hanging = (await call('hang', {}, { user: 'bob' })).result.taskId;
    const alice = await requester('alice');
    await waitFor(alice, asking, 'input_required');

    const inspector = server.getTasksInspector()!;
    const { tasks } = await inspector.list({});
    const serialized = JSON.stringify(tasks);
    const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url');
    for (const secret of [
      asking,
      hanging,
      'alice-token',
      'bob-token',
      tokenHash('alice-token'),
      tokenHash('bob-token'),
    ]) {
      expect(serialized).not.toContain(secret);
    }
    const bySurface = Object.fromEntries(tasks.map(task => [task.surface, task]));
    expect(bySurface.hang).toMatchObject({ status: 'working', expiresAt: expect.any(String) });
    expect(bySurface.approve).toMatchObject({
      status: 'input_required',
      inputRequests: { [Object.keys(bySurface.approve!.inputRequests!)[0]!]: { method: 'elicitation/create' } },
    });
    expect(bySurface.approve!.principalKey).not.toBe(bySurface.hang!.principalKey);
    // Token callers are labelled with their client id and a short prefix of the token's hash.
    expect(bySurface.approve!.clientLabel).toBe(`alice:token:${tokenHash('alice-token').slice(0, 8)}`);
    expect(bySurface.hang!.clientLabel).toBe(`bob:token:${tokenHash('bob-token').slice(0, 8)}`);

    const [key] = Object.keys(bySurface.approve!.inputRequests!);
    const answer = { [key!]: { action: 'accept', content: { approver: 'studio' } } };
    expect(await inspector.answer(bySurface.approve!.taskKey, answer)).toBe(true);
    const done = await waitFor(alice, asking, 'completed');
    expect(JSON.stringify(done.result)).toContain('invoice approved by studio');
    expect(await inspector.answer(bySurface.approve!.taskKey, answer)).toBe(false);

    expect(await inspector.cancel(bySurface.hang!.taskKey)).toBe(true);
    await waitFor(await requester('bob'), hanging, 'cancelled');
    expect(await inspector.cancel(bySurface.hang!.taskKey)).toBe(false);
    expect(await inspector.cancel(hanging)).toBe(false);

    // A raw task id finds its task (hashed before the lookup); a task key or unknown id finds nothing.
    expect(await inspector.find(asking)).toMatchObject({ taskKey: bySurface.approve!.taskKey, status: 'completed' });
    expect(await inspector.find(bySurface.approve!.taskKey)).toBeUndefined();
    expect(await inspector.find('not-a-task')).toBeUndefined();
    const { tasks: bobs } = await inspector.list({ principalKey: bySurface.hang!.principalKey });
    expect(bobs.map(task => task.surface)).toEqual(['hang']);
  });

  it('reports a custom store without the admin view as not listable', async () => {
    const custom = new InMemoryMCPTaskStore();
    const store: MCPTaskStore = {
      create: params => custom.create(params),
      get: (id, access) => custom.get(id, access),
      update: (id, responses, access) => custom.update(id, responses, access),
      cancel: (id, access) => custom.cancel(id, access),
      run: (id, work, options) => custom.run(id, work, options),
    };
    const { server } = await start({ tools: { echo: 'always' }, store });
    expect(server.getTasksInfo()).toMatchObject({ enabled: true, listable: false });
    expect(server.getTasksInspector()).toBeUndefined();
    custom.close();
  });

  it('fails a task whose TTL elapses and aborts its work', async () => {
    const { probe } = await start({ tools: { expiring: { mode: 'always', ttlMs: 200 } } });
    const { result } = await call('expiring');
    expect(result.ttlMs).toBe(200);
    const tasks = await requester();
    const failed = await waitFor(tasks, result.taskId, 'failed');
    expect(failed.error).toMatchObject({ code: -32603 });
    await vi.waitFor(() => expect(probe.aborted).toEqual(['expiring']));
  });

  it('keeps workflow tools synchronous even when every tool defaults to tasks', async () => {
    const workflow = createWorkflow({
      id: 'doubler',
      description: 'Doubles a number',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    })
      .then(
        createStep({
          id: 'double',
          inputSchema: z.object({ n: z.number() }),
          outputSchema: z.object({ doubled: z.number() }),
          execute: async ({ inputData }) => ({ doubled: inputData.n * 2 }),
        }),
      )
      .commit();
    await start({ default: 'always' }, { workflows: { doubler: workflow } });
    const response = await call('run_doubler', { n: 21 });
    expect(response.result.resultType).not.toBe('task');
    expect(JSON.stringify(response.result)).toContain('42');
    expect((await call('plain')).result.resultType).toBe('task');
  });

  it('rejects task configs it cannot serve at construction', () => {
    const tools = makeTools({ runs: [], aborted: [], authInfos: [], contexts: [] });
    const make = (tasks: unknown) => () =>
      new MCPServer({ name: 'Bad', version: '1.0.0', tools, tasks: tasks as MCPServerConfig['tasks'] });
    expect(make({ tools: { nope: 'always' } })).toThrow(/not one of this server's tools/);
    expect(make({ workflows: {} })).toThrow(/tasks.workflows is not supported yet/);
    expect(make({ agents: {} })).toThrow(/tasks.agents is not supported yet/);
    expect(make({ tools: { echo: 'off' }, required: ['echo'] })).toThrow(/not served as a task/);
    expect(make({ tools: { echo: 'sometimes' } })).toThrow(/unknown task mode/);
    expect(make({ tools: { echo: { mode: 'auto', syncWindowMs: -1 } } })).toThrow(/non-negative integer/);
    expect(make({ recover: 'yes' })).toThrow(/tasks.recover must be a boolean/);
    expect(make({ tools: { echo: { mode: 'always', recover: 1 } } })).toThrow(
      /tasks.tools.echo.recover must be a boolean/,
    );
  });

  it('resolves recover per tool, falling back to tasks.recover and then false', () => {
    const tools = Object.keys(makeTools({ runs: [], aborted: [], authInfos: [], contexts: [] }));
    const plain = resolveTasksConfig({ default: 'always' }, tools);
    expect(plain.modeFor('echo', undefined).recover).toBe(false);

    const config = resolveTasksConfig(
      { default: 'always', recover: true, tools: { echo: { mode: 'always', recover: false }, quick: 'auto' } },
      tools,
    );
    expect(config.modeFor('echo', undefined).recover).toBe(false);
    expect(config.modeFor('quick', undefined).recover).toBe(true);
    expect(config.modeFor('approve', undefined).recover).toBe(true);
  });
});
