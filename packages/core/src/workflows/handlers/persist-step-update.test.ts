/**
 * Tests for the persistence guard added to `persistStepUpdate` (issue #19056).
 *
 * The guard's job: never overwrite a `suspended` / `paused` snapshot with a
 * later `running` update from the same run in the same process. It relies on
 * `DefaultExecutionEngine.lastPersistedStatusByRun` as a process-local
 * memory of the previous write.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../di';
import { DefaultExecutionEngine } from '../default';
import type { ExecutionContext, WorkflowRunStatus } from '../types';

type PersistArgs = Parameters<Awaited<ReturnType<typeof getStore>>['persistWorkflowSnapshot']>[0];

describe('foreach snapshot write budget', () => {
  const write = (engine: DefaultExecutionEngine, runId: string, output: string) =>
    engine.persistStepUpdate({
      workflowId: 'wf',
      runId,
      stepResults: {
        item: { status: 'running', startedAt: 1, payload: output },
      },
      serializedStepGraph: [],
      executionContext: baseExecutionContext({ runId, foreachIndex: 0 }),
      workflowStatus: 'running',
      requestContext: new RequestContext(),
    });

  it('enforces the default budget across concurrent writes using UTF-8 bytes', async () => {
    const { engine, store } = makeEngine(() => true);
    const attempts = await Promise.allSettled(
      Array.from({ length: 100 }, () => write(engine, 'run-1', '\u00e9'.repeat(128 * 1024))),
    );
    const bytes = store.calls.reduce((total, call) => total + Buffer.byteLength(JSON.stringify(call.snapshot)), 0);
    expect(bytes).toBeLessThanOrEqual(16 * 1024 * 1024);
    expect(bytes).toBeGreaterThan(15 * 1024 * 1024);
    expect(attempts.some(result => result.status === 'rejected')).toBe(true);
    expect(store.calls.length).toBe(attempts.filter(result => result.status === 'fulfilled').length);
  });

  it('isolates runs and releases the budget after terminal cleanup', async () => {
    const { engine, store } = makeEngine(() => true);
    engine.options.maxForeachCheckpointBytes = 2048;
    await write(engine, 'run-1', 'x'.repeat(1024));
    await expect(write(engine, 'run-1', 'x'.repeat(1024))).rejects.toThrow('checkpoint budget exceeded');
    await write(engine, 'run-2', 'x'.repeat(1024));
    await persist(engine, 'run-1', 'failed');
    engine.clearLastPersistedStatus('run-1');
    await write(engine, 'run-1', 'x'.repeat(1024));
    expect(store.calls.map(call => call.runId)).toEqual(['run-1', 'run-2', 'run-1', 'run-1']);
  });

  it('charges the pruned snapshot and leaves skipped writes outside the budget', async () => {
    const { engine, store } = makeEngine(() => false);
    engine.options.maxForeachCheckpointBytes = 2048;
    await write(engine, 'run-1', 'x'.repeat(4096));
    engine.options.shouldPersistSnapshot = () => true;
    engine.options.pruneSnapshot = ({ snapshot }) => ({ ...snapshot, context: {} });
    await write(engine, 'run-1', 'x'.repeat(4096));
    expect(store.calls).toHaveLength(1);
    expect(store.calls[0]!.snapshot.context).toEqual({});
  });

  it.each([0, -1, NaN, Infinity, 1.5])('rejects an invalid budget of %s before writing', async limit => {
    const { engine, store } = makeEngine(() => true);
    engine.options.maxForeachCheckpointBytes = limit;
    await expect(write(engine, 'run-1', 'output')).rejects.toThrow('positive safe integer');
    expect(store.calls).toHaveLength(0);
  });

  it('does not refund ambiguous storage failures', async () => {
    const { engine, store } = makeEngine(() => true);
    engine.options.maxForeachCheckpointBytes = 2048;
    vi.mocked(store.persistWorkflowSnapshot).mockRejectedValueOnce(new Error('connection lost after commit'));
    await expect(write(engine, 'run-1', 'x'.repeat(1024))).rejects.toThrow('connection lost');
    await expect(write(engine, 'run-1', 'x'.repeat(1024))).rejects.toThrow('checkpoint budget exceeded');
    expect(store.persistWorkflowSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not prune or charge snapshots when no storage is configured', async () => {
    const pruneSnapshot = vi.fn(({ snapshot }) => snapshot);
    const engine = new DefaultExecutionEngine({
      options: {
        validateInputs: false,
        shouldPersistSnapshot: () => true,
        maxForeachCheckpointBytes: 1,
        pruneSnapshot,
      },
    });
    await write(engine, 'run-1', 'output');
    expect(pruneSnapshot).not.toHaveBeenCalled();
  });

  it.each([null, undefined, { status: 'running', suspendPayload: { __workflow_meta: { foreachOutput: [] } } }])(
    'does not interpret workflow input or state as a foreach result (%j)',
    async input => {
      const { engine, store } = makeEngine(() => true);
      engine.options.maxForeachCheckpointBytes = 1;
      await engine.persistStepUpdate({
        workflowId: 'wf',
        runId: 'run-1',
        stepResults: { input, __state: input } as any,
        serializedStepGraph: [],
        executionContext: baseExecutionContext(),
        workflowStatus: 'running',
        requestContext: new RequestContext(),
      });
      expect(store.calls).toHaveLength(1);
    },
  );
});

interface FakeWorkflowsStore {
  persistWorkflowSnapshot: (args: PersistArgs) => Promise<void>;
  calls: PersistArgs[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getStore() {
  return {
    persistWorkflowSnapshot: async (_args: { snapshot: any; runId: string; workflowName: string }) => {},
  };
}

function makeFakeMastra() {
  const store: FakeWorkflowsStore = {
    calls: [],
    persistWorkflowSnapshot: vi.fn(async args => {
      store.calls.push(args);
    }) as any,
  };
  const mastra = {
    getStorage: () => ({
      getStore: async (_name: string) => store,
    }),
  } as any;
  return { mastra, store };
}

function makeEngine(
  shouldPersistSnapshot: (params: { workflowStatus: WorkflowRunStatus }) => boolean,
  options: { evaluatePersistencePredicateBeforeDurableOperation?: boolean } = {},
) {
  const { mastra, store } = makeFakeMastra();
  const engine = new DefaultExecutionEngine({
    mastra,
    options: {
      validateInputs: false,
      shouldPersistSnapshot: shouldPersistSnapshot as any,
      ...options,
    },
  });
  return { engine, store };
}

function baseExecutionContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    workflowId: 'wf',
    runId: 'run-1',
    executionPath: [0],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    retryConfig: { attempts: 0, delay: 0 },
    state: {},
    ...overrides,
  };
}

async function persist(
  engine: DefaultExecutionEngine,
  runId: string,
  workflowStatus: WorkflowRunStatus,
  serializedStepGraph: any[] = [],
) {
  await engine.persistStepUpdate({
    workflowId: 'wf',
    runId,
    resourceId: 'resource-1',
    stepResults: {},
    serializedStepGraph,
    executionContext: baseExecutionContext({ runId }),
    workflowStatus,
    requestContext: new RequestContext(),
  });
}

describe('persistStepUpdate — suspended overwrite guard', () => {
  let engine: DefaultExecutionEngine;
  let store: FakeWorkflowsStore;

  beforeEach(() => {
    // Opt into `running` persists — matches the durable-agent policy,
    // plus terminal statuses which are always persisted in production.
    ({ engine, store } = makeEngine(({ workflowStatus }) =>
      ['pending', 'paused', 'suspended', 'running', 'success', 'failed'].includes(workflowStatus),
    ));
  });

  it('persists a running snapshot when the last persisted status was pending', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'running');

    expect(store.calls).toHaveLength(2);
    expect(store.calls[0]!.snapshot.status).toBe('pending');
    expect(store.calls[1]!.snapshot.status).toBe('running');
    expect(engine.getLastPersistedStatus('run-1')).toBe('running');
  });

  it('persists successive running snapshots', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'running');
    await persist(engine, 'run-1', 'running');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending', 'running', 'running']);
  });

  it('persists a suspended snapshot after running (normal suspend)', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'running');
    await persist(engine, 'run-1', 'suspended');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending', 'running', 'suspended']);
    expect(engine.getLastPersistedStatus('run-1')).toBe('suspended');
  });

  it('SKIPS a running snapshot when the last persisted status was suspended', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'running');
    await persist(engine, 'run-1', 'suspended');

    // Simulate a resume: engine ticks running mid-resume — must not clobber the suspended row.
    await persist(engine, 'run-1', 'running');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending', 'running', 'suspended']);
    expect(engine.getLastPersistedStatus('run-1')).toBe('suspended');
  });

  it('SKIPS a running snapshot when the last persisted status was paused', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'paused');
    await persist(engine, 'run-1', 'running');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending', 'paused']);
    expect(engine.getLastPersistedStatus('run-1')).toBe('paused');
  });

  it('allows a suspended → suspended re-suspend write', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'suspended');
    await persist(engine, 'run-1', 'suspended');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending', 'suspended', 'suspended']);
  });

  it('allows terminal statuses to be persisted even after suspended', async () => {
    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'suspended');
    await persist(engine, 'run-1', 'success');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending', 'suspended', 'success']);
  });

  it('tracks runs independently by runId', async () => {
    await persist(engine, 'run-A', 'pending');
    await persist(engine, 'run-A', 'suspended');
    // Different run — must not be blocked by run-A's suspended entry.
    await persist(engine, 'run-B', 'pending');
    await persist(engine, 'run-B', 'running');

    expect(store.calls.map(c => `${c.runId}:${c.snapshot.status}`)).toEqual([
      'run-A:pending',
      'run-A:suspended',
      'run-B:pending',
      'run-B:running',
    ]);
    expect(engine.getLastPersistedStatus('run-A')).toBe('suspended');
    expect(engine.getLastPersistedStatus('run-B')).toBe('running');
  });

  it('respects shouldPersistSnapshot returning false regardless of cache', async () => {
    // Legacy policy that refuses to persist running at all.
    ({ engine, store } = makeEngine(({ workflowStatus }) =>
      ['pending', 'paused', 'suspended'].includes(workflowStatus),
    ));

    await persist(engine, 'run-1', 'pending');
    await persist(engine, 'run-1', 'running');

    expect(store.calls.map(c => c.snapshot.status)).toEqual(['pending']);
    // No running snapshot means the tracker was never updated past pending.
    expect(engine.getLastPersistedStatus('run-1')).toBe('pending');
  });
});

describe('DefaultExecutionEngine — lastPersistedStatus accessors', () => {
  function makeBareEngine() {
    return new DefaultExecutionEngine({
      mastra: undefined,
      options: {
        validateInputs: false,
        shouldPersistSnapshot: () => true,
      },
    });
  }

  it('returns undefined for an unknown run', () => {
    const engine = makeBareEngine();
    expect(engine.getLastPersistedStatus('nope')).toBeUndefined();
  });

  it('records and clears status via public accessors', () => {
    const engine = makeBareEngine();
    engine.setLastPersistedStatus('run-1', 'running');
    expect(engine.getLastPersistedStatus('run-1')).toBe('running');
    engine.clearLastPersistedStatus('run-1');
    expect(engine.getLastPersistedStatus('run-1')).toBeUndefined();
  });

  // Regression guard for issue #19056: the execute loop must clear the
  // last-persisted-status tracker on early terminal exits (failed, canceled,
  // tripwire) so the process-local map does not grow unbounded across many
  // runs. Suspended and paused runs deliberately keep their entry so a
  // subsequent resume in the same process still refuses to overwrite them
  // with `running` mid-resume.
  it.each(['failed', 'canceled', 'success'] as const)(
    'clearLastPersistedStatus removes the tracker for %s terminal exits',
    status => {
      const engine = makeBareEngine();
      engine.setLastPersistedStatus('run-1', status as WorkflowRunStatus);
      engine.clearLastPersistedStatus('run-1');
      expect(engine.getLastPersistedStatus('run-1')).toBeUndefined();
    },
  );

  it('keeps the tracker for suspended so resume cannot clobber it', () => {
    const engine = makeBareEngine();
    engine.setLastPersistedStatus('run-1', 'suspended');
    // Execute loop deliberately does NOT clear on suspended.
    expect(engine.getLastPersistedStatus('run-1')).toBe('suspended');
  });
});

describe('persistStepUpdate — durable predicate evaluation', () => {
  it('enters a durable operation when the snapshot predicate declines', async () => {
    const { engine, store } = makeEngine(({ workflowStatus }) => workflowStatus === 'suspended');
    const wrapSpy = vi.spyOn(engine, 'wrapDurableOperation');

    await persist(engine, 'run-1', 'running');

    expect(wrapSpy).toHaveBeenCalledTimes(1);
    expect(store.calls).toHaveLength(0);
  });

  it('enters a durable operation when the snapshot predicate accepts', async () => {
    const { engine, store } = makeEngine(({ workflowStatus }) => workflowStatus === 'suspended');
    const wrapSpy = vi.spyOn(engine, 'wrapDurableOperation');

    await persist(engine, 'run-1', 'suspended');

    expect(wrapSpy).toHaveBeenCalledTimes(1);
    expect(store.calls).toHaveLength(1);
  });

  it('reuses the memoized predicate verdict during replay', async () => {
    const predicate = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { engine, store } = makeEngine(predicate);
    const results = new Map<string, unknown>();

    vi.spyOn(engine, 'wrapDurableOperation').mockImplementation(async (operationId, operationFn) => {
      if (results.has(operationId)) {
        return results.get(operationId) as any;
      }
      const result = await operationFn();
      results.set(operationId, result);
      return result;
    });

    await persist(engine, 'run-1', 'running');
    await persist(engine, 'run-1', 'running');

    expect(predicate).toHaveBeenCalledTimes(1);
    expect(store.calls).toHaveLength(0);
  });

  it('skips the durable operation for an opted-in deterministic predicate that declines', async () => {
    const predicate = vi.fn(() => false);
    const { engine, store } = makeEngine(predicate, {
      evaluatePersistencePredicateBeforeDurableOperation: true,
    });
    const wrapSpy = vi.spyOn(engine, 'wrapDurableOperation');

    await persist(engine, 'run-1', 'running');

    expect(predicate).toHaveBeenCalledTimes(1);
    expect(wrapSpy).not.toHaveBeenCalled();
    expect(store.calls).toHaveLength(0);
  });

  it('keeps run-scoped predicate overrides inside the durable operation', async () => {
    const workflowPredicate = vi.fn(() => false);
    const runPredicate = vi.fn(() => false);
    const { engine, store } = makeEngine(workflowPredicate, {
      evaluatePersistencePredicateBeforeDurableOperation: true,
    });
    engine.setRunPersistenceOverride('run-1', runPredicate as any);
    const wrapSpy = vi.spyOn(engine, 'wrapDurableOperation');

    await persist(engine, 'run-1', 'running');

    expect(workflowPredicate).not.toHaveBeenCalled();
    expect(runPredicate).toHaveBeenCalledTimes(1);
    expect(wrapSpy).toHaveBeenCalledTimes(1);
    expect(store.calls).toHaveLength(0);
  });
});

describe('onStepExecutionStart — durable operation skipping (#24731)', () => {
  function startParams(skipEmits: boolean) {
    const pubsub = { publish: vi.fn(async () => {}) } as any;
    return {
      pubsub,
      params: {
        step: { id: 'step-1' } as any,
        inputData: {},
        pubsub,
        executionContext: baseExecutionContext(),
        stepCallId: 'call-1',
        stepInfo: {},
        operationId: 'op',
        skipEmits,
      },
    };
  }

  it('returns a timestamp without a durable operation when emits are skipped', async () => {
    const { engine } = makeEngine(() => false);
    const wrapSpy = vi.spyOn(engine, 'wrapDurableOperation');
    const { params, pubsub } = startParams(true);

    const startedAt = await engine.onStepExecutionStart(params);

    expect(typeof startedAt).toBe('number');
    expect(wrapSpy).not.toHaveBeenCalled();
    expect(pubsub.publish).not.toHaveBeenCalled();
  });

  it('publishes inside a durable operation when emits are enabled', async () => {
    const { engine } = makeEngine(() => false);
    const wrapSpy = vi.spyOn(engine, 'wrapDurableOperation');
    const { params, pubsub } = startParams(false);

    await engine.onStepExecutionStart(params);

    expect(wrapSpy).toHaveBeenCalledTimes(1);
    expect(pubsub.publish).toHaveBeenCalledTimes(1);
  });
});
