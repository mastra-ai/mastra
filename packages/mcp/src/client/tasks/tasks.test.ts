import { MastraError } from '@mastra/core/error';
import { afterEach, describe, expect, it } from 'vitest';
import { startTasksFixtureServer } from '../../__fixtures__/tasks-server';
import type { TasksFixtureServer } from '../../__fixtures__/tasks-server';
import { taskKeyOf } from '../../shared/tasks';
import { MCPClient } from '../configuration';
import type { MastraMCPServerDefinition, MCPInputRequestSuspendPayload } from '../types';

let server: TasksFixtureServer | undefined;
let mcp: MCPClient | undefined;

afterEach(async () => {
  await mcp?.disconnect().catch(() => {});
  await server?.close();
  mcp = undefined;
  server = undefined;
});

async function connect(definition: Partial<MastraMCPServerDefinition> = { tasks: true }) {
  server = await startTasksFixtureServer();
  mcp = new MCPClient({
    id: `tasks-${Math.random()}`,
    servers: { reports: { url: server.url, ...definition } as MastraMCPServerDefinition },
  });
  const tools = await mcp.listTools();
  const call = (name: string, input: Record<string, unknown> = {}, context: Record<string, unknown> = {}) =>
    tools[`reports_${name}`]!.execute!(input, context as never);
  return { tools, call };
}

