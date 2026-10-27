import { MastraError } from '@mastra/core/error';
import { afterEach, describe, expect, it } from 'vitest';
import { startTasksFixtureServer } from '../../__fixtures__/tasks-server';
import type { TasksFixtureServer } from '../../__fixtures__/tasks-server';
import { MCPClient } from '../configuration';
import type { MastraMCPServerDefinition } from '../types';

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

  it('fails a task needing input when no inputRequests handler is configured', async () => {
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

  it('keeps waiting for a task while the server restarts', async () => {
    const { call } = await connect();

    const pending = call('gated');
    await waitFor(() => methods().includes('tasks/get'));
    await server!.restart(1_500);
    server!.release();

    expect(await pending).toMatchObject({ content: [{ text: 'released' }] });
    expect(server!.runs.gated).toBe(1);
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

async function waitFor(condition: () => boolean, timeoutMs = 2_000) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition not met');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
