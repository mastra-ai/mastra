import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Observability } from '@mastra/observability';
import type { Client } from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TaskRequester } from '../client/tasks/requester';
import { taskKeyOf, tasksCapabilityEntry } from '../shared/tasks';
import type { MCPDetailedTask } from '../shared/tasks';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';

vi.setConfig({ testTimeout: 20_000 });

const TASKS_CLIENT = { extensions: tasksCapabilityEntry() };
const authFor = (user: string): AuthInfo => ({ token: `${user}-token`, clientId: user, scopes: [] });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const tools = {
  echo: createTool({
    id: 'echo',
    description: 'Echoes the text from inside a span of its own',
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }, context) => context.observe.span('inside echo', async () => ({ echoed: text })),
  }),
  approve: createTool({
    id: 'approve',
    description: 'Asks who approves, then finishes',
    inputSchema: z.object({}),
    resumeSchema: z.object({ approver: z.string() }),
    execute: async (_args, context) => {
      if (!context.resumeData) {
        await context.suspend?.({ message: 'Who approves?' });
        return;
      }
      return `approved by ${context.resumeData.approver}`;
    },
  }),
  hang: createTool({
    id: 'hang',
    description: 'Runs until cancelled',
    inputSchema: z.object({}),
    execute: (_args, context) =>
      new Promise((_resolve, reject) => {
        const signal = context.abortSignal!;
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
  }),
  slow: createTool({
    id: 'slow',
    description: 'Outlives its sync window',
    inputSchema: z.object({}),
    execute: async () => {
      await sleep(300);
      return 'slow done';
    },
  }),
};

const TASKS: MCPServerConfig['tasks'] = {
  tools: { echo: 'always', approve: 'always', hang: 'always', slow: { mode: 'auto', syncWindowMs: 50 } },
};

describe.each([
  { store: 'in-memory', background: false },
  { store: 'Mastra background tasks', background: true },
])('MCP tool task tracing ($store)', ({ background }) => {
  const ended: any[] = [];
  let served: ServedHTTP | undefined;
  let mastra: Mastra | undefined;
  const clients: Client[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map(client => client.close()));
    await served?.close();
    served = undefined;
    await mastra?.shutdown();
    mastra = undefined;
    ended.length = 0;
  });

  async function start() {
    const server = new MCPServer({ id: 'tasks', name: 'Tasks', version: '1.0.0', tools, tasks: TASKS });
    mastra = new Mastra({
      logger: false,
      mcpServers: { tasks: server },
      ...(background && { storage: new InMemoryStore(), backgroundTasks: { enabled: true } }),
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'mcp-task-tracing-test',
            exporters: [
              {
                name: 'collecting-exporter',
                async exportTracingEvent(event: { type: string; exportedSpan?: any }) {
                  if (event.type === TracingEventType.SPAN_ENDED) ended.push(event.exportedSpan);
                },
                async flush() {},
                async shutdown() {},
              },
            ],
          },
        },
      }),
    });
    served = await serveHTTP(server, { auth: () => authFor('alice') });
    const client = await connectClient(served.url);
    clients.push(client);
    return new TaskRequester(client);
  }

  async function call(name: string, args: Record<string, unknown> = {}) {
    const response = await rawRequest(served!.url, {
      method: 'tools/call',
      params: { name, arguments: args },
      capabilities: TASKS_CLIENT,
      headers: { 'mcp-name': name },
    });
    return response.json().result as { taskId: string; resultType: string };
  }

  async function waitFor(tasks: TaskRequester, taskId: string, status: MCPDetailedTask['status']) {
    for (let i = 0; i < 200; i++) {
      const task = await tasks.get(taskId);
      if (task.status === status) return task;
      await sleep(20);
    }
    throw new Error(`task never reached ${status}`);
  }

  /** Waits for a span the task is still finishing, e.g. the attempt after its outcome was recorded. */
  async function spanNamed(name: string) {
    for (let i = 0; i < 100 && !ended.some(span => span.name === name); i++) await sleep(20);
    const span = ended.find(span => span.name === name);
    if (!span) throw new Error(`no span "${name}" in ${ended.map(s => s.name).join(', ')}`);
    return span;
  }

  const root = (taskId: string) => {
    const span = ended.find(
      s =>
        s.type === SpanType.MCP_SERVER_REQUEST &&
        s.metadata?.mcpTaskKey === taskKeyOf(taskId) &&
        s.name.startsWith('tools/call'),
    );
    if (!span) throw new Error('no root span');
    return span;
  };

  it("records an 'always' task as one trace rooted at the tools/call that created it", async () => {
    const tasks = await start();
    const { taskId } = await call('echo', { text: 'hi' });
    for (let i = 0; i < 3; i++) await tasks.get(taskId);
    await waitFor(tasks, taskId, 'completed');
    const attempt = await spanNamed('task attempt echo #1');
    const inside = await spanNamed('inside echo');

    const top = root(taskId);
    expect(top).toMatchObject({
      parentSpanId: undefined,
      errorInfo: undefined,
      output: { task: { status: 'working', mcpTaskKey: taskKeyOf(taskId) } },
      metadata: { mcpTaskKey: taskKeyOf(taskId), mcpTaskStatus: 'working' },
    });
    expect(attempt).toMatchObject({
      traceId: top.traceId,
      parentSpanId: top.id,
      metadata: {
        mcpTaskKey: taskKeyOf(taskId),
        attempt: 1,
        resumed: false,
        recovered: false,
        mcpTaskStatus: 'completed',
      },
    });
    expect(inside).toMatchObject({ traceId: top.traceId, parentSpanId: attempt.id });
    expect(ended.filter(span => span.name.startsWith('tasks/get'))).toEqual([]);
    expect(new Set(ended.map(span => span.traceId))).toEqual(new Set([top.traceId]));
  });

  it('keeps a task that asked for input, its tasks/update and its resumed attempt in one trace', async () => {
    const tasks = await start();
    const { taskId } = await call('approve');
    const waiting = await waitFor(tasks, taskId, 'input_required');
    const first = await spanNamed('task attempt approve #1');
    const [key] = Object.keys(waiting.inputRequests!);
    await tasks.update(taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
    await waitFor(tasks, taskId, 'completed');
    const second = await spanNamed('task attempt approve #2');

    const top = root(taskId);
    const update = await spanNamed('tasks/update');
    expect(first).toMatchObject({
      parentSpanId: top.id,
      metadata: { mcpTaskStatus: 'input_required', resumed: false },
    });
    expect(update).toMatchObject({
      traceId: top.traceId,
      parentSpanId: top.id,
      input: { mcpTaskKey: taskKeyOf(taskId) },
      metadata: { mcpTaskKey: taskKeyOf(taskId) },
    });
    expect(second).toMatchObject({
      traceId: top.traceId,
      parentSpanId: top.id,
      metadata: { attempt: 2, resumed: true, recovered: false, mcpTaskStatus: 'completed' },
    });
  });

  it('records a cancelled task, and its tasks/cancel, in the task trace without errors', async () => {
    const tasks = await start();
    const { taskId } = await call('hang');
    await waitFor(tasks, taskId, 'working');
    await sleep(50);
    await tasks.cancel(taskId);
    const attempt = await spanNamed('task attempt hang #1');
    const cancel = await spanNamed('tasks/cancel');

    const top = root(taskId);
    expect(cancel).toMatchObject({
      traceId: top.traceId,
      parentSpanId: top.id,
      errorInfo: undefined,
      metadata: { mcpTaskKey: taskKeyOf(taskId), mcpTaskStatus: 'cancelled' },
    });
    expect(attempt).toMatchObject({
      traceId: top.traceId,
      parentSpanId: top.id,
      errorInfo: undefined,
      metadata: { mcpTaskStatus: 'cancelled' },
    });
  });

  it("records starting a task as a success, for 'auto' handoffs too, with the first run as attempt 1", async () => {
    const tasks = await start();
    const { taskId, resultType } = await call('slow');
    expect(resultType).toBe('task');
    await waitFor(tasks, taskId, 'completed');
    const attempt = await spanNamed('task attempt slow #1');

    const top = root(taskId);
    expect(top).toMatchObject({ errorInfo: undefined, metadata: { mcpTaskStatus: 'working' } });
    expect(attempt).toMatchObject({
      traceId: top.traceId,
      parentSpanId: top.id,
      metadata: { attempt: 1, mcpTaskStatus: 'completed' },
    });
  });

  it('traces a tasks/update for a task the caller cannot see on its own, and never records a task id', async () => {
    const tasks = await start();
    const { taskId } = await call('echo', { text: 'hi' });
    await waitFor(tasks, taskId, 'completed');
    await expect(tasks.update('not-a-task', {})).rejects.toMatchObject({ code: -32602 });
    const update = await spanNamed('tasks/update');
    expect(update).toMatchObject({ parentSpanId: undefined, input: { mcpTaskKey: taskKeyOf('not-a-task') } });
    await spanNamed('task attempt echo #1');
    const recorded = JSON.stringify(ended);
    expect(recorded).not.toContain(taskId);
    expect(recorded).not.toContain('not-a-task');
  });
});

