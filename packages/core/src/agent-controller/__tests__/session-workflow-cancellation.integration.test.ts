import dns from 'node:dns';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent, globalRunRegistry } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createWorkflow, createStep } from '../../workflows';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function response(tool = false) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      if (tool)
        controller.enqueue({
          type: 'tool-call',
          toolCallId: 'research-call',
          toolName: 'workflow-research',
          input: '{"inputData":{}}',
        });
      else {
        controller.enqueue({ type: 'text-start', id: 'text' });
        controller.enqueue({ type: 'text-delta', id: 'text', delta: 'Done.' });
        controller.enqueue({ type: 'text-end', id: 'text' });
      }
      controller.enqueue({
        type: 'finish',
        finishReason: tool ? 'tool-calls' : 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

async function createHarness(parkChild = false) {
  const started = deferred();
  const release = deferred();
  const approval = deferred();
  const ended = deferred();
  const suspended = deferred();
  const calls = { parent: 0, child: 0, followingStep: 0 };
  const signals: AbortSignal[] = [];
  const ends: Array<string | undefined> = [];
  const approvals: string[] = [];
  const errors: unknown[] = [];
  const storage = new InMemoryStore();
  const child = new Agent({
    id: 'child',
    name: 'Child',
    instructions: 'Research locally.',
    model: new MastraLanguageModelV2Mock({
      doStream: async options => {
        calls.child++;
        signals.push(options.abortSignal!);
        started.resolve();
        return {
          stream: new ReadableStream({
            start(controller) {
              const abort = () => controller.error(options.abortSignal!.reason);
              options.abortSignal!.addEventListener('abort', abort, { once: true });
              void release.promise.then(() => {
                options.abortSignal!.removeEventListener('abort', abort);
                if (!options.abortSignal!.aborted) {
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  controller.close();
                }
              });
            },
          }),
        };
      },
    }),
  });
  const research = createWorkflow({ id: 'research', inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(
      createStep({
        id: 'read',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        suspendSchema: z.object({ prompt: z.string() }),
        resumeSchema: z.object({ confirmed: z.boolean() }),
        execute: async ({ abortSignal, suspend, resumeData }) => {
          if (parkChild && !resumeData?.confirmed) return suspend({ prompt: 'Confirm research.' });
          const output = await child.stream('Read the local evidence.', { abortSignal });
          await output.getFullOutput();
          return {};
        },
      }),
    )
    .then(
      createStep({
        id: 'following',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => {
          calls.followingStep++;
          return {};
        },
      }),
    )
    .commit();
  const durable = createDurableAgent({
    agent: new Agent({
      id: 'research-parent',
      name: 'Research parent',
      instructions: 'Use research.',
      model: new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: response(++calls.parent === 1) }) }),
      memory: new Memory({ storage }),
      workflows: { research },
    }),
  });
  const mastra = new Mastra({
    agents: { durable, child },
    workflows: { research },
    storage,
    logger: false,
    workers: false,
    scheduler: { enabled: false },
    recovery: { durableAgents: 'off' },
  });
  await mastra.startWorkers();
  const workspace = new Workspace({ id: 'cancel-workspace', name: 'Local', skills: () => [] });
  const controllerOptions = {
    id: 'cancel-controller',
    agent: mastra.getAgentById(durable.id),
    storage,
    workspace,
    defaultModeId: 'chat',
    modes: [{ id: 'chat', name: 'Chat', default: true }],
    disableBuiltinTools: [
      'ask_user',
      'submit_plan',
      'task_write',
      'task_update',
      'task_complete',
      'task_check',
      'subagent',
    ],
  };
  const controller = new AgentController(controllerOptions);
  await controller.init();
  const session = await controller.createSession({ ownerId: 'owner', resourceId: 'resource', workspace });
  await session.thread.create();
  const off = session.subscribe(event => {
    if (event.type === 'tool_approval_required') {
      approvals.push(event.toolCallId);
      approval.resolve();
    }
    if (event.type === 'agent_end') {
      ends.push(event.reason);
      ended.resolve();
    }
    if (event.type === 'error') errors.push(event.error);
    if (event.type === 'tool_suspended') suspended.resolve();
  });
  return {
    session,
    storage,
    calls,
    signals,
    ends,
    errors,
    approvals,
    started,
    approval,
    ended,
    release,
    suspended,
    research,
    durable,
    async reopen() {
      const freshController = new AgentController(controllerOptions);
      await freshController.init();
      const fresh = await freshController.createSession({ ownerId: 'owner', resourceId: 'resource', workspace });
      await fresh.thread.switch({ threadId: session.thread.getId()! });
      return { session: fresh, close: () => freshController.stopIntervals() };
    },
    async close() {
      release.resolve();
      session.abort();
      off();
      controller.stopIntervals();
      await mastra.stopWorkers();
    },
  };
}