const methods = () => server!.requests.map(request => request.method);
const caught = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('MCPClient with MCP Tasks', () => {
  it('waits for a long-running tool that the server turned into a task', async () => {
    const { call } = await connect();

    const result = await call('report');

    expect(result).toMatchObject({ content: [{ type: 'text', text: 'report ready' }] });
    expect(server!.runs.report).toBe(1);
    const call0 = server!.requests.find(request => request.method === 'tools/call')!;
    expect(call0.declaredTasks).toBe(true);
    expect(methods().filter(method => method === 'tasks/get').length).toBeGreaterThan(0);
    // Polls are routed by task id.
    const taskId = server!.requests.find(request => request.method === 'tasks/get')!.params.taskId;
    expect(server!.requests.filter(r => r.method === 'tasks/get').every(r => r.mcpName === taskId)).toBe(true);
  });

  it('tags the tool call span with a hash of the task id, never the id itself', async () => {
    const updates: Array<{ metadata?: Record<string, unknown> }> = [];
    const span = {
      isValid: true,
      traceId: '0af7651916cd43dd8448eb211c80319c',
      id: 'b7ad6b7169203331',
      update: (options: { metadata?: Record<string, unknown> }) => updates.push(options),
    };
    const { call } = await connect();

    await call('report', {}, { tracingContext: { currentSpan: span } });

    const taskId = server!.requests.find(request => request.method === 'tasks/get')!.params.taskId as string;
    expect(updates).toEqual([{ metadata: { mcpTaskKey: taskKeyOf(taskId) } }]);
    expect(JSON.stringify(updates)).not.toContain(taskId);
  });

  it('keeps tool calls synchronous for servers that did not opt in', async () => {
    const { call } = await connect({});

    expect(await call('report')).toMatchObject({ content: [{ text: 'report ready' }] });
    expect(server!.requests.find(request => request.method === 'tools/call')!.declaredTasks).toBe(false);
    expect(methods().some(method => method.startsWith('tasks/'))).toBe(false);
  });

  it('answers a task that needs input through inputRequests, once, without re-running the tool', async () => {
    const asked: string[] = [];
    const { call } = await connect({
      tasks: true,
      inputRequests: async ({ key, params }) => {
        asked.push(`${key}:${params.message}`);
        return { action: 'accept', content: { ok: true } };
      },
    });

    expect(await call('confirm')).toMatchObject({ content: [{ text: 'sent' }] });
    expect(asked).toEqual(['approve:Send it?']);
    expect(server!.runs.confirm).toBe(1);
    const update = server!.requests.find(request => request.method === 'tasks/update')!;
    expect(update.params.inputResponses).toEqual({ approve: { action: 'accept', content: { ok: true } } });
  });

  it('writes the MCP task id and each status change to the tool output stream', async () => {
    const { call } = await connect({
      tasks: true,
      inputRequests: async () => ({ action: 'accept', content: { ok: true } }),
    });
    const writes: unknown[] = [];
    const writer = { write: async (data: unknown) => void writes.push(data) };

    await call('confirm', {}, { writer });

    const taskId = server!.requests.find(request => request.method === 'tasks/get')!.params.taskId;
    const statuses = writes.map(write => (write as { status: string }).status);
    expect(writes[0]).toEqual({
      type: 'mcp-task',
      taskId,
      status: 'working',
      createdAt: expect.any(String),
      serverName: 'reports',
    });
    expect(statuses).toContain('input_required');
    expect(statuses.at(-1)).toBe('completed');
    // One write per change, not per poll.
    expect(statuses.every((status, index) => status !== statuses[index - 1])).toBe(true);
    expect(writes.every(write => (write as { taskId: string }).taskId === taskId)).toBe(true);
  });

  it('fails a task needing input when no inputRequests handler is configured and the caller cannot suspend', async () => {
    const { call } = await connect();

    const error = await caught(call('confirm'));
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_INPUT_UNHANDLED' });
  });

  it('cancels the remote task when the call is aborted', async () => {
    const { call } = await connect();
    const controller = new AbortController();

    const pending = caught(call('gated', {}, { abortSignal: controller.signal }));
    await waitFor(() => methods().includes('tasks/get'));
    controller.abort(new Error('user stopped'));

    expect(await pending).toMatchObject({ message: 'user stopped' });
    await waitFor(() => methods().includes('tasks/cancel'));
    const taskId = server!.requests.find(request => request.method === 'tasks/cancel')!.params.taskId as string;
    expect((await server!.store.get(taskId, { principal: 'anonymous' }))?.status).toBe('cancelled');
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
  });

  it('gives up and cancels after maxWaitMs', async () => {
    const { call } = await connect({ tasks: { maxWaitMs: 100 } });

    expect(await caught(call('gated'))).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_TIMEOUT' });
    await waitFor(() => methods().includes('tasks/cancel'));
  });

  it('times out at maxWaitMs while a poll is still waiting for its answer, without returning the late result', async () => {
    const { call } = await connect({ tasks: { maxWaitMs: 300 } });
    server!.delayTaskGets(1_000);

    const startedAt = Date.now();
    expect(await caught(call('report'))).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_TIMEOUT' });
    expect(Date.now() - startedAt).toBeLessThan(900);
    await waitFor(() => methods().includes('tasks/cancel'));
  });

  it('times out at maxWaitMs while the input handler is still running, without sending its late answer', async () => {
    let handlerSignal: AbortSignal | undefined;
    let release!: () => void;
    const { call } = await connect({
      tasks: { maxWaitMs: 300 },
      inputRequests: ({ signal }) => {
        handlerSignal = signal;
        return new Promise(resolve => (release = () => resolve({ action: 'accept', content: { ok: true } })));
      },
    });

    expect(await caught(call('confirm'))).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_TIMEOUT' });
    expect(handlerSignal?.aborted).toBe(true);
    await waitFor(() => methods().includes('tasks/cancel'));
    release();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(methods()).not.toContain('tasks/update');
  });

  it('rejects an aborted call at once even when the input handler ignores its signal', async () => {
    const controller = new AbortController();
    let release!: () => void;
    const { call } = await connect({
      tasks: true,
      inputRequests: () => {
        setTimeout(() => controller.abort(new Error('user stopped')), 20);
        return new Promise(resolve => (release = () => resolve({ action: 'accept', content: { ok: true } })));
      },
    });

    expect(await caught(call('confirm', {}, { abortSignal: controller.signal }))).toMatchObject({
      message: 'user stopped',
    });
    await waitFor(() => methods().includes('tasks/cancel'));
    release();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(methods()).not.toContain('tasks/update');
  });

  it('keeps waiting for a task while the server restarts', async () => {
    const { call } = await connect();

    const pending = call('gated');
    await waitFor(() => methods().includes('tasks/get'));
    await server!.restart(1_500);
    server!.release();

    expect(await pending).toMatchObject({ content: [{ text: 'released' }] });
    expect(server!.runs.gated).toBe(1);
  });

  it('stops waiting, and does not reconnect, when the client disconnects during a task', async () => {
    const { call } = await connect();

    const pending = caught(call('gated'));
    await waitFor(() => methods().includes('tasks/get'));
    await mcp!.disconnect();

    expect(await pending).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_POLL_FAILED' });
    // Any request after the call ends (server/discover, initialize, tasks/get) would be a reconnect.
    const seen = methods().length;
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(methods().slice(seen)).toEqual([]);
  });

  it('keeps waiting for a task while a proxy answers 503 for the server', async () => {
    const { call } = await connect();

    const pending = call('gated');
    await waitFor(() => methods().includes('tasks/get'));
    server!.setGatewayStatus(503);
    await new Promise(resolve => setTimeout(resolve, 1_500));
    server!.setGatewayStatus(undefined);
    server!.release();

    expect(await pending).toMatchObject({ content: [{ text: 'released' }] });
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
  });

  it('fails at once when the server no longer knows the task', async () => {
    const { call } = await connect();

    const pending = caught(call('gated'));
    await waitFor(() => methods().includes('tasks/get'));
    server!.store.close();

    expect(await pending).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_POLL_FAILED' });
  });

  it('reports a tool error inside a completed task like a synchronous tool error', async () => {
    const { call } = await connect();

    expect(await caught(call('broken'))).toMatchObject({
      id: 'MCP_CLIENT_TOOL_EXECUTION_FAILED',
      message: 'disk full',
    });
  });

  it('returns a tool error inside a completed task when onToolError is return', async () => {
    const { call } = await connect({ tasks: true, onToolError: 'return' });

    expect(await call('broken')).toMatchObject({ isError: true, content: [{ text: 'disk full' }] });
  });

  it('surfaces an infrastructure failure of the task', async () => {
    const { call } = await connect();

    expect(await caught(call('lost'))).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_FAILED', message: 'worker lost' });
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
  });

  it('validates and returns structured output of a completed task', async () => {
    const { call } = await connect();

    expect(await call('totals')).toMatchObject({ total: 3 });
  });

  it('lets tools of a tasks-enabled server run as background tasks without retries', async () => {
    const { tools } = await connect({ tasks: { maxWaitMs: 600_000 } });

    expect(tools.reports_report!.background).toEqual({
      enabled: true,
      defaultDisposition: 'deferred',
      timeoutMs: 600_000,
      maxRetries: 0,
    });
  });

  it('reads and cancels a task directly through mcp.tasks', async () => {
    const { call } = await connect();
    const pending = caught(call('gated'));
    await waitFor(() => methods().includes('tasks/get'));
    const taskId = server!.requests.find(request => request.method === 'tasks/get')!.params.taskId as string;

    expect(await mcp!.tasks.get('reports', taskId)).toMatchObject({ taskId, status: 'working' });
    await mcp!.tasks.cancel('reports', taskId);

    expect(await pending).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_CANCELLED' });
    const missing = await caught(mcp!.tasks.get('reports', 'unknown'));
    expect(missing).toMatchObject({ id: 'MCP_CLIENT_GET_TASK_FAILED', cause: { code: -32602 } });
  });
});

