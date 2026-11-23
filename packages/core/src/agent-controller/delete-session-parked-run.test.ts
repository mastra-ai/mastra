import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

vi.setConfig({ testTimeout: 30_000 });
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

// When set, a resumed tool call waits on it before answering, so the run is stored as running meanwhile.
let resumedToolGate: (() => Promise<void>) | undefined;
// When set, the model call after a resumed tool call throws, so the resume fails.
let failModelAfterTool = false;

async function setup({
  storageVersion,
  shouldPersistSnapshot,
}: { storageVersion?: 1 | 2; shouldPersistSnapshot?: () => boolean } = {}) {
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      if (failModelAfterTool && prompt.some(message => message.role === 'tool')) throw new Error('model failed');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        // Asks once; after the tool's result it answers, so a resumed run finishes.
        stream: convertArrayToReadableStream<any>(
          prompt.some(message => message.role === 'tool')
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: `call-${Math.random()}`, toolName: 'ask', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ],
        ),
      };
    },
  });
  const ask = createTool({
    id: 'ask',
    description: 'suspends until answered',
    inputSchema: z.object({}),
    suspendSchema: z.object({ q: z.string() }),
    resumeSchema: z.object({ a: z.string() }),
    // Answering 'again' parks the run once more; 'fail' throws.
    execute: async (_input, ctx) => {
      const answer = (ctx?.agent?.resumeData as { a: string } | undefined)?.a;
      if (answer) await resumedToolGate?.();
      if (answer === 'fail') throw new Error('tool failed');
      return answer && answer !== 'again' ? 'ok' : ctx?.agent?.suspend?.({ q: '?' });
    },
  });
  const storage = new InMemoryStore();
  const agent = createDurableAgent({
    agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: model as any, tools: { ask } }),
    // Long enough that no cleanup timer frees the run during the test.
    cleanupTimeoutMs: 60_000,
    storageVersion,
    shouldPersistSnapshot,
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'c',
    agent: agent as any,
    memory: new MockMemory({ storage: new InMemoryStore() }),
    initialState: { yolo: true } as any,
    modes: [{ id: 'default', name: 'Default', default: true }],
  } as any);
  new Mastra({ storage, logger: false, agents: { a: agent }, agentControllers: { c: controller } } as any);
  await controller.init();
  return { agent, controller, storage };
}

async function park(controller: AgentController, i: number) {
  const session = await controller.createSession({
    id: `s-${i}`,
    ownerId: 'o',
    resourceId: `r-${i}`,
    threadId: `t-${i}`,
  });
  void session.sendMessage({ content: 'go' }).catch(() => {});
  await vi.waitFor(() => expect(session.suspensions.hasPending()).toBe(true), { timeout: 10_000 });
  return session;
}

function collectErrors(session: Awaited<ReturnType<typeof park>>) {
  const errors: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });
  return errors;
}

