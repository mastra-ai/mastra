import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Workflow } from '@mastra/core/workflows';
import type { Client } from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { TaskRequester } from '../client/tasks/requester';
import { tasksCapabilityEntry } from '../shared/tasks';
import type { MCPDetailedTask } from '../shared/tasks';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';

vi.setConfig({ testTimeout: 20_000 });

const TASKS_CLIENT = { extensions: tasksCapabilityEntry() };
const authFor = (user: string): AuthInfo => ({ token: `${user}-token`, clientId: user, scopes: [] });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Probe {
  /** Side effects of steps that must run once per run. */
  prepared: number;
  slowRuns: number;
  aborted: string[];
  modelCalls: number;
  modelAborted: number;
}

function untilAborted(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

function makeWorkflows(probe: Probe) {
  const doubler = createWorkflow({
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

  const report = createWorkflow({
    id: 'report',
    description: 'Builds a report slowly',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ report: z.string() }),
  })
    .then(
      createStep({
        id: 'build',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ report: z.string() }),
        execute: async ({ inputData }) => {
          probe.slowRuns++;
          await sleep(400);
          return { report: `report on ${inputData.topic}` };
        },
      }),
    )
    .commit();

  // A side-effecting step, then a step that asks who approves.
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
        execute: async ({ inputData }) => {
          probe.prepared++;
          return inputData;
        },
      }),
    )
    .then(
      createStep({
        id: 'ask',
        inputSchema: z.object({ release: z.string() }),
        outputSchema: z.object({ outcome: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ approver: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData) return suspend({ message: `Who approves ${inputData.release}?` });
          return { outcome: `${inputData.release} approved by ${resumeData.approver}` };
        },
      }),
    )
    .commit();

  // No input request can present a nested object, so this suspension can only be resumed elsewhere.
  const opaque = createWorkflow({
    id: 'opaque',
    description: 'Waits for a structured answer',
    inputSchema: z.object({}),
    outputSchema: z.object({ got: z.string() }),
  })
    .then(
      createStep({
        id: 'wait',
        inputSchema: z.object({}),
        outputSchema: z.object({ got: z.string() }),
        resumeSchema: z.object({ nested: z.object({ value: z.string() }) }),
        execute: async ({ resumeData, suspend }) => {
          if (!resumeData) return suspend({});
          return { got: resumeData.nested.value };
        },
      }),
    )
    .commit();

  const boom = createWorkflow({
    id: 'boom',
    description: 'Always fails',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  })
    .then(
      createStep({
        id: 'explode',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => {
          throw new Error('kaboom');
        },
      }),
    )
    .commit();

  const hang = createWorkflow({
    id: 'hang',
    description: 'Runs until cancelled',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  })
    .then(
      createStep({
        id: 'wait',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ abortSignal }) => {
          await untilAborted(abortSignal);
          probe.aborted.push('hang');
          return {};
        },
      }),
    )
    .commit();

  // Two questions in a row, each its own step.
  const question = (id: string) =>
    createStep({
      id,
      inputSchema: z.object({ answers: z.array(z.string()) }),
      outputSchema: z.object({ answers: z.array(z.string()) }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) return suspend({ message: `Answer ${id}` });
        return { answers: [...inputData.answers, `${id}=${resumeData.answer}`] };
      },
    });
  const interview = createWorkflow({
    id: 'interview',
    description: 'Asks two questions',
    inputSchema: z.object({ answers: z.array(z.string()) }),
    outputSchema: z.object({ answers: z.array(z.string()) }),
  })
    .then(question('ask1'))
    .then(question('ask2'))
    .commit();

  // The same step asks again on each pass of a loop.
  const poll = createWorkflow({
    id: 'poll',
    description: 'Asks the same question twice',
    inputSchema: z.object({ answers: z.array(z.string()) }),
    outputSchema: z.object({ answers: z.array(z.string()) }),
  })
    .dountil(question('vote'), async ({ inputData }) => inputData.answers.length >= 2)
    .commit();

  return { doubler, report, approval, opaque, boom, hang, interview, poll };
}

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textAnswer(text: string) {
  return { content: [{ type: 'text' as const, text }], finishReason: 'stop' as const, usage, warnings: [] };
}

