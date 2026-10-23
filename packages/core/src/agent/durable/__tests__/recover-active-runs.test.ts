/**
 * Tests for `DurableAgent.recoverActiveRuns()` — the boot-time / operator
 * hook that re-drives orphaned durable agent runs after a process restart
 * (issue #19056).
 *
 * These are unit tests: we stub the durable workflow so `restart()` is
 * observable without spinning up the full agentic loop. That behavior is
 * covered by the workflow engine's own restart tests; here we're pinning
 * down the discovery-and-dispatch contract of `recoverActiveRuns` itself.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState, WorkflowRunStatus } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';
import { ExecutionFence } from '../execution-fence';
import { globalRunRegistry } from '../run-registry';
import { emitChunkEvent, emitFinishEvent } from '../stream-adapter';

function makeSnapshot(
  runId: string,
  status: WorkflowRunStatus,
  input: { agentId?: string; threadId?: string; resourceId?: string },
): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {
      input: {
        __workflowKind: 'durable-agent',
        runId,
        agentId: input.agentId,
        messageListState: {
          memoryInfo:
            input.threadId || input.resourceId ? { threadId: input.threadId, resourceId: input.resourceId } : null,
        },
      } as any,
    },
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
  } as WorkflowRunState;
}

function makeMockModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-delta', textDelta: 'ok' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

function createWithStore(
  agentId: string,
  engine: 'default' | 'evented',
): {
  agent: DurableAgent;
  store: InMemoryStore;
  mastra: Mastra;
} {
  const baseAgent = new Agent({
    id: agentId,
    name: agentId,
    instructions: 'x',
    model: makeMockModel(),
  });
  const store = new InMemoryStore();
  const agent =
    engine === 'evented' ? createEventedAgent({ agent: baseAgent }) : createDurableAgent({ agent: baseAgent });
  const mastra = new Mastra({
    agents: { [agentId]: agent as any },
    storage: store,
  });
  return { agent, store, mastra };
}

async function seed(store: InMemoryStore, snapshot: WorkflowRunState, resourceId?: string) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId: snapshot.runId,
    resourceId,
    snapshot,
  });
}

/**
 * Stub the durable workflow so `createRun({ runId }).restart()` is observable
 * without exercising the real agentic loop. Returns the recorded runIds and
 * a controller that lets tests make specific restarts fail.
 */
function stubWorkflow(
  agent: DurableAgent,
  behavior: { failFor?: Set<string>; status?: WorkflowRunStatus; restartGate?: Promise<void> } = {},
): { restartedRunIds: string[] } {
  const restartedRunIds: string[] = [];
  const failFor = behavior.failFor ?? new Set<string>();
  const fakeWorkflow = {
    createRun: vi.fn(async ({ runId }: { runId: string }) => ({
      restart: vi.fn(async () => {
        restartedRunIds.push(runId);
        if (runId === 'stalled') await behavior.restartGate;
        if (failFor.has(runId)) {
          throw new Error(`boom-${runId}`);
        }
        return { status: behavior.status ?? 'success' };
      }),
    })),
  };
  vi.spyOn(agent, 'getWorkflow').mockReturnValue(fakeWorkflow as any);
  return { restartedRunIds };
}

