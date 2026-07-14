import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundTask } from '../../background-tasks';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Regression test for background tasks in library mode.
 *
 * When Mastra is used as a library (`new Mastra(...)` without `mastra start`),
 * nothing calls `startWorkers()`. A dispatched background task — whether a
 * backgrounded sub-agent delegation or a direct `createBackgroundTask()` — would
 * be picked up (status `running`) but never complete, because the workers that
 * drive execution to completion were never started.
 *
 * The fix lazily starts workers in `BackgroundTaskManager.dispatch()`/`resume()`,
 * the choke points every producer goes through (enqueue, stale-task recovery,
 * restart, resume), so dispatched tasks complete without the user ever calling
 * `startWorkers()` themselves.
 */
describe('background tasks in library mode (no explicit startWorkers)', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.backgroundTaskManager?.shutdown();
    await mastra?.stopWorkers();
    mastra = undefined;
  });

  function supervisorModel() {
    let call = 0;
    return new MockLanguageModelV2({
      doStream: async () => {
        call++;
        if (call === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 's1', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'agent-helper',
                input: JSON.stringify({ prompt: 'hi' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 's2', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
  }

  function makeSubAgent() {
    return new Agent({
      id: 'helper',
      name: 'helper',
      description: 'A helper sub-agent.',
      instructions: 'Say hello.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'a1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 'x' },
            { type: 'text-delta', id: 'x', delta: 'Hello from the sub-agent.' },
            { type: 'text-end', id: 'x' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
    });
  }

  it('runs a backgrounded sub-agent delegation to completion', async () => {
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate to the helper sub-agent.',
      model: supervisorModel(),
      agents: { helper: makeSubAgent() },
      // Opt the delegation into background dispatch.
      backgroundTasks: { tools: { helper: { enabled: true } } },
    });

    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      agents: { supervisor },
    });

    const manager = mastra.backgroundTaskManager;
    expect(manager).toBeDefined();

    const stream = await supervisor.stream('Please delegate.', { maxSteps: 3 });
    for await (const _ of stream.fullStream) {
      // drain
    }

    // The dispatched task must reach a terminal state without anyone calling
    // startWorkers(). Before the fix it stayed `running` forever.
    let status: string | undefined;
    for (let i = 0; i < 50; i++) {
      const { tasks } = await manager!.listTasks({});
      status = tasks[0]?.status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(status).toBe('completed');
  }, 15000);

  it('runs a directly-enqueued task to completion', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
    });

    const manager = mastra.backgroundTaskManager;
    expect(manager).toBeDefined();

    // Direct producer: no agent involved, so the fix must live in the
    // manager's dispatch choke point rather than the agent execution path.
    const bgTask = createBackgroundTask(manager!, {
      toolName: 'my-tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'a1',
      runId: 'r1',
      context: { executor: { execute: async () => ({ data: 'hello' }) } },
    });
    await bgTask.dispatch();

    let status: string | undefined;
    for (let i = 0; i < 50; i++) {
      const { tasks } = await manager!.listTasks({});
      status = tasks[0]?.status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(status).toBe('completed');
  }, 15000);

  it('runs a stale task recovered on restart to completion', async () => {
    const store = new MockStore();

    // Simulate a previous process that died with a pending task on disk.
    const bgStore = await store.getStore('backgroundTasks');
    await bgStore!.createTask({
      id: 'stale-1',
      status: 'pending',
      toolName: 'my-tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'a1',
      runId: 'r1',
      retryCount: 0,
      maxRetries: 0,
      timeoutMs: 30_000,
      createdAt: new Date(),
    });

    // "Restart": the constructor fires manager init, whose stale-task
    // recovery re-dispatches the pending task via dispatch() — bypassing
    // enqueue(). Before the fix moved to dispatch(), the recovered task
    // stayed `running` forever because no workers were started.
    mastra = new Mastra({ logger: false, storage: store, backgroundTasks: { enabled: true } });
    const manager = mastra.backgroundTaskManager!;
    // The original closure executor is gone after a restart; the static
    // registry (normally populated from Mastra-registered tools) drives it.
    manager.registerStaticExecutor('my-tool', { execute: async () => ({ data: 'recovered' }) });

    let status: string | undefined;
    for (let i = 0; i < 50; i++) {
      const { tasks } = await manager.listTasks({});
      status = tasks[0]?.status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(status).toBe('completed');
  }, 15000);

  it('starts workers only once for concurrent first dispatches', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
    });

    const manager = mastra.backgroundTaskManager!;
    const startSpy = vi.spyOn(mastra, '__startBackgroundTaskWorkers');

    // Two producers dispatch at the same time on a cold instance (e.g. two
    // simultaneous requests hitting an Express app). The single-flight guard
    // must funnel both through one worker-start run.
    const makeTask = (n: number) =>
      createBackgroundTask(manager, {
        toolName: `my-tool-${n}`,
        toolCallId: `call-${n}`,
        args: {},
        agentId: 'a1',
        runId: `r${n}`,
        context: { executor: { execute: async () => ({ data: `hello-${n}` }) } },
      });
    await Promise.all([makeTask(1).dispatch(), makeTask(2).dispatch()]);

    expect(startSpy).toHaveBeenCalledTimes(1);

    let statuses: string[] = [];
    for (let i = 0; i < 50; i++) {
      const { tasks } = await manager.listTasks({});
      statuses = tasks.map(t => t.status);
      if (statuses.length === 2 && statuses.every(s => s === 'completed' || s === 'failed')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(statuses).toEqual(['completed', 'completed']);
  }, 15000);

  it('does not start the scheduler as a side effect of a dispatch', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      // Scheduler explicitly enabled: the lazy start must still only boot the
      // background-task execution machinery, never the scheduler tick loop —
      // otherwise a library-mode process would silently begin running
      // scheduled jobs just because it dispatched a background task.
      scheduler: { enabled: true },
    });

    const manager = mastra.backgroundTaskManager!;
    const bgTask = createBackgroundTask(manager, {
      toolName: 'my-tool',
      toolCallId: 'call-1',
      args: {},
      agentId: 'a1',
      runId: 'r1',
      context: { executor: { execute: async () => ({ data: 'hello' }) } },
    });
    await bgTask.dispatch();

    let status: string | undefined;
    for (let i = 0; i < 50; i++) {
      const { tasks } = await manager.listTasks({});
      status = tasks[0]?.status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(status).toBe('completed');
    expect(mastra.scheduler).toBeUndefined();
  }, 15000);

  it('restarts workers for a dispatch after stopWorkers()', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
    });

    const manager = mastra.backgroundTaskManager!;
    const makeTask = (n: number) =>
      createBackgroundTask(manager, {
        toolName: `my-tool-${n}`,
        toolCallId: `call-${n}`,
        args: {},
        agentId: 'a1',
        runId: `r${n}`,
        context: { executor: { execute: async () => ({ data: `hello-${n}` }) } },
      });

    const waitForAllTerminal = async (count: number) => {
      let statuses: string[] = [];
      for (let i = 0; i < 50; i++) {
        const { tasks } = await manager.listTasks({});
        statuses = tasks.map(t => t.status);
        if (statuses.length === count && statuses.every(s => s === 'completed' || s === 'failed')) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return statuses;
    };

    await makeTask(1).dispatch();
    expect(await waitForAllTerminal(1)).toEqual(['completed']);

    // Stopping workers must reset the lazy-start guard: a later dispatch on
    // the same instance has to boot the execution workers again, or it gets
    // picked up but hangs in `running` forever.
    await mastra.stopWorkers();

    await makeTask(2).dispatch();
    expect(await waitForAllTerminal(2)).toEqual(['completed', 'completed']);
  }, 20000);
});
