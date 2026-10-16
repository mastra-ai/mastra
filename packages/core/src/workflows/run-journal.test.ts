import { fork } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { buildStepResultAccessors, isStepResultStub, RunJournal, stubStepResult } from './run-journal';
import type { WorkflowRunState } from './types';

/** A store that keeps the latest written result per step, so hydrate reads what was written. */
function fakeStore() {
  const stored = new Map<string, unknown>();
  const save = (steps: Record<string, unknown>) => {
    for (const [stepId, result] of Object.entries(steps)) stored.set(stepId, result);
  };
  const writeWorkflowRunCheckpoint = vi.fn(async (args: any) => {
    stored.clear();
    save(args.steps);
  });
  const appendWorkflowRunEntries = vi.fn(async (args: any) => save(args.steps));
  const loadWorkflowRunSteps = vi.fn(async ({ stepIds }: { stepIds: string[] }) =>
    Object.fromEntries(stepIds.filter(id => stored.has(id)).map(id => [id, stored.get(id)])),
  );
  const store = {
    writeWorkflowRunCheckpoint,
    appendWorkflowRunEntries,
    loadWorkflowRunSteps,
  } as unknown as WorkflowsStorage;
  return { store, stored, writeWorkflowRunCheckpoint, appendWorkflowRunEntries, loadWorkflowRunSteps };
}

function journalFor(store: WorkflowsStorage | undefined, seed?: Record<string, unknown>) {
  return new RunJournal({ store, workflowName: 'wf', runId: 'r', seed });
}

function snapshot(context: Record<string, unknown>, status: WorkflowRunState['status'] = 'running') {
  return { runId: 'r', status, value: {}, context } as unknown as WorkflowRunState;
}

const ok = (output: unknown) => ({ status: 'success', output, startedAt: 1, endedAt: 2 }) as any;

const appended = (mock: ReturnType<typeof fakeStore>['appendWorkflowRunEntries'], call: number) => {
  const args = mock.mock.calls[call]![0];
  return { stepIds: Object.keys(args.steps), state: args.state !== undefined };
};

describe('RunJournal writes', () => {
  it('writes a checkpoint first, then appends only the steps whose object changed', async () => {
    const { store, writeWorkflowRunCheckpoint, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store);
    const context: Record<string, unknown> = { input: {}, a: ok(1) };

    await journal.write({ resourceId: 'res', snapshot: snapshot(context) });
    expect(writeWorkflowRunCheckpoint).toHaveBeenCalledTimes(1);
    expect(writeWorkflowRunCheckpoint.mock.calls[0]![0]).toMatchObject({
      workflowName: 'wf',
      runId: 'r',
      resourceId: 'res',
      steps: context,
      state: {},
    });
    expect(writeWorkflowRunCheckpoint.mock.calls[0]![0].header).not.toHaveProperty('context');

    context.b = ok(2);
    await journal.write({ snapshot: snapshot(context) });
    expect(appended(appendWorkflowRunEntries, 0)).toEqual({ stepIds: ['b'], state: false });

    // Same object: nothing to send. A replaced object is sent even if it looks the same.
    await journal.write({ snapshot: snapshot(context) });
    expect(appended(appendWorkflowRunEntries, 1)).toEqual({ stepIds: [], state: false });

    context.a = ok(1);
    await journal.write({ snapshot: snapshot(context) });
    expect(appended(appendWorkflowRunEntries, 2)).toEqual({ stepIds: ['a'], state: false });
    expect(writeWorkflowRunCheckpoint).toHaveBeenCalledTimes(1);
  });

  it('starts from the seed on resume instead of writing a checkpoint', async () => {
    const { store, writeWorkflowRunCheckpoint, appendWorkflowRunEntries } = fakeStore();
    const a = ok(1);
    const journal = journalFor(store, { a, gate: { status: 'suspended' } });

    await journal.write({ snapshot: snapshot({ a, gate: ok(true) }) });
    expect(writeWorkflowRunCheckpoint).not.toHaveBeenCalled();
    expect(appended(appendWorkflowRunEntries, 0)).toEqual({ stepIds: ['gate'], state: false });
  });

  it('writes state only after it was marked, and clears the mark', async () => {
    const { store, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store, {});

    journal.markStateChanged();
    await journal.write({ snapshot: snapshot({}) });
    await journal.write({ snapshot: snapshot({}) });

    expect([appended(appendWorkflowRunEntries, 0).state, appended(appendWorkflowRunEntries, 1).state]).toEqual([
      true,
      false,
    ]);
  });

  it.each(['suspended', 'success', 'failed', 'canceled', 'waiting', 'paused'] as const)(
    'always writes state when the run is %s',
    async status => {
      const { store, appendWorkflowRunEntries } = fakeStore();
      const journal = journalFor(store, {});

      await journal.write({ snapshot: snapshot({}, status) });
      expect(appended(appendWorkflowRunEntries, 0).state).toBe(true);
    },
  );

  it('sends the same changes again after a failed write', async () => {
    const { store, writeWorkflowRunCheckpoint, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store);
    writeWorkflowRunCheckpoint.mockRejectedValueOnce(new Error('down'));

    await expect(journal.write({ snapshot: snapshot({ a: ok(1) }) })).rejects.toThrow('down');
    await journal.write({ snapshot: snapshot({ a: ok(1) }) });
    expect(writeWorkflowRunCheckpoint).toHaveBeenCalledTimes(2);

    const a = ok(2);
    journal.markStateChanged();
    appendWorkflowRunEntries.mockRejectedValueOnce(new Error('down'));
    await expect(journal.write({ snapshot: snapshot({ a }) })).rejects.toThrow('down');
    await journal.write({ snapshot: snapshot({ a }) });
    expect(appended(appendWorkflowRunEntries, 1)).toEqual({ stepIds: ['a'], state: true });
  });

  it('does nothing without a store', async () => {
    const journal = journalFor(undefined);
    const stepResults: Record<string, any> = { a: ok(1) };

    await journal.write({ snapshot: snapshot(stepResults) });
    journal.evict(stepResults, []);
    expect(isStepResultStub(stepResults.a)).toBe(false);
  });

  it('throws on a checkpoint that contains a stub', async () => {
    const { store, writeWorkflowRunCheckpoint } = fakeStore();
    const journal = journalFor(store);

    await expect(journal.write({ snapshot: snapshot({ a: stubStepResult(ok(1)) }) })).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_CHECKPOINT_STUB',
    });
    expect(writeWorkflowRunCheckpoint).not.toHaveBeenCalled();
  });
});