describe.each(['default', 'evented'] as const)('DurableAgent.recoverActiveRuns (%s)', engine => {
  const createDurableWithStore = (agentId: string) => createWithStore(agentId, engine);
  let agent: DurableAgent;
  let store: InMemoryStore;
  let mastra: Mastra;

  beforeEach(() => {
    ({ agent, store, mastra } = createDurableWithStore('agent-A'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['resolve', 'reject', 'transient-reject'] as const)(
    'bounds setup and preserves the returned result after late %s',
    async late => {
      vi.useFakeTimers();
      await seed(store, makeSnapshot('stalled', 'running', { agentId: agent.id }));
      await seed(store, makeSnapshot('later', 'running', { agentId: agent.id }));
      const gate = Promise.withResolvers<void>();
      const recover = vi.spyOn(agent, 'recover').mockImplementation(async runId => {
        if (runId === 'stalled') await gate.promise;
        return { cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>;
      });
      let settled = false;
      const recovery = agent.recoverActiveRuns().then(result => {
        settled = true;
        return result;
      });
      try {
        await vi.advanceTimersByTimeAsync(29_999);
        expect(recover).toHaveBeenCalledTimes(2);
        expect(recover.mock.calls.map(([runId]) => runId)).toEqual(['stalled', 'later']);
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toBe(true);
        expect(recover).toHaveBeenCalledTimes(2);
        const result = await recovery;
        const snapshot = structuredClone(result);
        expect(result).toEqual({
          recovered: [
            { runId: 'stalled', status: 'skipped', reason: 'recovery-timeout', retryAt: Date.now() + 30_000 },
            { runId: 'later', status: 'success' },
          ],
          succeeded: 1,
          failed: 0,
        });
        if (late === 'resolve') gate.resolve();
        else gate.reject(new Error(late === 'transient-reject' ? 'LOADING Redis is loading' : 'late setup failure'));
        await vi.advanceTimersByTimeAsync(0);
        expect(result).toEqual(snapshot);
      } finally {
        gate.resolve();
        await recovery;
        await mastra.shutdown({ drainTimeout: 0 });
      }
    },
  );

  it('reaches a healthy run behind ten stalled setups after two bounded batches', async () => {
    vi.useFakeTimers();
    const runIds = [...Array.from({ length: 10 }, (_, i) => `stalled-${i}`), 'healthy'];
    for (const runId of runIds) await seed(store, makeSnapshot(runId, 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const recover = vi.spyOn(agent, 'recover').mockImplementation(async runId => {
      if (runId !== 'healthy') await gate.promise;
      return { cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>;
    });
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(recover).toHaveBeenCalledTimes(5);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(recover).toHaveBeenCalledTimes(10);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(recover).toHaveBeenCalledTimes(11);
      const result = await recovery;
      expect(result.recovered.map(run => run.runId)).toEqual(runIds);
      expect(result).toMatchObject({ succeeded: 1, failed: 0 });
    } finally {
      gate.resolve();
      await recovery;
      await mastra.shutdown({ drainTimeout: 0 });
    }
  });

  it('does not redispatch pending setups on overlapping calls or timeout rechecks, but retries after settlement', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('stalled', 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const recover = vi.spyOn(agent, 'recover').mockImplementation(async () => {
      await gate.promise;
      throw new Error('late failure');
    });
    const first = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      const assertPending = async () => {
        expect(await agent.recoverActiveRuns({ runId: 'stalled' })).toEqual({
          recovered: [
            { runId: 'stalled', status: 'skipped', reason: 'recovery-timeout', retryAt: Date.now() + 30_000 },
          ],
          succeeded: 0,
          failed: 0,
        });
        expect(recover).toHaveBeenCalledTimes(1);
      };
      await assertPending();
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await first;
      const snapshot = structuredClone(result);
      await assertPending();
      await vi.advanceTimersByTimeAsync(30_000);
      await assertPending();
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      stubWorkflow(agent);
      recover.mockRestore();
      const retried = vi.spyOn(agent, 'recover');
      expect(await agent.recoverActiveRuns({ runId: 'stalled' })).toMatchObject({ succeeded: 1, failed: 0 });
      expect(retried).toHaveBeenCalledTimes(1);
      expect(result).toEqual(snapshot);
    } finally {
      gate.resolve();
      await first;
      await mastra.shutdown({ drainTimeout: 0 });
    }
  });

  it('does not restart a timed-out attempt whose persisted snapshot becomes terminal after settlement', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('stalled', 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const recover = vi.spyOn(agent, 'recover').mockImplementation(async () => {
      await gate.promise;
      return { cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>;
    });
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await recovery;
      const snapshot = structuredClone(result);
      await seed(store, makeSnapshot('stalled', 'success', { agentId: agent.id }));
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(await agent.recoverActiveRuns({ runId: 'stalled' })).toEqual({ recovered: [], succeeded: 0, failed: 0 });
      expect(recover).toHaveBeenCalledTimes(1);
      expect(result).toEqual(snapshot);
    } finally {
      gate.resolve();
      await recovery;
      await mastra.shutdown({ drainTimeout: 0 });
    }
  });

  it('does not dispatch queued runs when shutdown starts with all five slots pending', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 7; i++) await seed(store, makeSnapshot(`run-${i}`, 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const recover = vi.spyOn(agent, 'recover').mockImplementation(async () => {
      await gate.promise;
      return { cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>;
    });
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(recover).toHaveBeenCalledTimes(5);
      const shutdown = mastra.shutdown({ drainTimeout: 100 });
      await vi.advanceTimersByTimeAsync(100);
      await shutdown;
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect((await recovery).recovered).toHaveLength(5);
      expect(recover).toHaveBeenCalledTimes(5);
    } finally {
      gate.resolve();
      await recovery;
      await mastra.shutdown({ drainTimeout: 0 });
    }
  });

  it('bounds workflow settlement without releasing ownership, then fences it on shutdown', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('stalled', 'running', { agentId: agent.id }));
    await seed(store, makeSnapshot('later', 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const { restartedRunIds } = stubWorkflow(agent, { restartGate: gate.promise });
    const workflows = (await store.getStore('workflows'))!;
    const deleteSnapshots = vi.spyOn(agent, 'deleteRunSnapshots');
    let settled = false;
    const recovery = agent.recoverActiveRuns().then(result => {
      settled = true;
      return result;
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(restartedRunIds).toEqual(['stalled', 'later']);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(settled).toBe(true);
      expect(restartedRunIds).toEqual(['stalled', 'later']);
      expect(await recovery).toMatchObject({ succeeded: 1, failed: 0 });
      expect((await workflows.getRunOwnership({ runId: 'stalled' }))?.ownerId).toBeTruthy();
      const shutdown = mastra.shutdown({ drainTimeout: 100 });
      await vi.advanceTimersByTimeAsync(100);
      await shutdown;
      expect((await workflows.getRunOwnership({ runId: 'stalled' }))?.leaseExpiresAt).toBeNull();
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(deleteSnapshots).not.toHaveBeenCalledWith('stalled');
      expect(
        await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: 'stalled' }),
      ).toMatchObject({ status: 'running' });
    } finally {
      gate.resolve();
      await recovery;
      await mastra.shutdown({ drainTimeout: 0 });
    }
  });

  it.each(['DURABLE_AGENT_RECOVER_SHUTDOWN', 'DURABLE_AGENT_EXECUTION_ABANDONED'])(
    'does not retry %s even when its cause is transient',
    async id => {
      await seed(store, makeSnapshot('shutdown-transient', 'running', { agentId: agent.id }));
      vi.spyOn(agent, 'recover').mockRejectedValueOnce(
        Object.assign(new Error('recovery interrupted', { cause: new Error('LOADING Redis is loading') }), { id }),
      );

      expect(await agent.recoverActiveRuns()).toEqual({
        recovered: [{ runId: 'shutdown-transient', status: 'skipped' }],
        succeeded: 0,
        failed: 0,
      });
    },
  );

  it('does not dispatch after shutdown during discovery or at entry', async () => {
    const gate = Promise.withResolvers<void>();
    const list = vi.spyOn(agent, 'listActiveRuns').mockImplementation(async () => {
      await gate.promise;
      return { runs: [{ runId: 'late-discovery' }] as any, total: 1 };
    });
    const recover = vi.spyOn(agent, 'recover');
    const recovery = agent.recoverActiveRuns();
    await mastra.shutdown({ drainTimeout: 0 });
    gate.resolve();
    expect(await recovery).toEqual({ recovered: [], succeeded: 0, failed: 0 });
    expect(recover).not.toHaveBeenCalled();
    await agent.recoverActiveRuns();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('releases a late ownership claim without restarting or deleting its snapshot after shutdown', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('stalled', 'running', { agentId: agent.id }));
    const workflows = (await store.getStore('workflows'))!;
    const gate = Promise.withResolvers<void>();
    const claim = workflows.claimRunOwnership.bind(workflows);
    const claimSpy = vi.spyOn(workflows, 'claimRunOwnership').mockImplementation(async input => {
      await gate.promise;
      return claim(input);
    });
    const { restartedRunIds } = stubWorkflow(agent);
    const emitError = vi.spyOn(agent, 'emitError');
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(claimSpy).toHaveBeenCalledTimes(1);
      const shutdown = mastra.shutdown({ drainTimeout: 0 });
      await vi.advanceTimersByTimeAsync(0);
      await shutdown;
      gate.resolve();
      const result = await recovery;
      expect(result).toMatchObject({ succeeded: 0, failed: 0 });
      expect(restartedRunIds).toEqual([]);
      expect((await workflows.getRunOwnership({ runId: 'stalled' }))?.leaseExpiresAt).toBeNull();
      expect(emitError).not.toHaveBeenCalled();
      expect(
        await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: 'stalled' }),
      ).toMatchObject({ status: 'running' });
    } finally {
      gate.resolve();
      await recovery;
    }
  });

  it('does not register a stream when ownership publication finishes after shutdown', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('late-publication', 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const pubsub = agent.getPubSub();
    const publish = vi.spyOn(pubsub, 'publish').mockImplementationOnce(async () => gate.promise);
    const subscribe = vi.spyOn(pubsub, 'subscribe');
    const emitError = vi.spyOn(agent, 'emitError');
    const { restartedRunIds } = stubWorkflow(agent);
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(publish).toHaveBeenCalledTimes(1);
      const shutdown = mastra.shutdown({ drainTimeout: 0 });
      await vi.advanceTimersByTimeAsync(0);
      await shutdown;
      gate.resolve();
      expect(await recovery).toMatchObject({ succeeded: 0, failed: 0 });
      expect(subscribe).not.toHaveBeenCalled();
      expect(restartedRunIds).toEqual([]);
      expect(emitError).not.toHaveBeenCalled();
      const workflows = (await store.getStore('workflows'))!;
      expect((await workflows.getRunOwnership({ runId: 'late-publication' }))?.leaseExpiresAt).toBeNull();
      expect(
        await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: 'late-publication' }),
      ).toMatchObject({ status: 'running' });
    } finally {
      gate.resolve();
      await recovery;
    }
  });

  it('does not restart or count a failure when shutdown interrupts workflow creation', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('late-workflow', 'running', { agentId: agent.id }));
    const gate = Promise.withResolvers<void>();
    const restart = vi.fn();
    const createRun = vi.fn(async () => {
      await gate.promise;
      return { restart };
    });
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({ createRun } as any);
    const emitError = vi.spyOn(agent, 'emitError');
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(createRun).toHaveBeenCalledTimes(1);
      const shutdown = mastra.shutdown({ drainTimeout: 0 });
      await vi.advanceTimersByTimeAsync(0);
      await shutdown;
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(await recovery).toMatchObject({ succeeded: 0, failed: 0 });
      expect(restart).not.toHaveBeenCalled();
      expect(emitError).not.toHaveBeenCalled();
    } finally {
      gate.resolve();
      await recovery;
    }
  });

  it('preserves an observed terminal error when abandonment follows it', async () => {
    await seed(store, makeSnapshot('failed-before-abandon', 'running', { agentId: agent.id }));
    const failure = new Error('terminal workflow failure');
    vi.spyOn(agent, 'recover').mockImplementationOnce(async (_runId, options) => {
      await options?.onError?.({ error: failure });
      throw Object.assign(new Error('execution abandoned'), { id: 'DURABLE_AGENT_EXECUTION_ABANDONED' });
    });
    expect(await agent.recoverActiveRuns()).toEqual({
      recovered: [{ runId: 'failed-before-abandon', status: 'failed', error: failure }],
      succeeded: 0,
      failed: 1,
    });
  });

  it('preserves a genuine setup failure that settles after shutdown', async () => {
    vi.useFakeTimers();
    await seed(store, makeSnapshot('failed-claim', 'running', { agentId: agent.id }));
    const workflows = (await store.getStore('workflows'))!;
    const gate = Promise.withResolvers<void>();
    const failure = new Error('storage connection failed');
    const claim = vi.spyOn(workflows, 'claimRunOwnership').mockImplementationOnce(async () => {
      await gate.promise;
      throw failure;
    });
    const emitError = vi.spyOn(agent, 'emitError');
    const recovery = agent.recoverActiveRuns();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(claim).toHaveBeenCalledTimes(1);
      const shutdown = mastra.shutdown({ drainTimeout: 0 });
      await vi.advanceTimersByTimeAsync(0);
      await shutdown;
      gate.resolve();
      expect(await recovery).toMatchObject({
        recovered: [{ runId: 'failed-claim', status: 'failed', error: failure }],
        succeeded: 0,
        failed: 1,
      });
      expect(emitError).not.toHaveBeenCalled();
      expect(
        await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: 'failed-claim' }),
      ).toMatchObject({ status: 'running' });
    } finally {
      gate.resolve();
      await recovery;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    new Error('LOADING Redis is loading the dataset in memory'),
    ...['LOADING', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'].map(code =>
      Object.assign(new Error('storage unavailable'), { code }),
    ),
    new Error('wrapped storage error', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) }),
    new MastraError(
      { id: 'STORAGE_TEST', domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
      Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    ),
  ])('defers a transient pre-start recovery failure: %s', async error => {
    const runId = 'transient-run';
    await seed(store, makeSnapshot(runId, 'running', { agentId: agent.id }));
    vi.spyOn(agent, 'recover').mockRejectedValueOnce(error);
    const before = Date.now();

    const result = await agent.recoverActiveRuns();

    expect(result).toEqual({
      recovered: [{ runId, status: 'skipped', reason: 'transient-error', retryAt: expect.any(Number) }],
      succeeded: 0,
      failed: 0,
    });
    expect(result.recovered[0]!.retryAt).toBeGreaterThanOrEqual(before + 30_000);
    expect(result.recovered[0]!.retryAt).toBeLessThanOrEqual(Date.now() + 30_000);
  });

  it.each([
    new Error('invalid agent configuration'),
    new Error('invalid LOADING configuration'),
    new Error('LOADING_CONFIG is invalid'),
    new Error('request timeout'),
    Object.assign(new Error('aborted'), { name: 'AbortError' }),
    Object.assign(new Error('aborted', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) }), {
      name: 'AbortError',
    }),
    Object.assign(
      new Error('transport timeout', { cause: Object.assign(new Error('aborted'), { name: 'AbortError' }) }),
      {
        code: 'ETIMEDOUT',
      },
    ),
    Object.assign(new Error('cyclic cause'), { cause: undefined as unknown }),
  ])('keeps a non-transient pre-start failure terminal: %s', async error => {
    if (error.message === 'cyclic cause') error.cause = error;
    await seed(store, makeSnapshot('permanent-run', 'running', { agentId: agent.id }));
    vi.spyOn(agent, 'recover').mockRejectedValueOnce(error);

    await expect(agent.recoverActiveRuns()).resolves.toEqual({
      recovered: [{ runId: 'permanent-run', status: 'failed', error }],
      succeeded: 0,
      failed: 1,
    });
  });

  it('does not retry transient errors after recovery starts', async () => {
    const runId = 'started-run';
    const error = Object.assign(new Error('reset after start'), { code: 'ECONNRESET' });
    await seed(store, makeSnapshot(runId, 'running', { agentId: agent.id }));
    stubWorkflow(agent);
    const recover = agent.recover.bind(agent);
    vi.spyOn(agent, 'recover').mockImplementationOnce(async (id, options) => {
      const result = await recover(id, options);
      await options?.onError?.({ error });
      return result;
    });

    const result = await agent.recoverActiveRuns();
    expect(result).toEqual({ recovered: [{ runId, status: 'failed', error }], succeeded: 0, failed: 1 });
    globalRunRegistry.delete(runId);
  });

  it('releases ownership and keeps the snapshot after a transient post-claim reload failure', async () => {
    const runId = 'transient-reload';
    await seed(store, makeSnapshot(runId, 'running', { agentId: agent.id }));
    const workflows = (await store.getStore('workflows'))!;
    const getSnapshot = workflows.getWorkflowRunById.bind(workflows);
    const snapshotSpy = vi.spyOn(workflows, 'getWorkflowRunById').mockImplementation(async args => {
      if (ExecutionFence.getLocalActive(runId)) {
        throw new Error('LOADING Redis is loading the dataset in memory');
      }
      return getSnapshot(args);
    });
    const { restartedRunIds } = stubWorkflow(agent);

    const result = await agent.recoverActiveRuns();
    expect(result.recovered).toEqual([
      { runId, status: 'skipped', reason: 'transient-error', retryAt: expect.any(Number) },
    ]);
    expect(restartedRunIds).toEqual([]);
    expect(ExecutionFence.getLocalActive(runId)).toBeUndefined();
    expect((await workflows.getRunOwnership({ runId }))?.live).toBe(false);
    expect((await getSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId }))?.snapshot).toMatchObject({
      status: 'running',
    });

    snapshotSpy.mockRestore();
    await expect(agent.recoverActiveRuns({ runId })).resolves.toMatchObject({ succeeded: 1, failed: 0 });
    expect(restartedRunIds).toEqual([runId]);
    globalRunRegistry.delete(runId);
  });

  it('returns an empty result when no runs are active', async () => {
    stubWorkflow(agent);
    const result = await agent.recoverActiveRuns();
    expect(result).toEqual({ recovered: [], succeeded: 0, failed: 0 });
  });

  it('restarts every discovered running run for this agent', async () => {
    await seed(store, makeSnapshot('run-1', 'running', { agentId: 'agent-A', threadId: 't-1', resourceId: 'r' }), 'r');
    await seed(store, makeSnapshot('run-2', 'running', { agentId: 'agent-A', threadId: 't-2', resourceId: 'r' }), 'r');
    const { restartedRunIds } = stubWorkflow(agent);

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(2);
    expect(failed).toBe(0);
    expect(restartedRunIds.sort()).toEqual(['run-1', 'run-2']);
    expect(recovered.every(r => r.status === 'success')).toBe(true);
  });

  it('does not restart runs owned by other agents or in suspended / terminal states', async () => {
    await seed(store, makeSnapshot('run-mine', 'running', { agentId: 'agent-A', threadId: 't', resourceId: 'r' }), 'r');
    await seed(
      store,
      makeSnapshot('run-theirs', 'running', { agentId: 'agent-B', threadId: 't', resourceId: 'r' }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-suspended', 'suspended', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-done', 'success', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(1);
    expect(failed).toBe(0);
    expect(restartedRunIds).toEqual(['run-mine']);
    expect(recovered).toEqual([{ runId: 'run-mine', status: 'success' }]);
  });

  it('keeps a run that suspends during recovery registered so it can be resumed (#25891)', async () => {
    await seed(
      store,
      makeSnapshot('run-suspends', 'running', { agentId: 'agent-A', threadId: 't', resourceId: 'r' }),
      'r',
    );
    stubWorkflow(agent, { status: 'suspended' });

    const { succeeded } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(1);
    expect(globalRunRegistry.get('run-suspends')).toBeDefined();
    globalRunRegistry.delete('run-suspends');
  });

  it('cleans up a finished recovered run when cleanupTimeoutMs is 0 (#25891)', async () => {
    const baseAgent = new Agent({ id: 'agent-Z', name: 'agent-Z', instructions: 'x', model: makeMockModel() });
    const zeroStore = new InMemoryStore();
    const zeroAgent =
      engine === 'evented'
        ? new EventedAgent({ agent: baseAgent, cleanupTimeoutMs: 0 })
        : createDurableAgent({ agent: baseAgent, cleanupTimeoutMs: 0 });
    void new Mastra({ agents: { 'agent-Z': zeroAgent as any }, storage: zeroStore });
    await seed(
      zeroStore,
      makeSnapshot('run-done', 'running', { agentId: 'agent-Z', threadId: 't', resourceId: 'r' }),
      'r',
    );
    stubWorkflow(zeroAgent);
    const recover = zeroAgent.recover.bind(zeroAgent);
    let onFinish: (() => void) | undefined;
    vi.spyOn(zeroAgent, 'recover').mockImplementation(async (runId, options) => {
      onFinish = options?.onFinish as () => void;
      return recover(runId, options);
    });

    const { succeeded } = await zeroAgent.recoverActiveRuns();
    expect(succeeded).toBe(1);
    // Stays registered until the terminal event is delivered.
    expect(globalRunRegistry.get('run-done')).toBeDefined();
    onFinish?.();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(globalRunRegistry.get('run-done')).toBeUndefined();
  });

  it('honors discovery filters (threadId)', async () => {
    await seed(
      store,
      makeSnapshot('run-1', 'running', {
        agentId: 'agent-A',
        threadId: 'thread-1',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-2', 'running', {
        agentId: 'agent-A',
        threadId: 'thread-2',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { succeeded } = await agent.recoverActiveRuns({ threadId: 'thread-2' });
    expect(succeeded).toBe(1);
    expect(restartedRunIds).toEqual(['run-2']);
  });

  it('honors discovery filters (resourceId)', async () => {
    await seed(
      store,
      makeSnapshot('run-1', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'resource-1',
      }),
      'resource-1',
    );
    await seed(
      store,
      makeSnapshot('run-2', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'resource-2',
      }),
      'resource-2',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { succeeded } = await agent.recoverActiveRuns({ resourceId: 'resource-2' });
    expect(succeeded).toBe(1);
    expect(restartedRunIds).toEqual(['run-2']);
  });

  it('captures per-run failures without aborting the rest', async () => {
    await seed(
      store,
      makeSnapshot('run-good-1', 'running', {
        agentId: 'agent-A',
        threadId: 't-good-1',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-bad', 'running', {
        agentId: 'agent-A',
        threadId: 't-bad',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-good-2', 'running', {
        agentId: 'agent-A',
        threadId: 't-good-2',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent, { failFor: new Set(['run-bad']) });

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(2);
    expect(failed).toBe(1);
    // All three runs were attempted (no short-circuit on the failure).
    expect(restartedRunIds.sort()).toEqual(['run-bad', 'run-good-1', 'run-good-2']);
    const bad = recovered.find(r => r.runId === 'run-bad');
    expect(bad?.status).toBe('failed');
    expect(bad?.error).toBeInstanceOf(Error);
    expect(bad?.error?.message).toBe('boom-run-bad');
  });

  it('skips a run another execution still owns, with when to check again, and leaves out runs no longer running', async () => {
    for (const id of ['run-live-elsewhere', 'run-orphan', 'run-suspends']) {
      await seed(store, makeSnapshot(id, 'running', { agentId: 'agent-A', threadId: `t-${id}`, resourceId: 'r' }), 'r');
    }
    await seed(
      store,
      makeSnapshot('run-suspended', 'suspended', { agentId: 'agent-A', threadId: 't-suspended', resourceId: 'r' }),
      'r',
    );
    const workflows = (await store.getStore('workflows'))!;
    await workflows.claimRunOwnership({ runId: 'run-live-elsewhere', ownerId: 'other-instance', leaseMs: 30_000 });
    // run-suspends suspends after discovery listed it, before its recovery.
    const listActiveRuns = agent.listActiveRuns.bind(agent);
    vi.spyOn(agent, 'listActiveRuns').mockImplementationOnce(async options => {
      const result = await listActiveRuns(options);
      await seed(
        store,
        makeSnapshot('run-suspends', 'suspended', { agentId: 'agent-A', threadId: 't-run-suspends', resourceId: 'r' }),
        'r',
      );
      return result;
    });
    const { restartedRunIds } = stubWorkflow(agent);
    const before = Date.now();

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();

    expect(restartedRunIds).toEqual(['run-orphan']);
    expect({ succeeded, failed }).toEqual({ succeeded: 1, failed: 0 });
    expect(recovered.map(r => r.runId).sort()).toEqual(['run-live-elsewhere', 'run-orphan']);
    const live = recovered.find(r => r.runId === 'run-live-elsewhere')!;
    expect(live).toMatchObject({ status: 'skipped', reason: 'run-active' });
    expect(live.retryAt).toBeGreaterThanOrEqual(before + 1_000);
    expect(live.retryAt).toBeLessThanOrEqual(Date.now() + 30_000);
    expect((await workflows.getRunOwnership({ runId: 'run-live-elsewhere' }))?.ownerId).toBe('other-instance');

    // An explicit runId, as the boot re-check passes, is held to the same rule.
    await seed(
      store,
      makeSnapshot('run-finished', 'success', { agentId: 'agent-A', threadId: 't-finished', resourceId: 'r' }),
      'r',
    );
    for (const id of ['run-suspended', 'run-finished', 'run-missing']) {
      await expect(agent.recoverActiveRuns({ runId: id })).resolves.toEqual({ recovered: [], succeeded: 0, failed: 0 });
    }
    expect(restartedRunIds).toEqual(['run-orphan']);
  });

  it('replays a boot-recovered run via observe() after recovery finishes (#26433)', async () => {
    const runId = 'run-replay';
    await seed(store, makeSnapshot(runId, 'running', { agentId: 'agent-A', threadId: 't', resourceId: 'r' }), 'r');
    const restart = vi.fn(async () => {
      await emitChunkEvent(agent.pubsub, runId, {
        type: 'text-delta',
        runId,
        from: 'AGENT',
        payload: { text: 'recovered output' },
      } as any);
      await emitFinishEvent(agent.pubsub, runId, {
        output: { text: 'recovered output', steps: [] },
        stepResult: { reason: 'stop' },
      } as any);
      return { status: 'success' as const };
    });
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn(async () => ({ restart, runId })),
      restart,
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);

    const { succeeded } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(1);

    const observed = await agent.observe(runId, { offset: 0, idleTimeoutMs: 2000 });
    const types: string[] = [];
    let text = '';
    for await (const chunk of observed.fullStream as AsyncIterable<any>) {
      types.push(chunk.type);
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    observed.detach();

    expect(types).not.toContain('error');
    expect(types).toContain('finish');
    expect(text).toBe('recovered output');
  });

  it('restarts a specific run when `runId` is given and skips discovery', async () => {
    // Both snapshots are seeded so `recover()` can load the input for either
    // run, but the explicit runId option must prevent `discovered` from being
    // picked up.
    await seed(
      store,
      makeSnapshot('discovered', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('explicit-run', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { succeeded } = await agent.recoverActiveRuns({ runId: 'explicit-run' });
    expect(succeeded).toBe(1);
    // `discovered` must not have been picked up when `runId` is set.
    expect(restartedRunIds).toEqual(['explicit-run']);
  });
});
