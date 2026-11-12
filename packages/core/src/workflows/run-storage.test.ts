import { describe, expect, it } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { WorkflowsInMemory } from '../storage/domains/workflows/inmemory';
import { createRunStorage } from './run-storage';
import type { WorkflowRunState } from './types';

const ok = (output: unknown) => ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 }) as any;
const set = (key: string, value: unknown) => ({ op: 'set' as const, path: [key], value });

function snapshot(overrides: Record<string, any> = {}): WorkflowRunState {
  return {
    runId: 'r',
    status: 'running',
    value: {},
    context: { input: {} },
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: 1,
    ...overrides,
  } as WorkflowRunState;
}

function storageFor(storageVersion: 1 | 2) {
  const store = new WorkflowsInMemory({ db: new InMemoryDB() });
  const runStorage = createRunStorage({ storageVersion, workflowName: 'wf', runId: 'r', getStore: async () => store });
  return { store, runStorage };
}

const requestContext = {};

describe('RunStorage on storage v2', () => {
  it('loads the resource id from the header', async () => {
    const { runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot(), 'res');
    expect(await runStorage.loadResourceId()).toBe('res');
  });

  it('loads the header with only the asked step', async () => {
    const { runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot({ status: 'suspended', context: { input: {}, a: ok(1), b: ok(2) } }));

    const loaded = await runStorage.loadStep('a');
    expect(loaded?.status).toBe('suspended');
    expect(loaded?.context).toEqual({ a: ok(1) });
    expect(await createRunStorage({ ...args(), runId: 'missing' }).loadStep('a')).toBeNull();
  });

  it('loads steps as of the write that returned `upToSeq`', async () => {
    const { runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot());
    const first = await runStorage.writeStepResult({ stepId: 'a', result: ok(1), requestContext });
    await runStorage.writeStepResult({ stepId: 'a', result: ok(2), requestContext });
    await runStorage.writeStepResult({ stepId: 'b', result: ok(3), requestContext });

    expect(await runStorage.loadSteps(['a', 'b'], { upToSeq: first!.seq })).toEqual({ a: ok(1) });
    expect(await runStorage.loadSteps(['a', 'b'])).toEqual({ a: ok(2), b: ok(3) });
  });

  it('writes a step result with a state patch, keeping keys concurrent writers set', async () => {
    const { runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot({ value: { kept: true } }));

    const [a, b] = await Promise.all([
      runStorage.writeStepResult({ stepId: 'a', result: ok(1), requestContext, statePatch: [set('a', 1)] }),
      runStorage.writeStepResult({ stepId: 'b', result: ok(2), requestContext, statePatch: [set('b', 2)] }),
    ]);

    expect(a).toEqual({ results: { a: ok(1) }, seq: expect.any(Number) });
    expect(b).toEqual({ results: { b: ok(2) }, seq: expect.any(Number) });
    expect(await runStorage.loadState()).toEqual({ kept: true, a: 1, b: 2 });
    expect(await runStorage.loadState(['a'])).toEqual({ a: 1 });
  });

  it('merges concurrent foreach writes by index', async () => {
    const { runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot({ context: { input: {}, each: ok([null, null]) } }));

    await Promise.all([
      runStorage.mergeStepResult({ stepId: 'each', result: ok([1, null]), requestContext, statePatch: [set('x', 1)] }),
      runStorage.mergeStepResult({ stepId: 'each', result: ok([null, 2]), requestContext, statePatch: [set('y', 2)] }),
    ]);
    const last = await runStorage.mergeStepResult({ stepId: 'each', result: ok([1, null]), requestContext });

    expect((last?.results.each as any)?.output).toEqual([1, 2]);
    expect(await runStorage.loadSteps(['each'])).toEqual({ each: last!.results.each });
    expect(await runStorage.loadState()).toEqual({ x: 1, y: 2 });
  });

  it('writes a state patch without a step, and nothing for an empty one', async () => {
    const { store, runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot({ value: { n: 1 } }));
    const header = () => store.loadWorkflowRunHeader({ workflowName: 'wf', runId: 'r' });

    await runStorage.writeState({ statePatch: [set('n', 2)], requestContext });
    const { lastSeq } = (await header())!;
    await runStorage.writeState({ statePatch: [], requestContext });

    expect(await runStorage.loadState()).toEqual({ n: 2 });
    expect((await header())!.lastSeq).toBe(lastSeq);
  });

  it('returns no results for a run that isn’t stored, and nothing without a store', async () => {
    const { runStorage } = storageFor(2);
    expect(await runStorage.writeStepResult({ stepId: 'a', result: ok(1), requestContext })).toEqual({ results: {} });
    expect(await runStorage.mergeStepResult({ stepId: 'a', result: ok([1]), requestContext })).toEqual({ results: {} });
    expect(await runStorage.loadState()).toEqual({});

    const storeless = createRunStorage({ ...args(), getStore: async () => undefined });
    expect(await storeless.writeStepResult({ stepId: 'a', result: ok(1), requestContext })).toBeUndefined();
    expect(await storeless.mergeStepResult({ stepId: 'a', result: ok(1), requestContext })).toBeUndefined();
  });

  it('rejects a whole state, which would drop keys concurrent writers set', async () => {
    const { runStorage } = storageFor(2);
    await expect(
      runStorage.writeStepResult({ stepId: 'a', result: ok(1), requestContext, state: { n: 1 } }),
    ).rejects.toThrow('patch');
    await expect(runStorage.mergeStepResult({ stepId: 'a', result: ok(1), requestContext, state: {} })).rejects.toThrow(
      'patch',
    );
    await expect(runStorage.writeState({ state: { n: 1 }, requestContext })).rejects.toThrow('patch');
  });

  it('deletes the run', async () => {
    const { runStorage } = storageFor(2);
    await runStorage.writeSnapshot(snapshot());
    await runStorage.delete();
    expect(await runStorage.loadHeader()).toBeNull();
  });
});

describe('RunStorage on storage v1', () => {
  it('writes the whole state, returning every step’s result', async () => {
    const { runStorage } = storageFor(1);
    await runStorage.writeSnapshot(snapshot({ context: { input: {}, a: ok(1) } }));

    const written = await runStorage.writeStepResult({ stepId: 'b', result: ok(2), requestContext, state: { n: 1 } });
    expect(written?.results).toMatchObject({ a: ok(1), b: ok(2) });
    expect(await runStorage.loadSteps(['b', 'missing'])).toEqual({ b: ok(2) });
    expect(await runStorage.loadState()).toEqual({ n: 1 });

    await runStorage.writeState({ state: { n: 2, m: 3 }, requestContext });
    expect(await runStorage.loadState(['n'])).toEqual({ n: 2 });
  });

  it('rejects a state patch', async () => {
    const { runStorage } = storageFor(1);
    await expect(
      runStorage.writeStepResult({ stepId: 'a', result: ok(1), requestContext, statePatch: [set('n', 1)] }),
    ).rejects.toThrow('whole state');
    await expect(runStorage.writeState({ statePatch: [set('n', 1)], requestContext })).rejects.toThrow('whole state');
  });
});

function args() {
  const store = new WorkflowsInMemory({ db: new InMemoryDB() });
  return { storageVersion: 2 as const, workflowName: 'wf', runId: 'r', getStore: async () => store };
}
