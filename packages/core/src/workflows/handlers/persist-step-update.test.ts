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

function makeEngine(shouldPersistSnapshot: (params: { workflowStatus: WorkflowRunStatus }) => boolean) {
  const { mastra, store } = makeFakeMastra();
  const engine = new DefaultExecutionEngine({
    mastra,
    options: {
      validateInputs: false,
      shouldPersistSnapshot: shouldPersistSnapshot as any,
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
});