function makeAgents(probe: Probe) {
  const researcher = new Agent({
    id: 'researcher',
    name: 'researcher',
    description: 'Researches a question, slowly',
    instructions: 'Research.',
    model: new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        probe.modelCalls++;
        await sleep(300);
        return textAnswer(`findings for: ${JSON.stringify(prompt).includes('tides') ? 'tides' : 'unknown'}`);
      },
    }),
  });
  const ponderer = new Agent({
    id: 'ponderer',
    name: 'ponderer',
    description: 'Thinks until told to stop',
    instructions: 'Think.',
    model: new MockLanguageModelV2({
      doGenerate: async ({ abortSignal }) => {
        await untilAborted(abortSignal!);
        probe.modelAborted++;
        throw abortSignal!.reason ?? new Error('aborted');
      },
    }),
  });
  const broken = new Agent({
    id: 'broken',
    name: 'broken',
    description: 'Its model is down',
    instructions: 'Fail.',
    model: new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('model unavailable');
      },
    }),
  });
  const deleteFiles = createTool({
    id: 'deleteFiles',
    description: 'Deletes files',
    inputSchema: z.object({ path: z.string() }),
    requireApproval: true,
    execute: async () => 'deleted',
  });
  const cautious = new Agent({
    id: 'cautious',
    name: 'cautious',
    description: 'Asks before deleting',
    instructions: 'Delete what you are told.',
    tools: { deleteFiles },
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [
          { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'deleteFiles', input: '{"path":"/tmp/x"}' },
        ],
        finishReason: 'tool-calls' as const,
        usage,
        warnings: [],
      }),
    }),
  });
  return { researcher, ponderer, broken, cautious };
}