describe('deleteSession with a parked suspension (#30743)', () => {
  it('releases the parked run from memory', async () => {
    const { agent, controller, storage } = await setup();
    const releaseParkedRun = vi.spyOn(agent, 'releaseParkedRun');
    for (let i = 0; i < 3; i++) {
      await park(controller, i);
      await controller.deleteSession({ sessionId: `s-${i}` });
    }

    // Deleting the session denies the parked calls, then drops each run and its snapshot.
    expect(releaseParkedRun).toHaveBeenCalledTimes(3);
    const runIds = releaseParkedRun.mock.calls.map(([runId]) => runId);
    const { runs } = await (await storage.getStore('workflows'))!.listWorkflowRuns({});
    expect(runs).toHaveLength(0);
    for (const result of releaseParkedRun.mock.results) expect(await result.value).toBe(true);
    expect(agent.runRegistry.size).toBe(0);
    expect(agent.getWorkflow().runs.size).toBe(0);
    for (const runId of runIds) expect(globalRunRegistry.get(runId)).toBeUndefined();
  });

  it('still deletes the snapshot when releasing the run from memory fails', async () => {
    const { agent, controller, storage } = await setup();
    vi.spyOn(agent, 'releaseParkedRun').mockRejectedValue(new Error('release failed'));
    const session = await park(controller, 0);
    const errors = collectErrors(session);
    await controller.deleteSession({ sessionId: 's-0' });

    expect(errors).toEqual(['release failed']);
    const { runs } = await (await storage.getStore('workflows'))!.listWorkflowRuns({});
    expect(runs).toHaveLength(0);
  });

  it('reports a failed snapshot read instead of treating it as nothing to release', async () => {
    const { agent, controller, storage } = await setup();
    const session = await park(controller, 0);
    const errors = collectErrors(session);
    vi.spyOn((agent as any).executionEngine, 'loadRunSnapshot').mockRejectedValue(new Error('snapshot read failed'));
    await controller.deleteSession({ sessionId: 's-0' });

    expect(errors).toEqual(['snapshot read failed']);
    const { runs } = await (await storage.getStore('workflows'))!.listWorkflowRuns({});
    expect(runs).toHaveLength(0);
  });

  it('still tries the other agents when one fails to release the parked run', async () => {
    const { agent, controller, storage } = await setup();
    const session = await park(controller, 0);
    const errors = collectErrors(session);
    const failing = { releaseParkedRun: vi.fn().mockRejectedValue(new Error('other agent failed')) };
    const machinery = (session as any).machinery;
    // Only the release after the denial settles sees the failing agent first.
    const settle = session.runEngine.settleSuspendedToolCallsAsDenied.bind(session.runEngine);
    vi.spyOn(session.runEngine, 'settleSuspendedToolCallsAsDenied').mockImplementation(async (...args: any[]) => {
      await (settle as any)(...args);
      vi.spyOn(machinery, 'getAgent').mockReturnValue(failing);
      machinery.getAgents = () => [failing, agent];
    });
    const releaseParkedRun = vi.spyOn(agent, 'releaseParkedRun');
    await controller.deleteSession({ sessionId: 's-0' });

    expect(failing.releaseParkedRun).toHaveBeenCalledTimes(1);
    expect(await releaseParkedRun.mock.results[0]?.value).toBe(true);
    expect(errors).toEqual(['other agent failed']);
    expect(agent.runRegistry.size).toBe(0);
    const { runs } = await (await storage.getStore('workflows'))!.listWorkflowRuns({});
    expect(runs).toHaveLength(0);
  });

  it.each([1, 2] as const)(
    'keeps the snapshot of a run a resume took over before the session was deleted (storage v%i)',
    async storageVersion => {
      const { agent, controller, storage } = await setup({ storageVersion });
      const session = await park(controller, 0);
      const workflows = (await storage.getStore('workflows'))!;
      const [parked] = (await workflows.listWorkflowRuns({ status: 'suspended' })).runs;
      expect(parked?.storageVersion ?? 1).toBe(storageVersion);
      const runId = parked!.runId;
      // Hold the resume inside its first storage read, so it is in flight while the session is deleted.
      const engine = (agent as any).executionEngine;
      const isCanceled = engine.isRunCanceledInStorage.bind(engine);
      let entered!: () => void;
      const resumeEntered = new Promise<void>(resolve => (entered = resolve));
      let proceed!: () => void;
      const gate = new Promise<void>(resolve => (proceed = resolve));
      vi.spyOn(engine, 'isRunCanceledInStorage').mockImplementation(async (id: any) => {
        entered();
        await gate;
        return isCanceled(id);
      });
      // The resumed run answers and finishes, which needs its snapshot to survive the session's deletion.
      const resumed = agent.resume(runId, { a: 'yes' }).then(
        ({ output }) => output.text,
        (error: Error) => error.message,
      );
      await resumeEntered;

      expect(await controller.deleteSession({ sessionId: 's-0' })).toBe(true);

      expect((await workflows.getWorkflowRunById({ runId }))?.snapshot).toBeDefined();
      const releaseParkedRun = vi.spyOn(agent, 'releaseParkedRun');
      proceed();
      expect(await resumed).toBe('done');
      // The deferred release, run once the resume settles, finds nothing of the finished run to release.
      await vi.waitFor(() => expect(releaseParkedRun).toHaveBeenCalledWith(runId));
      for (const result of releaseParkedRun.mock.results) expect(await result.value).toBe(false);
    },
  );

  async function deleteDuringResume(storageVersion: 1 | 2, { resumeData = { a: 'yes' }, failResume = false } = {}) {
    const { agent, controller, storage } = await setup({ storageVersion });
    const session = await park(controller, 0);
    const errors = collectErrors(session);
    const workflows = (await storage.getStore('workflows'))!;
    const [parked] = (await workflows.listWorkflowRuns({ status: 'suspended' })).runs;
    expect(parked?.storageVersion ?? 1).toBe(storageVersion);
    const runId = parked!.runId;
    const engine = (agent as any).executionEngine;
    const isCanceled = engine.isRunCanceledInStorage.bind(engine);
    let entered!: () => void;
    const resumeEntered = new Promise<void>(resolve => (entered = resolve));
    let proceed!: () => void;
    const gate = new Promise<void>(resolve => (proceed = resolve));
    vi.spyOn(engine, 'isRunCanceledInStorage').mockImplementation(async (id: any) => {
      entered();
      await gate;
      if (failResume) throw new Error('resume failed');
      return isCanceled(id);
    });
    // A re-parked run's output never ends, so the resume is done once it settles.
    const resumed = agent.resume(runId, resumeData).then(
      async () => {
        await agent.__resumesSettled(runId);
        return 'resumed';
      },
      (error: Error) => error.message,
    );
    await resumeEntered;
    expect(await controller.deleteSession({ sessionId: 's-0' })).toBe(true);
    return { agent, workflows, runId, errors, resumed, proceed };
  }

  async function expectReleased(agent: any, workflows: any, runId: string) {
    await vi.waitFor(async () => expect((await workflows.listWorkflowRuns({})).runs).toEqual([]));
    expect(agent.runRegistry.size).toBe(0);
    expect(agent.getWorkflow().runs.size).toBe(0);
    expect(globalRunRegistry.get(runId)).toBeUndefined();
  }

  it.each([1, 2] as const)(
    'releases the run and deletes its snapshot when a resume in flight at deletion fails (storage v%i)',
    async storageVersion => {
      const { agent, workflows, runId, resumed, proceed } = await deleteDuringResume(storageVersion, {
        failResume: true,
      });
      proceed();
      expect(await resumed).toBe('resume failed');
      await expectReleased(agent, workflows, runId);
    },
  );

  it.each([1, 2] as const)(
    'releases the run and deletes its snapshot when a resume in flight at deletion parks it again (storage v%i)',
    async storageVersion => {
      const { agent, workflows, runId, resumed, proceed } = await deleteDuringResume(storageVersion, {
        resumeData: { a: 'again' },
      });
      proceed();
      expect(await resumed).toBe('resumed');
      await expectReleased(agent, workflows, runId);
    },
  );

  it.each([1, 2] as const)(
    'still deletes the snapshot after a deferred release throws (storage v%i)',
    async storageVersion => {
      const { agent, workflows, runId, errors, resumed, proceed } = await deleteDuringResume(storageVersion, {
        resumeData: { a: 'again' },
      });
      const releaseParkedRun = vi.spyOn(agent, 'releaseParkedRun').mockRejectedValue(new Error('release failed'));
      proceed();
      expect(await resumed).toBe('resumed');
      await vi.waitFor(async () => expect((await workflows.listWorkflowRuns({})).runs).toEqual([]));
      expect(releaseParkedRun).toHaveBeenCalledWith(runId);
      expect(errors).toContain('release failed');
    },
  );

  // The resume has already stored the run as running when the session is deleted.
  async function deleteWhileResumedRunIsRunning(storageVersion: 1 | 2, answer: string) {
    const { agent, controller, storage } = await setup({ storageVersion, shouldPersistSnapshot: () => true });
    await park(controller, 0);
    const workflows = (await storage.getStore('workflows'))!;
    const [parked] = (await workflows.listWorkflowRuns({ status: 'suspended' })).runs;
    expect(parked?.storageVersion ?? 1).toBe(storageVersion);
    const runId = parked!.runId;
    let entered!: () => void;
    const toolEntered = new Promise<void>(resolve => (entered = resolve));
    let proceed!: () => void;
    const gate = new Promise<void>(resolve => (proceed = resolve));
    resumedToolGate = () => {
      entered();
      return gate;
    };
    const resumed = agent.resume(runId, { a: answer }).then(
      async ({ output }) => (answer === 'again' ? 'resumed' : output.text),
      (error: Error) => error.message,
    );
    await toolEntered;
    const stored = await workflows.getWorkflowRunById({ runId });
    expect((typeof stored?.snapshot === 'string' ? JSON.parse(stored.snapshot) : stored?.snapshot)?.status).toBe(
      'running',
    );
    expect(agent.__isResumingRun(runId)).toBe(true);

    expect(await controller.deleteSession({ sessionId: 's-0' })).toBe(true);
    const releaseParkedRun = vi.spyOn(agent, 'releaseParkedRun');
    proceed();
    const settled = (async () => {
      const result = await resumed;
      await agent.__resumesSettled(runId);
      return result;
    })();
    return { agent, workflows, runId, settled, releaseParkedRun };
  }

  it.each([1, 2] as const)(
    'releases a run stored as running by a resume in flight at deletion that then parks it again (storage v%i)',
    async storageVersion => {
      try {
        const { agent, workflows, runId, settled } = await deleteWhileResumedRunIsRunning(storageVersion, 'again');
        expect(await settled).toBe('resumed');
        await expectReleased(agent, workflows, runId);
      } finally {
        resumedToolGate = undefined;
      }
    },
  );

  // A failed model call ends the run, which drops its own snapshot as a finished run does.
  it.each([1, 2] as const)(
    'leaves nothing parked when a resume in flight at deletion then fails (storage v%i)',
    async storageVersion => {
      failModelAfterTool = true;
      try {
        const { agent, workflows, runId, settled, releaseParkedRun } = await deleteWhileResumedRunIsRunning(
          storageVersion,
          'yes',
        );
        expect(await settled.catch((error: Error) => error.message)).toBe('model failed');
        // Decided once the resume settles: nothing of the failed run is left to release.
        await vi.waitFor(() => expect(releaseParkedRun).toHaveBeenCalledWith(runId));
        for (const result of releaseParkedRun.mock.results) expect(await result.value).toBe(false);
        await vi.waitFor(async () => expect((await workflows.listWorkflowRuns({})).runs).toEqual([]));
        expect(agent.getWorkflow().runs.size).toBe(0);
      } finally {
        resumedToolGate = undefined;
        failModelAfterTool = false;
      }
    },
  );

  // A tool that throws hands the error to the model, which answers: the run finishes either way.
  it.each([
    [1, 'yes'],
    [2, 'yes'],
    [1, 'fail'],
    [2, 'fail'],
  ] as const)(
    'leaves a run stored as running by a resume in flight at deletion to that resume when it finishes (storage v%i, answer %s)',
    async (storageVersion, answer) => {
      try {
        const { workflows, runId, settled, releaseParkedRun } = await deleteWhileResumedRunIsRunning(
          storageVersion,
          answer,
        );
        expect(await settled).toBe('done');
        // The deferred release runs once the resume settles and finds nothing of the finished run to release.
        await vi.waitFor(() => expect(releaseParkedRun).toHaveBeenCalledWith(runId));
        for (const result of releaseParkedRun.mock.results) expect(await result.value).toBe(false);
        // The finished run drops its own snapshot and workflow run, session deleted or not.
        await vi.waitFor(async () => expect((await workflows.listWorkflowRuns({})).runs).toEqual([]));
      } finally {
        resumedToolGate = undefined;
      }
    },
  );

  it('also deletes the snapshot stored under the loop workflow name the runtime agent advertises', async () => {
    const { agent, controller, storage } = await setup();
    await park(controller, 0);
    // Durable wrappers from other engines (e.g. Inngest) store their loop under a name they advertise.
    agent.__setThreadRuntimeAgent({ durableLoopWorkflowName: 'engine-agentic-loop' } as any);
    const workflows = (await storage.getStore('workflows'))!;
    const [parked] = (await workflows.listWorkflowRuns({ status: 'suspended' })).runs;
    await workflows.persistWorkflowSnapshot({
      workflowName: 'engine-agentic-loop',
      runId: parked!.runId,
      snapshot: { ...(parked!.snapshot as any), runId: parked!.runId },
    });

    await controller.deleteSession({ sessionId: 's-0' });

    expect((await workflows.listWorkflowRuns({})).runs).toEqual([]);
  });

  it('keeps the parked run in memory when the session moves to a new thread', async () => {
    const { agent, controller } = await setup();
    const session = await park(controller, 0);

    await session.thread.create();

    expect(agent.runRegistry.size).toBe(1);
  });
});