/**
 * A tool call whose MCP task asks for input, with no `inputRequests` handler configured, is answered from
 * the agent chat: the call suspends with the server's requests, and the chat's answer resumes it on the
 * same remote task (issue #28986).
 */
describe('MCPClient answering MCP task input from the agent chat', () => {
  const approve = { approve: { action: 'accept', content: { ok: true } } };

  /** The execution context an agent (or workflow) gives a tool, recording what the tool suspends with. */
  function chat(where: 'agent' | 'workflow' = 'agent') {
    const suspensions: MCPInputRequestSuspendPayload[] = [];
    const suspend = async (payload: MCPInputRequestSuspendPayload) => void suspensions.push(payload);
    const context = (resume?: { resumeData: unknown; suspendPayload: unknown }) => ({
      [where]: where === 'agent' ? { toolCallId: 'call-1', messages: [], suspend, ...resume } : { suspend, ...resume },
    });
    return { suspensions, context };
  }

  it.each(['agent', 'workflow'] as const)(
    'suspends a %s tool call with the server requests and leaves the remote task waiting',
    async where => {
      const { call } = await connect();
      const { suspensions, context } = chat(where);
      const writes: unknown[] = [];
      const writer = { write: async (data: unknown) => void writes.push(data) };

      expect(await call('confirm', {}, { ...context(), writer })).toBeUndefined();

      const taskId = server!.requests.find(request => request.method === 'tasks/get')!.params.taskId as string;
      expect(suspensions).toEqual([
        {
          type: 'mcp-input-request',
          serverName: 'reports',
          toolName: 'confirm',
          taskId,
          createdAt: expect.any(String),
          requests: {
            approve: {
              method: 'elicitation/create',
              params: expect.objectContaining({ message: 'Send it?', requestedSchema: expect.any(Object) }),
            },
          },
        },
      ]);
      expect(methods()).not.toContain('tasks/cancel');
      expect((await server!.store.get(taskId, { principal: 'anonymous' }))?.status).toBe('input_required');
      expect(writes.map(write => (write as { status: string }).status)).toContain('input_required');
    },
  );

  it.each(['agent', 'workflow'] as const)(
    'resumes a %s tool call on the same remote task without calling the tool again',
    async where => {
      const { call } = await connect();
      const { suspensions, context } = chat(where);
      await call('confirm', {}, context());

      const result = await call(
        'confirm',
        {},
        context({ resumeData: { inputResponses: approve }, suspendPayload: suspensions[0] }),
      );

      expect(result).toMatchObject({ content: [{ type: 'text', text: 'sent' }] });
      expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
      expect(server!.runs.confirm).toBe(1);
      const updates = server!.requests.filter(request => request.method === 'tasks/update');
      expect(updates.map(update => update.params)).toEqual([
        expect.objectContaining({ taskId: suspensions[0]!.taskId, inputResponses: approve }),
      ]);
      expect(suspensions).toHaveLength(1);
    },
  );

  it('suspends again with only the new request when the server asks a second time', async () => {
    const { call } = await connect();
    const { suspensions, context } = chat();
    await call('confirm_twice', {}, context());

    const second = await call(
      'confirm_twice',
      {},
      context({ resumeData: { inputResponses: approve }, suspendPayload: suspensions[0] }),
    );

    expect(second).toBeUndefined();
    expect(suspensions[1]).toMatchObject({ taskId: suspensions[0]!.taskId, toolName: 'confirm_twice' });
    expect(Object.keys(suspensions[1]!.requests)).toEqual(['confirm']);

    const done = await call(
      'confirm_twice',
      {},
      context({
        resumeData: { inputResponses: { confirm: { action: 'accept', content: { ok: true } } } },
        suspendPayload: suspensions[1],
      }),
    );
    expect(done).toMatchObject({ content: [{ text: 'sent twice confirmed' }] });
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
    expect(server!.runs.confirm_twice).toBe(1);
  });

  it('lets a configured inputRequests handler answer instead of suspending', async () => {
    const { call } = await connect({
      tasks: true,
      inputRequests: async () => ({ action: 'accept', content: { ok: true } }),
    });
    const { suspensions, context } = chat();

    expect(await call('confirm', {}, context())).toMatchObject({ content: [{ text: 'sent' }] });
    expect(suspensions).toEqual([]);
  });

  it('fails the resumed call when the remote task was cancelled meanwhile, without calling the tool again', async () => {
    const { call } = await connect();
    const { suspensions, context } = chat();
    await call('confirm', {}, context());
    await mcp!.tasks.cancel('reports', suspensions[0]!.taskId);

    const error = await caught(
      call('confirm', {}, context({ resumeData: { inputResponses: approve }, suspendPayload: suspensions[0] })),
    );

    expect(error).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_CANCELLED' });
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
  });

  it('fails the resumed call when the server no longer knows the task', async () => {
    const { call } = await connect();
    const { suspensions, context } = chat();
    await call('confirm', {}, context());
    server!.store.close();

    const error = await caught(
      call('confirm', {}, context({ resumeData: { inputResponses: approve }, suspendPayload: suspensions[0] })),
    );

    expect(error).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_POLL_FAILED' });
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
  });

  it.each([
    ['no answers', undefined],
    ['answers that are not an object', { inputResponses: 'yes' }],
    ['an answer missing for a request', { inputResponses: {} }],
    ['an unknown action', { inputResponses: { approve: { action: 'maybe' } } }],
  ])('rejects resume data with %s without answering the task', async (_, resumeData) => {
    const { call } = await connect();
    const { suspensions, context } = chat();
    await call('confirm', {}, context());

    const error = await caught(call('confirm', {}, context({ resumeData, suspendPayload: suspensions[0] })));

    expect(error).toMatchObject({ id: 'MCP_CLIENT_TOOL_TASK_RESUME_INVALID' });
    expect(methods()).not.toContain('tasks/update');
    expect(methods().filter(method => method === 'tools/call')).toHaveLength(1);
  });

  it('tags the resumed tool call span with the same task key, never the task id', async () => {
    const { call } = await connect();
    const { suspensions, context } = chat();
    const spanFor = (updates: Array<{ metadata?: Record<string, unknown> }>) => ({
      isValid: true,
      traceId: '0af7651916cd43dd8448eb211c80319c',
      id: 'b7ad6b7169203331',
      update: (options: { metadata?: Record<string, unknown> }) => updates.push(options),
    });
    const first: Array<{ metadata?: Record<string, unknown> }> = [];
    const resumed: Array<{ metadata?: Record<string, unknown> }> = [];

    await call('confirm', {}, { ...context(), tracingContext: { currentSpan: spanFor(first) } });
    await call(
      'confirm',
      {},
      {
        ...context({ resumeData: { inputResponses: approve }, suspendPayload: suspensions[0] }),
        tracingContext: { currentSpan: spanFor(resumed) },
      },
    );

    const taskId = suspensions[0]!.taskId;
    expect(resumed).toEqual([{ metadata: { mcpTaskKey: taskKeyOf(taskId) } }]);
    expect(resumed).toEqual(first);
    expect(JSON.stringify(resumed)).not.toContain(taskId);
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 2_000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition not met');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