// Both stores a server picks on its own: in memory, or Mastra's background tasks. Either way the
// workflows keep their runs in Mastra storage, which resuming a run needs.
describe.each([
  { store: 'in-memory', backgroundTasks: false },
  { store: 'Mastra background tasks', backgroundTasks: true },
])('MCPServer workflow and agent tasks ($store)', ({ backgroundTasks }) => {
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

  async function start(tasks: MCPServerConfig['tasks']) {
    const probe: Probe = { prepared: 0, slowRuns: 0, aborted: [], modelCalls: 0, modelAborted: 0 };
    const workflows = makeWorkflows(probe);
    const server = new MCPServer({
      id: 'tasks',
      name: 'Tasks',
      version: '1.0.0',
      tools: {},
      workflows,
      agents: makeAgents(probe),
      tasks,
    });
    mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      ...(backgroundTasks && { backgroundTasks: { enabled: true } }),
      mcpServers: { tasks: server },
    });
    served = await serveHTTP(server, { auth: req => authFor(String(req.headers['x-test-user'] ?? 'alice')) });
    return { probe, workflows };
  }

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
    for (let i = 0; i < 300; i++) {
      const task = await tasks.get(taskId);
      if (task.status === status) return task;
      await sleep(25);
    }
    throw new Error(`task never reached ${status}`);
  }

  async function onlyRun(workflow: Workflow) {
    const { runs, total } = await workflow.listWorkflowRuns();
    expect(total).toBe(1);
    return (await workflow.getWorkflowRunById(runs[0]!.runId))!;
  }

  const text = (task: MCPDetailedTask) => (task.result as { content: Array<{ text: string }> }).content[0]!.text;

  describe('workflows', () => {
    it("answers an 'auto' workflow that finishes within the window synchronously", async () => {
      await start({ workflows: { doubler: 'auto' } });
      const { result } = await call('run_doubler', { n: 21 });
      expect(result.resultType).not.toBe('task');
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toMatchObject({ status: 'success', result: { doubled: 42 } });
    });

    it("answers an 'auto' run that fails within the window with isError, as its task would, unlike a client without tasks", async () => {
      await start({ workflows: { boom: 'auto' } });
      const { result } = await call('run_boom');
      expect(result.resultType).not.toBe('task');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Workflow 'boom' failed: kaboom");
      // Without the extension the plain run_ tool answers as it always has: the failed run as data.
      const { result: plain } = await call('run_boom', {}, { tasks: false });
      expect(plain.isError).toBe(false);
      expect(JSON.parse(plain.content[0].text)).toMatchObject({ status: 'failed' });
    });

    it.each(['auto', 'always'] as const)(
      "rejects invalid input to an '%s' workflow like the plain tool, without starting a run or task",
      async mode => {
        const { workflows } = await start({ workflows: { approval: mode } });
        const { result } = await call('run_approval', { release: 42 });
        expect(result.resultType).not.toBe('task');
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/release/);
        expect((await workflows.approval.listWorkflowRuns()).total).toBe(0);
      },
    );

    it("continues an 'auto' workflow past its window as a task that completes with the run's result", async () => {
      const { probe, workflows } = await start({ workflows: { report: { mode: 'auto', syncWindowMs: 50 } } });
      const { result } = await call('run_report', { topic: 'tides' });
      expect(result).toMatchObject({ resultType: 'task', status: 'working' });
      const done = await waitFor(await requester(), result.taskId, 'completed');
      expect(done.result).toMatchObject({ isError: false });
      expect(JSON.parse(text(done))).toMatchObject({ status: 'success', result: { report: 'report on tides' } });
      // The run that started under the request is the one the task followed.
      expect(probe.slowRuns).toBe(1);
      expect((await onlyRun(workflows.report)).status).toBe('success');
    });

    it('asks for input when a step suspends and resumes the same run once with the answer', async () => {
      const { probe, workflows } = await start({ workflows: { approval: 'always' } });
      const { result } = await call('run_approval', { release: 'v2' });
      expect(result).toMatchObject({ resultType: 'task' });
      const tasks = await requester();
      const waiting = await waitFor(tasks, result.taskId, 'input_required');
      const [[key, request]] = Object.entries(waiting.inputRequests ?? {}) as [string, any][];
      expect(request).toMatchObject({
        method: 'elicitation/create',
        params: {
          message: 'Who approves v2?',
          requestedSchema: { type: 'object', properties: { approver: { type: 'string' } } },
        },
      });

      await tasks.update(result.taskId, { [key]: { action: 'accept', content: { approver: 'bob' } } });
      const done = await waitFor(tasks, result.taskId, 'completed');
      expect(JSON.parse(text(done))).toMatchObject({ status: 'success', result: { outcome: 'v2 approved by bob' } });

      const run = await onlyRun(workflows.approval);
      expect(run.status).toBe('success');
      expect(probe.prepared).toBe(1);
      // The run id stays server-side: a task id is unguessable, a run id is listable.
      expect(run.runId).not.toBe(result.taskId);
      expect(JSON.stringify(done)).not.toContain(run.runId);
    });

    it('asks the next question when an answer arrives for a step already resumed elsewhere', async () => {
      const { workflows } = await start({ workflows: { interview: 'always' } });
      const { result } = await call('run_interview', { answers: [] });
      const tasks = await requester();
      const first = await waitFor(tasks, result.taskId, 'input_required');
      const [staleKey] = Object.keys(first.inputRequests ?? {});
      // Someone answers ask1 in Studio, so the run moves on and suspends on ask2.
      const { runs } = await workflows.interview.listWorkflowRuns();
      const run = await workflows.interview.createRun({ runId: runs[0]!.runId });
      await run.resume({ step: 'ask1', resumeData: { answer: 'studio' } });
      expect((await onlyRun(workflows.interview)).status).toBe('suspended');

      // The client's answer to ask1 is stale: the task asks ask2 instead of failing.
      await tasks.update(result.taskId, { [staleKey!]: { action: 'accept', content: { answer: 'client' } } });
      const second = await waitFor(tasks, result.taskId, 'input_required');
      const [[key, request]] = Object.entries(second.inputRequests ?? {}) as [string, any][];
      expect(key).not.toBe(staleKey);
      expect(request.params.message).toBe('Answer ask2');
      const waiting = await onlyRun(workflows.interview);
      expect(waiting.status).toBe('suspended');
      expect(waiting.steps.ask2).toMatchObject({ status: 'suspended' });

      await tasks.update(result.taskId, { [key]: { action: 'accept', content: { answer: 'client' } } });
      const done = await waitFor(tasks, result.taskId, 'completed');
      expect(JSON.parse(text(done))).toMatchObject({
        status: 'success',
        result: { answers: ['ask1=studio', 'ask2=client'] },
      });
    });

    it('asks the next question when the run is resumed elsewhere between the check and the resume', async () => {
      const { workflows } = await start({ workflows: { interview: 'always' } });
      const { result } = await call('run_interview', { answers: [] });
      const tasks = await requester();
      const first = await waitFor(tasks, result.taskId, 'input_required');
      const [staleKey] = Object.keys(first.inputRequests ?? {});
      const { runs } = await workflows.interview.listWorkflowRuns();
      const before = await workflows.interview.getWorkflowRunById(runs[0]!.runId, { withNestedWorkflows: false });
      await (
        await workflows.interview.createRun({ runId: runs[0]!.runId })
      ).resume({
        step: 'ask1',
        resumeData: { answer: 'studio' },
      });
      // The task's check still sees ask1 waiting, as if the outside resume landed just after it.
      const read = vi.spyOn(workflows.interview, 'getWorkflowRunById').mockResolvedValueOnce(before);

      await tasks.update(result.taskId, { [staleKey!]: { action: 'accept', content: { answer: 'client' } } });
      const second = await waitFor(tasks, result.taskId, 'input_required');
      expect(read).toHaveBeenCalled();
      const [[key, request]] = Object.entries(second.inputRequests ?? {}) as [string, any][];
      expect(key).not.toBe(staleKey);
      expect(request.params.message).toBe('Answer ask2');
      read.mockRestore();

      await tasks.update(result.taskId, { [key]: { action: 'accept', content: { answer: 'client' } } });
      const done = await waitFor(tasks, result.taskId, 'completed');
      expect(JSON.parse(text(done))).toMatchObject({ result: { answers: ['ask1=studio', 'ask2=client'] } });
    });

    it('asks again, rather than answering it, when the same step suspends again after a resume elsewhere', async () => {
      const { workflows } = await start({ workflows: { poll: 'always' } });
      const { result } = await call('run_poll', { answers: [] });
      const tasks = await requester();
      const first = await waitFor(tasks, result.taskId, 'input_required');
      const [staleKey] = Object.keys(first.inputRequests ?? {});
      const { runs } = await workflows.poll.listWorkflowRuns();
      await (
        await workflows.poll.createRun({ runId: runs[0]!.runId })
      ).resume({
        step: 'vote',
        resumeData: { answer: 'studio' },
      });
      expect((await onlyRun(workflows.poll)).status).toBe('suspended');

      await tasks.update(result.taskId, { [staleKey!]: { action: 'accept', content: { answer: 'stale' } } });
      const second = await waitFor(tasks, result.taskId, 'input_required');
      const [key] = Object.keys(second.inputRequests ?? {});
      expect(key).not.toBe(staleKey);
      await tasks.update(result.taskId, { [key!]: { action: 'accept', content: { answer: 'client' } } });
      const done = await waitFor(tasks, result.taskId, 'completed');
      expect(JSON.parse(text(done))).toMatchObject({
        status: 'success',
        result: { answers: ['vote=studio', 'vote=client'] },
      });
    });

    it('completes with isError and cancels the run when the client declines', async () => {
      const { workflows } = await start({ workflows: { approval: 'always' } });
      const { result } = await call('run_approval', { release: 'v3' });
      const tasks = await requester();
      const waiting = await waitFor(tasks, result.taskId, 'input_required');
      const [key] = Object.keys(waiting.inputRequests ?? {});
      await tasks.update(result.taskId, { [key!]: { action: 'decline' } });
      const done = await waitFor(tasks, result.taskId, 'completed');
      expect(done.result).toMatchObject({ isError: true });
      expect(text(done)).toContain("Workflow 'approval' was declined");
      expect((await onlyRun(workflows.approval)).status).toBe('canceled');
    });

    it('cancels a running run on tasks/cancel', async () => {
      const { probe, workflows } = await start({ workflows: { hang: 'always' } });
      const { result } = await call('run_hang');
      const tasks = await requester();
      await vi.waitFor(async () => expect((await onlyRun(workflows.hang)).status).toBe('running'));
      await tasks.cancel(result.taskId);
      expect((await tasks.get(result.taskId)).status).toBe('cancelled');
      await vi.waitFor(() => expect(probe.aborted).toEqual(['hang']));
      await vi.waitFor(async () => expect((await onlyRun(workflows.hang)).status).toBe('canceled'));
    });

    it('cancels a run waiting for input on tasks/cancel, though no attempt is running', async () => {
      const { workflows } = await start({ workflows: { approval: 'always' } });
      const { result } = await call('run_approval', { release: 'v4' });
      const tasks = await requester();
      await waitFor(tasks, result.taskId, 'input_required');
      expect((await onlyRun(workflows.approval)).status).toBe('suspended');
      await tasks.cancel(result.taskId);
      expect((await tasks.get(result.taskId)).status).toBe('cancelled');
      await vi.waitFor(async () => expect((await onlyRun(workflows.approval)).status).toBe('canceled'));
    });

    it('completes with isError when the run fails', async () => {
      await start({ workflows: { boom: 'always' } });
      const { result } = await call('run_boom');
      const done = await waitFor(await requester(), result.taskId, 'completed');
      expect(done.result).toMatchObject({ isError: true });
      expect(text(done)).toContain("Workflow 'boom' failed: kaboom");
    });

    it("answers another principal's tasks/get and tasks/cancel as an unknown task, and leaves the run alone", async () => {
      const { workflows } = await start({ workflows: { approval: 'always' } });
      const { result } = await call('run_approval', { release: 'v5' });
      await waitFor(await requester(), result.taskId, 'input_required');
      const mallory = await requester('mallory');
      await expect(mallory.get(result.taskId)).rejects.toMatchObject({ code: -32602 });
      await expect(mallory.cancel(result.taskId)).rejects.toMatchObject({ code: -32602 });
      expect((await onlyRun(workflows.approval)).status).toBe('suspended');
    });

    it('stays working on a suspension no input request can present, and follows a resume made elsewhere', async () => {
      const { workflows } = await start({ workflows: { opaque: 'always' } });
      const { result } = await call('run_opaque');
      const tasks = await requester();
      await vi.waitFor(async () => expect((await onlyRun(workflows.opaque)).status).toBe('suspended'));
      await sleep(1_200);
      expect((await tasks.get(result.taskId)).status).toBe('working');

      // E.g. from Studio or the workflows API.
      const { runId } = await onlyRun(workflows.opaque);
      const run = await workflows.opaque.createRun({ runId });
      await run.resume({ step: 'wait', resumeData: { nested: { value: 'from studio' } } });
      const done = await waitFor(tasks, result.taskId, 'completed');
      expect(JSON.parse(text(done))).toMatchObject({ status: 'success', result: { got: 'from studio' } });
    });

    it('answers synchronously, as before, for a client without the extension; refuses with -32021 when required', async () => {
      await start({ workflows: { doubler: 'always', report: 'always' }, required: ['run_report'] });
      const sync = await call('run_doubler', { n: 2 }, { tasks: false });
      expect(sync.result.resultType).not.toBe('task');
      expect(JSON.parse(sync.result.content[0].text)).toMatchObject({ status: 'success', result: { doubled: 4 } });
      expect((await call('run_report', { topic: 'x' }, { tasks: false })).error).toMatchObject({ code: -32021 });
    });

    it('serves every workflow as a task by tasks.default, unless it is listed as off', async () => {
      await start({ default: 'always', workflows: { doubler: 'off' } });
      expect((await call('run_doubler', { n: 1 })).result.resultType).not.toBe('task');
      expect((await call('run_report', { topic: 'x' })).result.resultType).toBe('task');
    });
  });

  describe('agents', () => {
    it("continues an 'auto' agent past its window as a task that completes with its answer", async () => {
      const { probe } = await start({ agents: { researcher: { mode: 'auto', syncWindowMs: 50 } } });
      const { result } = await call('ask_researcher', { message: 'How do tides work?' });
      expect(result).toMatchObject({ resultType: 'task', status: 'working' });
      const done = await waitFor(await requester(), result.taskId, 'completed');
      expect(done.result).toMatchObject({ isError: false });
      expect(text(done)).toContain('findings for: tides');
      expect(probe.modelCalls).toBe(1);
    });

    it('aborts the model call on tasks/cancel', async () => {
      const { probe } = await start({ agents: { ponderer: 'always' } });
      const { result } = await call('ask_ponderer', { message: 'Think hard' });
      const tasks = await requester();
      await sleep(100);
      await tasks.cancel(result.taskId);
      expect((await tasks.get(result.taskId)).status).toBe('cancelled');
      await vi.waitFor(() => expect(probe.modelAborted).toBe(1));
    });

    it('completes with isError when the model fails', async () => {
      await start({ agents: { broken: 'always' } });
      const { result } = await call('ask_broken', { message: 'Hi' });
      const done = await waitFor(await requester(), result.taskId, 'completed');
      expect(done.result).toMatchObject({ isError: true });
      expect(text(done)).toContain('model unavailable');
    });

    it('completes with isError when the agent pauses for tool approval', async () => {
      await start({ agents: { cautious: 'always' } });
      const { result } = await call('ask_cautious', { message: 'Delete /tmp/x' });
      const done = await waitFor(await requester(), result.taskId, 'completed');
      expect(done.result).toMatchObject({ isError: true });
      expect(text(done)).toBe("Agent 'cautious' paused for tool approval or input, which MCP tasks don't support yet");
    });
  });

  it('rejects task configs naming workflows or agents the server does not serve', () => {
    const make = (tasks: unknown) => () =>
      new MCPServer({
        name: 'Bad',
        version: '1.0.0',
        tools: {},
        workflows: makeWorkflows({ prepared: 0, slowRuns: 0, aborted: [], modelCalls: 0, modelAborted: 0 }),
        tasks: tasks as MCPServerConfig['tasks'],
      });
    expect(make({ workflows: { nope: 'always' } })).toThrow(/tasks.workflows names "nope"/);
    expect(make({ agents: { nope: 'always' } })).toThrow(/tasks.agents names "nope"/);
    expect(make({ workflows: { doubler: { mode: 'always', recover: true } } })).toThrow(
      /recover is not a workflow option/,
    );
    expect(make({ workflows: { doubler: 'off' }, required: ['run_doubler'] })).toThrow(/not served as a task/);
    expect(make({ required: ['doubler'] })).toThrow(/not one of this server's tools/);
  });

  it('rejects task configs for a workflow or agent that a same-named tool hides', () => {
    const probe = { prepared: 0, slowRuns: 0, aborted: [], modelCalls: 0, modelAborted: 0 };
    const tool = createTool({ id: 'taken', description: 'Takes the name', execute: async () => 'tool' });
    const make = (tasks: MCPServerConfig['tasks']) => () =>
      new MCPServer({
        name: 'Hidden',
        version: '1.0.0',
        tools: { run_doubler: tool, ask_researcher: tool },
        workflows: makeWorkflows(probe),
        agents: makeAgents(probe),
        tasks,
      });
    expect(make({ workflows: { doubler: 'always' } })).toThrow(/hidden by the tool "run_doubler"/);
    expect(make({ agents: { researcher: 'always' } })).toThrow(/hidden by the tool "ask_researcher"/);
    // The tool itself can be a task.
    expect(make({ tools: { run_doubler: 'always' } })).not.toThrow();
  });
});