describe('RunJournal.evict', () => {
  it('replaces written successful results with stubs that keep the summary', async () => {
    const { store } = fakeStore();
    const journal = journalFor(store);
    const stepResults: Record<string, any> = { a: { ...ok('big'), metadata: { iterationCount: 3 } } };
    await journal.write({ snapshot: snapshot(stepResults) });

    journal.evict(stepResults, []);
    expect(isStepResultStub(stepResults.a)).toBe(true);
    expect(stepResults.a).toEqual({ status: 'success', startedAt: 1, endedAt: 2, metadata: { iterationCount: 3 } });
  });

  it('skips input, kept steps, non-success, stubs, unwritten and replaced results', async () => {
    const { store } = fakeStore();
    const journal = journalFor(store);
    const stepResults: Record<string, any> = {
      input: { status: 'success', output: 1 },
      kept: ok('kept'),
      suspended: { status: 'suspended', suspendPayload: { x: 1 } },
      failed: { status: 'failed', error: new Error('x') },
      running: { status: 'running', payload: {} },
      replaced: ok('old'),
    };
    await journal.write({ snapshot: snapshot(stepResults) });
    stepResults.replaced = ok('new');
    stepResults.unwritten = ok('unwritten');
    const before = { ...stepResults };

    journal.evict(stepResults, ['kept']);
    expect(stepResults).toEqual(before);
    for (const result of Object.values(stepResults)) expect(isStepResultStub(result)).toBe(false);

    // An existing stub stays the same object.
    const { store: store2 } = fakeStore();
    const journal2 = journalFor(store2);
    const results2: Record<string, any> = { a: ok(1) };
    await journal2.write({ snapshot: snapshot(results2) });
    journal2.evict(results2, []);
    const stub = results2.a;
    journal2.evict(results2, []);
    expect(results2.a).toBe(stub);
  });

  it('sends no stubs on the next write, even from a copy taken before a hydrate', async () => {
    const { store, stored, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store);
    const a = ok('a');
    const stepResults: Record<string, any> = { a };
    await journal.write({ snapshot: snapshot(stepResults) });

    journal.evict(stepResults, []);
    await journal.write({ snapshot: snapshot(stepResults) });
    expect(appended(appendWorkflowRunEntries, 0).stepIds).toEqual([]);

    const copy = { ...stepResults };
    await journal.hydrate(stepResults);
    await journal.write({ snapshot: snapshot(copy) });
    expect(appended(appendWorkflowRunEntries, 1).stepIds).toEqual([]);
    expect(stored.get('a')).toBe(a);
  });

  it('lets an evicted result be garbage collected while the journal is alive', async () => {
    // Isolate forced garbage collection so the test suite does not need to run with --expose-gc.
    const fixture = new URL('./__tests__/fixtures/evicted-step-result-gc.ts', import.meta.url);
    const child = fork(fixture, {
      execArgv: ['--expose-gc', '--import', import.meta.resolve('tsx')],
      silent: true,
    });
    const stderr: Buffer[] = [];
    child.stderr?.on('data', chunk => stderr.push(chunk));
    let completed = false;
    child.on('message', message => {
      if (message === 'ok') completed = true;
    });

    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timeout);
        resolve({ code, signal });
      });
    });

    const diagnostics = Buffer.concat(stderr).toString() || 'child produced no stderr';
    expect({ ...result, completed }, diagnostics).toEqual({ code: 0, signal: null, completed: true });
  }, 20_000);
});

