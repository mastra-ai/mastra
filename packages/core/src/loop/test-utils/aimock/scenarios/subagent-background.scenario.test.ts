import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTestSession } from '../../../../agent-controller/test-utils';
import type { AgentControllerEvent, AgentControllerSubagent } from '../../../../agent-controller/types';
import type { BackgroundTask } from '../../../../background-tasks';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { scenarioModel } from '../network-fixtures';

const COUNT_INSTRUCTIONS = 'Count the files in the project.';
const WAIT_INSTRUCTIONS = 'Wait for the deploy to finish.';
const READ_INSTRUCTIONS = 'Read every file in the project.';

type Disposition = 'deferred' | 'awaited';

function delegate(agentType: string, disposition: Disposition = 'deferred') {
  return {
    toolCalls: [
      { id: 'delegate', name: 'subagent', arguments: { agentType, task: 'Do it.', _background: { disposition } } },
    ],
  };
}

function toolMessages(requests: Array<{ body?: unknown }>, toolCallId: string) {
  return requests
    .flatMap(request => (request.body as { messages?: any[] })?.messages ?? [])
    .filter(message => message.role === 'tool' && message.tool_call_id === toolCallId);
}

describeForAllEngines('A backgrounded AgentController subagent', engine => {
  const getMock = useLoopScenarioAimock();

  async function setup({ timeoutMs }: { timeoutMs?: number } = {}) {
    const llm = getMock();
    let releaseCount!: () => void;
    const countReleased = new Promise<void>(resolve => (releaseCount = resolve));
    const wait = { started: false, aborted: false };

    const subagents: AgentControllerSubagent[] = [
      {
        id: 'counter',
        name: 'Counter',
        description: 'Counts files',
        instructions: COUNT_INSTRUCTIONS,
        defaultModelId: 'mock',
        tools: {
          count_files: createTool({
            id: 'count_files',
            description: 'Count the files',
            inputSchema: z.object({}),
            // Eligible for background on its own, to show a background subagent still runs it inline.
            background: { enabled: true },
            // Held until the parent's turn ends, so the subagent is still running when the parent continues.
            execute: async () => {
              await countReleased;
              return { count: 7 };
            },
          }),
        },
      },
      {
        id: 'waiter',
        name: 'Waiter',
        description: 'Waits for a deploy',
        instructions: WAIT_INSTRUCTIONS,
        defaultModelId: 'mock',
        tools: {
          wait_for_deploy: createTool({
            id: 'wait_for_deploy',
            description: 'Wait for the deploy to finish',
            inputSchema: z.object({}),
            // Never finishes on its own; only the subagent's abort signal ends it.
            execute: async (_input, context) =>
              new Promise((_resolve, reject) => {
                wait.started = true;
                context?.abortSignal?.addEventListener('abort', () => {
                  wait.aborted = true;
                  reject(context.abortSignal!.reason);
                });
              }),
          }),
        },
      },
      {
        id: 'reader',
        name: 'Reader',
        description: 'Reads files',
        instructions: READ_INSTRUCTIONS,
        defaultModelId: 'mock',
        maxSteps: 2,
        tools: {
          read_file: createTool({
            id: 'read_file',
            description: 'Read a file',
            inputSchema: z.object({}),
            execute: async () => ({ content: 'file contents' }),
          }),
        },
      },
    ];

    // A parent tool that keeps the parent run busy until the run is aborted.
    const hold = { started: false, aborted: false };
    const holdTool = createTool({
      id: 'hold',
      description: 'Hold until the user stops the run',
      inputSchema: z.object({}),
      execute: async (_input, context) =>
        new Promise((_resolve, reject) => {
          hold.started = true;
          context?.abortSignal?.addEventListener('abort', () => {
            hold.aborted = true;
            reject(context.abortSignal!.reason);
          });
        }),
    });

    const completed: BackgroundTask[] = [];
    const failed: BackgroundTask[] = [];
    const cancelled: BackgroundTask[] = [];
    const { agent } = await createSharedAgent(llm, { engine });
    const { controller, session } = await createTestSession({
      agent,
      tools: { hold: holdTool },
      subagents,
      resolveSubagentModel: () => scenarioModel(llm),
      subagentBackground: { enabled: true, defaultDisposition: 'foreground', ...(timeoutMs ? { timeoutMs } : {}) },
      backgroundTasks: {
        enabled: true,
        notifyAgentOnFinish: false,
        onTaskComplete: task => void completed.push(task),
        onTaskFailed: task => void failed.push(task),
        onTaskCancelled: task => void cancelled.push(task),
      },
    });
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => void events.push(event));
    await session.permissions.setForTool({ toolName: 'subagent', policy: 'allow' });
    await session.permissions.setForTool({ toolName: 'hold', policy: 'allow' });
    return { llm, controller, session, events, completed, failed, cancelled, releaseCount, wait, hold };
  }

  /** Scripts a waiter subagent that blocks in its tool, plus the parent's delegation and follow-up turns. */
  function scriptWaiter(llm: ReturnType<typeof getMock>, disposition: Disposition = 'deferred') {
    llm.on(
      { endpoint: 'chat', systemMessage: WAIT_INSTRUCTIONS },
      { toolCalls: [{ id: 'wait', name: 'wait_for_deploy', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: false }, delegate('waiter', disposition));
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Waiting in the background.' });
  }

  it('lets the parent continue while the subagent runs, then delivers its answer', async () => {
    const { llm, controller, session, events, completed, releaseCount } = await setup();
    // Subagent fixtures first: the parent matchers below would also match its requests.
    llm.on(
      { endpoint: 'chat', systemMessage: COUNT_INSTRUCTIONS, hasToolResult: false },
      {
        toolCalls: [{ id: 'count', name: 'count_files', arguments: { _background: { disposition: 'deferred' } } }],
      },
    );
    llm.on(
      { endpoint: 'chat', systemMessage: COUNT_INSTRUCTIONS, hasToolResult: true },
      { content: 'There are 7 files.' },
    );
    llm.on({ endpoint: 'chat', hasToolResult: false }, delegate('counter'));
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Counting in the background.' });

    try {
      await session.sendMessage({ content: 'How many files are there?' });

      // The parent's turn ended on the placeholder while the subagent was still working.
      const parentToolResults = toolMessages(llm.getRequests(), 'delegate');
      expect(parentToolResults).toHaveLength(1);
      expect(JSON.stringify(parentToolResults[0].content)).toContain('Background task started');
      expect(completed).toHaveLength(0);

      releaseCount();
      await vi.waitFor(() => expect(completed).toHaveLength(1), { timeout: 10_000 });

      expect(completed[0]).toMatchObject({
        toolName: 'subagent',
        status: 'completed',
        result: { content: 'There are 7 files.', isError: false },
      });
      // The subagent ran its own eligible tool inline even though the model asked to defer it.
      const countResults = toolMessages(llm.getRequests(), 'count');
      expect(countResults).toHaveLength(1);
      expect(JSON.stringify(countResults[0].content)).toContain('7');
      expect(JSON.stringify(countResults[0].content)).not.toContain('Background task started');
      // The session still receives the subagent's live events after the parent's run ended.
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'subagent_end', result: 'There are 7 files.', isError: false }),
      );
    } finally {
      releaseCount();
      await controller.destroy();
    }
  });

  it('stops the subagent and ends the task timed out when it runs past its timeout', async () => {
    const { llm, controller, session, completed, failed, wait } = await setup({ timeoutMs: 1_000 });
    scriptWaiter(llm);

    try {
      await session.sendMessage({ content: 'Wait for the deploy.' });
      await vi.waitFor(() => expect(failed).toHaveLength(1), { timeout: 10_000 });

      expect(failed[0]).toMatchObject({ toolName: 'subagent', status: 'timed_out' });
      expect(wait.aborted).toBe(true);
      expect(completed).toHaveLength(0);
    } finally {
      await controller.destroy();
    }
  });

  it('stops the subagent and ends the task cancelled when the task is cancelled', async () => {
    const { llm, controller, session, events, completed, cancelled, wait } = await setup();
    scriptWaiter(llm);

    try {
      await session.sendMessage({ content: 'Wait for the deploy.' });
      await vi.waitFor(() => expect(wait.started).toBe(true), { timeout: 10_000 });

      const manager = controller.getMastra()!.backgroundTaskManager!;
      const { tasks } = await manager.listTasks({ status: 'running' });
      expect(tasks).toHaveLength(1);
      await manager.cancel(tasks[0]!.id);

      await vi.waitFor(() => expect(wait.aborted).toBe(true), { timeout: 10_000 });
      await vi.waitFor(() =>
        expect(events).toContainEqual(expect.objectContaining({ type: 'subagent_end', isError: true })),
      );
      expect(cancelled).toHaveLength(1);
      expect(await manager.getTask(tasks[0]!.id)).toMatchObject({ status: 'cancelled' });
      expect(completed).toHaveLength(0);
    } finally {
      await controller.destroy();
    }
  });

  it('stops an awaited subagent and cancels its task when the parent run is aborted', async () => {
    const { llm, controller, session, completed, failed, cancelled, wait } = await setup();
    scriptWaiter(llm, 'awaited');

    try {
      const sending = session.sendMessage({ content: 'Wait for the deploy.' }).catch(() => {});
      await vi.waitFor(() => expect(wait.started).toBe(true), { timeout: 10_000 });

      session.abort();
      await sending;

      await vi.waitFor(() => expect(wait.aborted).toBe(true), { timeout: 10_000 });
      await vi.waitFor(() => expect(cancelled).toHaveLength(1), { timeout: 10_000 });
      expect(cancelled[0]).toMatchObject({ toolName: 'subagent', status: 'cancelled' });
      const manager = controller.getMastra()!.backgroundTaskManager!;
      expect(await manager.getTask(cancelled[0]!.id)).toMatchObject({ status: 'cancelled' });
      expect(failed).toHaveLength(0);
      expect(completed).toHaveLength(0);
    } finally {
      await controller.destroy();
    }
  });

  it('keeps a deferred subagent running when the parent run is aborted after the placeholder', async () => {
    const { llm, controller, session, wait, hold } = await setup();
    llm.on(
      { endpoint: 'chat', systemMessage: WAIT_INSTRUCTIONS },
      { toolCalls: [{ id: 'wait', name: 'wait_for_deploy', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: false }, delegate('waiter'));
    // The parent continues on the placeholder and starts its own long tool call.
    llm.on(
      { endpoint: 'chat', toolCallId: 'delegate', hasToolResult: true },
      { toolCalls: [{ id: 'hold', name: 'hold', arguments: {} }] },
    );

    try {
      const sending = session.sendMessage({ content: 'Wait for the deploy.' }).catch(() => {});
      await vi.waitFor(() => expect(wait.started && hold.started).toBe(true), { timeout: 10_000 });

      session.abort();
      await sending;
      await vi.waitFor(() => expect(hold.aborted).toBe(true), { timeout: 10_000 });

      const manager = controller.getMastra()!.backgroundTaskManager!;
      const { tasks } = await manager.listTasks({ status: 'running' });
      expect(tasks).toMatchObject([{ toolName: 'subagent', status: 'running' }]);
      expect(wait.aborted).toBe(false);

      await manager.cancel(tasks[0]!.id);
      await vi.waitFor(() => expect(wait.aborted).toBe(true), { timeout: 10_000 });
    } finally {
      await controller.destroy();
    }
  });

  it('labels the text a subagent wrote before hitting its step limit as partial output', async () => {
    const { llm, controller, session, events } = await setup();
    llm.on(
      { endpoint: 'chat', systemMessage: READ_INSTRUCTIONS },
      { content: 'Reading the next file.', toolCalls: [{ id: 'read', name: 'read_file', arguments: {} }] },
    );
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'delegate', name: 'subagent', arguments: { agentType: 'reader', task: 'Do it.' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The reader stopped early.' });

    try {
      await session.sendMessage({ content: 'Read the project.' });

      const expected =
        '[Stopped at the 2-step limit before a final answer]\n\nPartial output:\nReading the next file.Reading the next file.';
      const parentToolResults = toolMessages(llm.getRequests(), 'delegate');
      expect(parentToolResults).toHaveLength(1);
      expect(JSON.parse(parentToolResults[0].content)).toEqual({ content: expected, isError: false });
      expect(events).toContainEqual(expect.objectContaining({ type: 'subagent_end', result: expected }));
    } finally {
      await controller.destroy();
    }
  });
});