const approval = createWorkflow({
  id: 'approval',
  description: 'Prepares a release, then asks who approves it',
  inputSchema: z.object({ release: z.string() }),
  outputSchema: z.object({ outcome: z.string() }),
})
  .then(
    createStep({
      id: 'prepare',
      inputSchema: z.object({ release: z.string() }),
      outputSchema: z.object({ release: z.string() }),
      execute: async ({ inputData }) => inputData,
    }),
  )
  .then(
    createStep({
      id: 'ask',
      inputSchema: z.object({ release: z.string() }),
      outputSchema: z.object({ outcome: z.string() }),
      resumeSchema: z.object({ approver: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) return suspend({ message: `Who approves ${inputData.release}?` });
        return { outcome: `${inputData.release} approved by ${resumeData.approver}` };
      },
    }),
  )
  .commit();

const researcher = new Agent({
  id: 'researcher',
  name: 'researcher',
  description: 'Researches a topic',
  instructions: 'Answer briefly.',
  model: new MockLanguageModelV2({
    doGenerate: async () => {
      await sleep(100);
      return {
        content: [{ type: 'text', text: 'Phobos is a moon of Mars.' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  }),
});

describe.each([
  { store: 'in-memory', background: false },
  { store: 'Mastra background tasks', background: true },
])('MCP workflow and agent task tracing ($store)', ({ background }) => {
  const ended: any[] = [];
  let served: ServedHTTP | undefined;
  let mastra: Mastra | undefined;
  const clients: Client[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map(client => client.close()));
    await served?.close();
    served = undefined;
    await mastra?.shutdown();
    mastra = undefined;
    ended.length = 0;
  });

  async function start(tasks: MCPServerConfig['tasks']) {
    const server = new MCPServer({
      id: 'tasks',
      name: 'Tasks',
      version: '1.0.0',
      tools: {},
      workflows: { approval },
      agents: { researcher },
      tasks,
    });
    mastra = new Mastra({
      logger: false,
      mcpServers: { tasks: server },
      // Workflow runs need storage to suspend and resume.
      storage: new InMemoryStore(),
      ...(background && { backgroundTasks: { enabled: true } }),
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'mcp-task-tracing-test',
            exporters: [
              {
                name: 'collecting-exporter',
                async exportTracingEvent(event: { type: string; exportedSpan?: any }) {
                  if (event.type === TracingEventType.SPAN_ENDED) ended.push(event.exportedSpan);
                },
                async flush() {},
                async shutdown() {},
              },
            ],
          },
        },
      }),
    });
    served = await serveHTTP(server, { auth: () => authFor('alice') });
    const client = await connectClient(served.url);
    clients.push(client);
    return new TaskRequester(client);
  }

  async function call(name: string, args: Record<string, unknown> = {}) {
    const response = await rawRequest(served!.url, {
      method: 'tools/call',
      params: { name, arguments: args },
      capabilities: TASKS_CLIENT,
      headers: { 'mcp-name': name },
    });
    return response.json().result as { taskId: string; resultType: string };
  }

  async function waitFor(tasks: TaskRequester, taskId: string, status: MCPDetailedTask['status']) {
    for (let i = 0; i < 200; i++) {
      const task = await tasks.get(taskId);
      if (task.status === status) return task;
      await sleep(20);
    }
    throw new Error(`task never reached ${status}`);
  }

  async function spanNamed(name: string) {
    for (let i = 0; i < 100 && !ended.some(span => span.name === name); i++) await sleep(20);
    const span = ended.find(span => span.name === name);
    if (!span) throw new Error(`no span "${name}" in ${ended.map(s => s.name).join(', ')}`);
    return span;
  }

  const root = (taskId: string) => {
    const span = ended.find(s => s.metadata?.mcpTaskKey === taskKeyOf(taskId) && s.name.startsWith('tools/call'));
    if (!span) throw new Error('no root span');
    return span;
  };

  /** The span's ancestors, nearest first, as far as the recorded spans go. */
  const ancestors = (span: any) => {
    const chain: any[] = [];
    for (let parent = span.parentSpanId; parent;) {
      const next = ended.find(s => s.id === parent);
      if (!next) break;
      chain.push(next);
      parent = next.parentSpanId;
    }
    return chain;
  };

  it.each(['always', 'auto'] as const)(
    "keeps an '%s' workflow task in one trace: tools/call, the run, tasks/update, and the resumed run",
    async mode => {
      const tasks = await start({ workflows: { approval: mode } });
      const { taskId, resultType } = await call('run_approval', { release: 'v1' });
      expect(resultType).toBe('task');
      const waiting = await waitFor(tasks, taskId, 'input_required');
      const [key] = Object.keys(waiting.inputRequests!);
      await tasks.update(taskId, { [key!]: { action: 'accept', content: { approver: 'bob' } } });
      const done = await waitFor(tasks, taskId, 'completed');
      expect(done.result).toMatchObject({ isError: false });
      const run = await spanNamed("workflow run: 'approval'");
      const resumed = await spanNamed("workflow run: 'approval' (resumed)");
      const update = await spanNamed('tasks/update');
      const second = await spanNamed('task attempt run_approval #2');
      const first = await spanNamed('task attempt run_approval #1');

      const top = root(taskId);
      expect(top).toMatchObject({ parentSpanId: undefined, errorInfo: undefined });
      expect(ancestors(run)).toContainEqual(expect.objectContaining({ id: top.id }));
      expect(first).toMatchObject({
        traceId: top.traceId,
        parentSpanId: top.id,
        metadata: { attempt: 1, mcpTaskStatus: 'input_required' },
      });
      expect(update).toMatchObject({ traceId: top.traceId, parentSpanId: top.id });
      expect(second).toMatchObject({ traceId: top.traceId, parentSpanId: top.id, metadata: { resumed: true } });
      // The resumed run belongs to the attempt that resumed it.
      expect(resumed).toMatchObject({ traceId: top.traceId, parentSpanId: second.id });
      expect(new Set(ended.map(span => span.traceId))).toEqual(new Set([top.traceId]));

      const recorded = JSON.stringify(ended);
      expect(recorded).not.toContain(taskId);
      expect(run.metadata.runId).not.toBe(taskId);
    },
  );

  it.each(['always', 'auto'] as const)('runs an %s agent task under its attempt span', async mode => {
    const tasks = await start({ agents: { researcher: mode === 'auto' ? { mode, syncWindowMs: 20 } : mode } });
    const { taskId, resultType } = await call('ask_researcher', { message: 'Tell me about Phobos' });
    expect(resultType).toBe('task');
    await waitFor(tasks, taskId, 'completed');
    const agentRun = await spanNamed("agent run: 'researcher'");
    const attempt = await spanNamed('task attempt ask_researcher #1');

    const top = root(taskId);
    expect(attempt).toMatchObject({ traceId: top.traceId, parentSpanId: top.id });
    expect(agentRun).toMatchObject({ traceId: top.traceId });
    expect(ancestors(agentRun)).toContainEqual(expect.objectContaining({ id: top.id }));
    expect(new Set(ended.map(span => span.traceId))).toEqual(new Set([top.traceId]));
    expect(JSON.stringify(ended)).not.toContain(taskId);
  });
});