describe('native Session cancellation reaches workflow tools', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External network is forbidden'));
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(() => {
      throw new Error('External socket is forbidden');
    });
    vi.spyOn(dns, 'lookup').mockImplementation(() => {
      throw new Error('External DNS is forbidden');
    });
  });
  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(net.Socket.prototype.connect).not.toHaveBeenCalled();
    expect(dns.lookup).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('Stop during child creation never starts the child stream', async () => {
    const h = await createHarness();
    const created = deferred();
    const releaseCreate = deferred();
    const createRun = h.research.createRun.bind(h.research);
    vi.spyOn(h.research, 'createRun').mockImplementationOnce(async options => {
      const run = await createRun(options);
      created.resolve();
      await releaseCreate.promise;
      return run;
    });
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await created.promise;
      h.session.abort();
      releaseCreate.resolve();
      await h.ended.promise;
      await delay(50);
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
      expect(h.errors).toEqual([]);
    } finally {
      releaseCreate.resolve();
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('a rejected executor does not skip cancellation of its stored suspended work', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      const store = (await h.storage.getStore('workflows'))!;
      const parent = (await store.listWorkflowRuns({ workflowName: 'durable-agentic-loop' })).runs[0]!;
      const entry = globalRunRegistry.get(parent.runId)!;
      const rejection = Promise.reject(new Error('Executor already reported its failure'));
      void rejection.catch(() => {});
      entry.workflowExecution = rejection;
      h.session.abort();
      await vi.waitFor(async () => expect((await store.listWorkflowRuns({ status: 'suspended' })).total).toBe(0), {
        timeout: 1500,
      });
      expect(h.calls.child).toBe(0);
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('Stop cancels a running child model after workflow approval and prevents further steps', async () => {
    const h = await createHarness();
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.started.promise;
      h.session.abort();
      await vi.waitFor(() => expect(h.signals[0]?.aborted).toBe(true), { timeout: 1500 });
      await vi.waitFor(
        () => expect({ ends: h.ends, errors: h.errors }).toMatchObject({ ends: ['aborted'], errors: [] }),
        { timeout: 1500 },
      );
      await delay(100);
      expect(h.calls).toEqual({ parent: 1, child: 1, followingStep: 0 });
      expect(h.approvals).toEqual(['research-call']);
      expect(h.session.displayState.get().isRunning).toBe(false);
      const runs = await (await h.storage.getStore('workflows'))!.listWorkflowRuns({});
      expect(
        runs.runs.every(run => !['running', 'suspended', 'waiting', 'pending'].includes(run.snapshot?.status)),
      ).toBe(true);
      expect(h.errors).toEqual([]);
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('Stop at pending approval starts no child and leaves no resumable durable run', async () => {
    const h = await createHarness();
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.abort();
      await h.ended.promise;
      await delay(100);
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
      expect({ ends: h.ends, errors: h.errors }).toEqual({ ends: ['aborted'], errors: [] });
      expect(h.session.displayState.get().pendingApproval).toBeNull();
      const runs = await (await h.storage.getStore('workflows'))!.listWorkflowRuns({});
      expect(runs.runs).toEqual([]);
      expect(h.errors).toEqual([]);
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('an approved workflow can complete normally', async () => {
    const h = await createHarness();
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.started.promise;
      h.release.resolve();
      await h.ended.promise;
      await delay(100);
      expect(h.calls).toEqual({ parent: 2, child: 1, followingStep: 1 });
      expect(h.ends).toEqual(['complete']);
      expect(h.errors).toEqual([]);
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('Stop during async approval preparation cannot start the approved workflow', async () => {
    const h = await createHarness();
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    const preparing = deferred();
    const prepared = deferred();
    try {
      await h.approval.promise;
      const original = h.session.machinery.buildRequestContext.bind(h.session.machinery);
      vi.spyOn(h.session.machinery, 'buildRequestContext').mockImplementationOnce(async (...args) => {
        preparing.resolve();
        await prepared.promise;
        return original(...args);
      });
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await preparing.promise;
      h.session.abort();
      prepared.resolve();
      await delay(150);
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
      expect(h.ends).toEqual(['aborted']);
      expect(h.errors).toEqual([]);
    } finally {
      prepared.resolve();
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('Stop cancels stored child and durable runs even when a parked session projects idle', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      const store = (await h.storage.getStore('workflows'))!;
      await vi.waitFor(
        async () =>
          expect(
            (await store.listWorkflowRuns({})).runs.map(run => ({ id: run.runId, status: run.snapshot?.status })),
          ).toContainEqual(expect.objectContaining({ status: 'suspended' })),
        { timeout: 1500 },
      );
      expect(h.session.displayState.get().isRunning).toBe(false);
      h.session.abort();
      await vi.waitFor(
        async () => {
          const runs = await store.listWorkflowRuns({});
          expect(
            runs.runs
              .filter(run => ['running', 'suspended', 'waiting', 'pending'].includes(run.snapshot?.status))
              .map(run => ({ id: run.runId, workflow: run.workflowName, status: run.snapshot?.status })),
          ).toEqual([]);
        },
        { timeout: 1500 },
      );
      await h.session.respondToToolSuspension({ toolCallId: 'research-call', resumeData: { confirmed: true } });
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('a fresh Session cannot reopen a canceled workflow suspension', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    let reopened: Awaited<ReturnType<typeof h.reopen>> | undefined;
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      h.session.abort();
      await delay(100);
      reopened = await h.reopen();
      await delay(100);
      expect(reopened.session.displayState.get().pendingSuspensions.size).toBe(0);
      expect(reopened.session.displayState.get().pendingApproval).toBeNull();
      await reopened.session.respondToToolSuspension({ toolCallId: 'research-call', resumeData: { confirmed: true } });
      await delay(100);
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
    } finally {
      reopened?.close();
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('Stop from a recreated Session cancels the existing stored workflow suspension', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    let reopened: Awaited<ReturnType<typeof h.reopen>> | undefined;
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      reopened = await h.reopen();
      await delay(50);
      expect(reopened.session.displayState.get().isRunning).toBe(false);
      reopened.session.abort();
      const store = (await h.storage.getStore('workflows'))!;
      await vi.waitFor(
        async () =>
          expect({
            pending: (await store.listWorkflowRuns({ status: 'suspended' })).total,
            runId: reopened!.session.getCurrentRunId(),
          }).toMatchObject({ pending: 0 }),
        { timeout: 1500 },
      );
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
    } finally {
      reopened?.close();
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('Stop from a recreated Session cancels an already running child promptly', async () => {
    const h = await createHarness();
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    let reopened: Awaited<ReturnType<typeof h.reopen>> | undefined;
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.started.promise;
      reopened = await h.reopen();
      reopened.session.abort();
      await vi.waitFor(() => expect(h.signals[0].aborted).toBe(true), { timeout: 1500 });
      expect(h.calls.followingStep).toBe(0);
      expect(h.calls.parent).toBe(1);
    } finally {
      reopened?.close();
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('late Stop discovery cannot cancel a later thread and user turn', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    const discovered = deferred();
    const releaseDiscovery = deferred();
    let reopened: Awaited<ReturnType<typeof h.reopen>> | undefined;
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      reopened = await h.reopen();
      const agent = reopened.session.machinery.getAgent();
      const discover = agent.listSuspendedRuns.bind(agent);
      vi.spyOn(agent, 'listSuspendedRuns').mockImplementationOnce(async options => {
        const result = await discover(options);
        discovered.resolve();
        await releaseDiscovery.promise;
        return result;
      });
      const abort = vi.spyOn(agent, 'abortRunStream');
      reopened.session.abort();
      await discovered.promise;
      await reopened.session.thread.create();
      await reopened.session.sendMessage({ content: 'A new local turn.' });
      const completedCalls = h.calls.parent;
      releaseDiscovery.resolve();
      await delay(50);
      expect(abort).not.toHaveBeenCalled();
      expect(h.calls.parent).toBe(completedCalls);
    } finally {
      releaseDiscovery.resolve();
      reopened?.close();
      await h.close();
      void turn.catch(() => {});
    }
  });

  it('a delegated child that resumes during Stop is canceled before its following step', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    const lookingUpChild = deferred();
    const allowLookup = deferred();
    let childResume: Promise<unknown> | undefined;
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      const store = (await h.storage.getStore('workflows'))!;
      const child = (await store.listWorkflowRuns({ workflowName: 'research' })).runs[0]!;
      const childRun = await h.research.createRun({ runId: child.runId, resourceId: 'resource' });
      const get = store.getWorkflowRunById.bind(store);
      vi.spyOn(store, 'getWorkflowRunById').mockImplementation(async options => {
        if (options.workflowName === 'research') {
          lookingUpChild.resolve();
          await allowLookup.promise;
        }
        return get(options);
      });
      h.session.abort();
      await lookingUpChild.promise;
      childResume = childRun.resume({ resumeData: { confirmed: true } });
      await h.started.promise;
      allowLookup.resolve();
      await vi.waitFor(() => expect(h.signals[0].aborted).toBe(true), { timeout: 1500 });
      await childResume;
      expect(h.calls.followingStep).toBe(0);
      expect(h.calls.parent).toBe(1);
    } finally {
      allowLookup.resolve();
      await h.close();
      void Promise.allSettled([turn, ...(childResume ? [childResume] : [])]);
    }
  });

  it('a failed parked cancellation stays observable and retains stored pending runs', async () => {
    const h = await createHarness(true);
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.suspended.promise;
      await h.ended.promise;
      const store = (await h.storage.getStore('workflows'))!;
      const failure = new Error('Local cancellation persistence failed');
      vi.spyOn(store, 'updateWorkflowState').mockRejectedValueOnce(failure);
      h.session.abort();
      await vi.waitFor(() => expect(h.errors).toContainEqual(expect.objectContaining({ message: failure.message })), {
        timeout: 1500,
      });
      expect((await store.listWorkflowRuns({ status: 'suspended' })).runs).toHaveLength(3);
      expect(h.calls).toEqual({ parent: 1, child: 0, followingStep: 0 });
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });

  it.each([false, true])('cancels an unscoped native durable workflow (string row snapshot=%s)', async stringRow => {
    const storage = new InMemoryStore();
    const research = createWorkflow({ id: 'unscoped-research', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({
          id: 'park',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async ({ suspend }) => suspend({ prompt: 'Wait.' }),
        }),
      )
      .commit();
    const durable = createDurableAgent({
      agent: new Agent({
        id: 'unscoped-agent',
        name: 'Unscoped',
        instructions: 'Use research.',
        model: new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: response(true) }) }),
        workflows: { research },
      }),
    });
    const mastra = new Mastra({
      agents: { durable },
      workflows: { research },
      storage,
      logger: false,
      workers: false,
      scheduler: { enabled: false },
      recovery: { durableAgents: 'off' },
    });
    await mastra.startWorkers();
    try {
      expect((await durable.generate('Run locally.', { runId: 'unscoped-run' })).finishReason).toBe('suspended');
      const store = (await storage.getStore('workflows'))!;
      if (stringRow) {
        const get = store.getWorkflowRunById.bind(store);
        vi.spyOn(store, 'getWorkflowRunById').mockImplementation(async options => {
          const row = await get(options);
          return row ? { ...row, snapshot: JSON.stringify(row.snapshot) } : row;
        });
      }
      durable.abortRunStream('unscoped-run');
      await vi.waitFor(async () => expect((await store.listWorkflowRuns({ status: 'suspended' })).total).toBe(0), {
        timeout: 1500,
      });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('cancels stored running parent identities without an executor and exposes the missing active-child link', async () => {
    const h = await createHarness();
    const turn = h.session.sendMessage({ content: 'Research locally.' });
    const restored = new InMemoryStore();
    try {
      await h.approval.promise;
      h.session.respondToToolApproval({ decision: 'approve', toolCallId: 'research-call' });
      await h.started.promise;
      const original = (await h.storage.getStore('workflows'))!;
      const frozen = (await original.listWorkflowRuns({})).runs;
      const parent = frozen.find(row => row.workflowName === 'durable-agentic-loop')!;
      const observer = await h.durable.observe(parent.runId);
      await h.close();
      observer.cleanup();
      await delay(50);
      const store = (await restored.getStore('workflows'))!;
      for (const row of frozen) {
        await store.persistWorkflowSnapshot({
          workflowName: row.workflowName,
          runId: row.runId,
          resourceId: row.resourceId,
          snapshot: row.snapshot as any,
        });
      }
      const model = vi.fn(async () => {
        throw new Error('Canceled stored work must never start a model');
      });
      const agent = createDurableAgent({
        agent: new Agent({
          id: h.durable.id,
          name: 'Restored',
          instructions: 'Use research.',
          model: new MastraLanguageModelV2Mock({ doStream: model }),
          workflows: { research: h.research },
        }),
      });
      new Mastra({
        agents: { agent },
        workflows: { research: h.research },
        storage: restored,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      agent.abortRunStream(parent.runId);
      await vi.waitFor(
        async () => {
          expect(
            (await store.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId: parent.runId }))?.status,
          ).toBe('canceled');
          expect(
            (await store.loadWorkflowSnapshot({ workflowName: 'durable-agentic-execution', runId: parent.runId }))
              ?.status,
          ).toBe('canceled');
        },
        { timeout: 1500 },
      );
      expect(model).not.toHaveBeenCalled();
      // The running tool has not yet saved suspendedToolRunId. No unrelated
      // workflow can be inferred from a shared resource, so this remains a gap.
      expect((await store.listWorkflowRuns({ workflowName: 'research', status: 'running' })).total).toBe(1);
    } finally {
      await h.close();
      void turn.catch(() => {});
    }
  });
});