describe('RunJournal.hydrate', () => {
  it('reads only the stubs, with one call, and the next write does not resend them', async () => {
    const { store, loadWorkflowRunSteps, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store);
    const a = ok('a');
    const b = ok('b');
    const stepResults: Record<string, any> = { a, b, c: ok('c') };
    await journal.write({ snapshot: snapshot(stepResults) });
    journal.evict(stepResults, ['c']);

    await journal.hydrate(stepResults);
    expect(loadWorkflowRunSteps).toHaveBeenCalledTimes(1);
    expect(loadWorkflowRunSteps.mock.calls[0]![0]).toEqual({ workflowName: 'wf', runId: 'r', stepIds: ['a', 'b'] });
    expect(stepResults).toEqual({ a, b, c: ok('c') });

    await journal.write({ snapshot: snapshot(stepResults) });
    expect(appended(appendWorkflowRunEntries, 0).stepIds).toEqual([]);

    await journal.hydrate(stepResults);
    expect(loadWorkflowRunSteps).toHaveBeenCalledTimes(1);
  });

  it('keeps a result that changed while the read was in flight', async () => {
    const { store, loadWorkflowRunSteps } = fakeStore();
    const journal = journalFor(store);
    const stepResults: Record<string, any> = { a: ok('a') };
    await journal.write({ snapshot: snapshot(stepResults) });
    journal.evict(stepResults, []);

    const newer = ok('newer');
    loadWorkflowRunSteps.mockImplementationOnce(async () => {
      stepResults.a = newer;
      return { a: ok('a') };
    });
    await journal.hydrate(stepResults);
    expect(stepResults.a).toBe(newer);
  });

  it('throws when an evicted result is no longer stored', async () => {
    const { store, stored } = fakeStore();
    const journal = journalFor(store);
    const stepResults: Record<string, any> = { a: ok('a') };
    await journal.write({ snapshot: snapshot(stepResults) });
    journal.evict(stepResults, []);
    stored.clear();

    await expect(journal.hydrate(stepResults)).rejects.toMatchObject({ id: 'WORKFLOW_STORAGE_V2_STEP_RESULT_MISSING' });
  });
});

describe('RunJournal.getStepResultAsync', () => {
  it('reads storage only for evicted steps, once per entry', async () => {
    const { store, loadWorkflowRunSteps } = fakeStore();
    const journal = journalFor(store);
    const stepResults: Record<string, any> = {
      old: ok('old'),
      resident: ok('resident'),
      failed: { status: 'failed', error: new Error('x') },
    };
    await journal.write({ snapshot: snapshot(stepResults) });
    journal.evict(stepResults, ['resident']);

    expect(await journal.getStepResultAsync(stepResults, 'resident')).toBe('resident');
    expect(await journal.getStepResultAsync(stepResults, 'never-ran')).toBeNull();
    expect(await journal.getStepResultAsync(stepResults, 'failed')).toBeNull();
    expect(loadWorkflowRunSteps).not.toHaveBeenCalled();

    expect(await journal.getStepResultAsync(stepResults, { id: 'old' })).toBe('old');
    expect(await journal.getStepResultAsync(stepResults, 'old')).toBe('old');
    expect(loadWorkflowRunSteps).toHaveBeenCalledTimes(1);
  });
});

describe('isStepResultStub', () => {
  it('is false for a spread or clone of a stub', () => {
    const stub = stubStepResult(ok(1));
    expect(isStepResultStub(stub)).toBe(true);
    expect(isStepResultStub({ ...stub })).toBe(false);
    expect(isStepResultStub(structuredClone(stub))).toBe(false);
    expect(isStepResultStub(ok(1))).toBe(false);
    expect(isStepResultStub(null)).toBe(false);
  });
});

describe('buildStepResultAccessors', () => {
  const stepResults = { a: ok('out') } as any;

  it('binds both accessors to the step results on v1 runs', async () => {
    const accessors = buildStepResultAccessors({ getRunJournal: () => undefined }, 'r', stepResults);
    expect(accessors.getStepResult('a')).toBe('out');
    expect(await accessors.getStepResultAsync('a')).toBe('out');
  });

  it('makes sync getStepResult throw on v2 runs', async () => {
    const journal = journalFor(fakeStore().store);
    const accessors = buildStepResultAccessors({ getRunJournal: () => journal }, 'r', stepResults);
    expect(() => accessors.getStepResult({ id: 'a' })).toThrow(/await getStepResultAsync\("a"\)/);
    expect(await accessors.getStepResultAsync('a')).toBe('out');
  });
});
