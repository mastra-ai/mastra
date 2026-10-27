import { fork } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { WorkflowsInMemory } from '../storage/domains/workflows/inmemory';
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

/** A seeded journal continues a run whose stored state is `{}`, unless `state` says otherwise. */
function journalFor(store: WorkflowsStorage | undefined, seed?: Record<string, unknown>, state = seed && {}) {
  return new RunJournal({ store, workflowName: 'wf', runId: 'r', seed, state });
}

function snapshot(
  context: Record<string, unknown>,
  status: WorkflowRunState['status'] = 'running',
  value: Record<string, unknown> = {},
) {
  return { runId: 'r', status, value, context } as unknown as WorkflowRunState;
}

const ok = (output: unknown) => ({ status: 'success', output, startedAt: 1, endedAt: 2 }) as any;

const appended = (mock: ReturnType<typeof fakeStore>['appendWorkflowRunEntries'], call: number) => {
  const args = mock.mock.calls[call]![0];
  return { stepIds: Object.keys(args.steps), state: args.state !== undefined || args.statePatch !== undefined };
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

  it('sends only the named steps on an overlapping write, never the state, and the rest on the next boundary', async () => {
    const { store, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store, {});
    const context: Record<string, unknown> = { a: ok(1), b: ok(2) };
    const state = { x: 1 };

    await journal.write({ snapshot: snapshot(context, 'running', state), stepIds: ['a'] });
    expect(appended(appendWorkflowRunEntries, 0)).toEqual({ stepIds: ['a'], state: false });

    // Nothing named changed: no call at all.
    await journal.write({ snapshot: snapshot(context, 'running', state), stepIds: ['a'] });
    await journal.write({ snapshot: snapshot(context, 'running', state), stepIds: [] });
    expect(appendWorkflowRunEntries).toHaveBeenCalledTimes(1);

    await journal.write({ snapshot: snapshot(context, 'running', state) });
    expect(appended(appendWorkflowRunEntries, 1)).toEqual({ stepIds: ['b'], state: true });
  });

  it('drops overlapping writes until a boundary write has written the checkpoint', async () => {
    const { store, writeWorkflowRunCheckpoint, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store);
    const context: Record<string, unknown> = { input: {}, a: ok(1) };

    await journal.write({ snapshot: snapshot(context), stepIds: ['a'] });
    expect(writeWorkflowRunCheckpoint).not.toHaveBeenCalled();
    expect(appendWorkflowRunEntries).not.toHaveBeenCalled();

    await journal.write({ snapshot: snapshot(context) });
    expect(writeWorkflowRunCheckpoint.mock.calls[0]![0].steps).toEqual(context);

    context.b = ok(2);
    await journal.write({ snapshot: snapshot(context), stepIds: ['b'] });
    expect(appended(appendWorkflowRunEntries, 0)).toEqual({ stepIds: ['b'], state: false });
  });

  it('sends the same changes again after a failed write', async () => {
    const { store, writeWorkflowRunCheckpoint, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store);
    const state: Record<string, unknown> = { big: 'x'.repeat(100) };
    writeWorkflowRunCheckpoint.mockRejectedValueOnce(new Error('down'));

    await expect(journal.write({ snapshot: snapshot({ a: ok(1) }, 'running', state) })).rejects.toThrow('down');
    await journal.write({ snapshot: snapshot({ a: ok(1) }, 'running', state) });
    expect(writeWorkflowRunCheckpoint).toHaveBeenCalledTimes(2);

    const a = ok(2);
    state.n = 1;
    appendWorkflowRunEntries.mockRejectedValueOnce(new Error('down'));
    await expect(journal.write({ snapshot: snapshot({ a }, 'running', state) })).rejects.toThrow('down');
    await journal.write({ snapshot: snapshot({ a }, 'running', state) });
    expect(appended(appendWorkflowRunEntries, 1)).toEqual({ stepIds: ['a'], state: true });
    expect(appendWorkflowRunEntries.mock.calls[1]![0].statePatch).toEqual([{ op: 'set', path: ['n'], value: 1 }]);
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

  it('throws on a write that overlaps a boundary write, and lets named writes overlap each other', async () => {
    const { store, appendWorkflowRunEntries } = fakeStore();
    const journal = journalFor(store, {});
    let release!: () => void;
    appendWorkflowRunEntries.mockImplementation(() => new Promise<void>(resolve => (release = resolve)));
    const context: Record<string, unknown> = { a: ok(1), b: ok(2) };

    // Two start writes in flight together.
    const a = journal.write({ snapshot: snapshot(context), stepIds: ['a'] });
    const releaseA = release;
    const b = journal.write({ snapshot: snapshot(context), stepIds: ['b'] });
    const releaseB = release;
    await expect(journal.write({ snapshot: snapshot(context) })).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_OVERLAPPING_WRITE',
    });
    releaseA();
    releaseB();
    await Promise.all([a, b]);

    context.c = ok(3);
    const boundary = journal.write({ snapshot: snapshot(context) });
    context.d = ok(4);
    await expect(journal.write({ snapshot: snapshot(context), stepIds: ['d'] })).rejects.toMatchObject({
      id: 'WORKFLOW_STORAGE_V2_OVERLAPPING_WRITE',
    });
    release();
    await boundary;

    // Settled writes, failed ones included, no longer count.
    appendWorkflowRunEntries.mockRejectedValueOnce(new Error('down'));
    await expect(journal.write({ snapshot: snapshot(context), stepIds: ['d'] })).rejects.toThrow('down');
    appendWorkflowRunEntries.mockImplementation(async () => {});
    await journal.write({ snapshot: snapshot(context) });
    expect(appended(appendWorkflowRunEntries, 4)).toEqual({ stepIds: ['d'], state: false });
  });
});

describe('RunJournal state writes', () => {
  const run = { workflowName: 'wf', runId: 'r' };
  const kb = (i: number) => String(i % 10).repeat(1024);
  const stateArgs = (mock: ReturnType<typeof fakeStore>['appendWorkflowRunEntries']) =>
    mock.mock.calls.map(([args]) => (args.state ? 'state' : args.statePatch ? 'patch' : 'none'));

  /** The run as the in-memory store holds it, and the JSON size of its patches after the latest full state. */
  async function stored(store: WorkflowsInMemory) {
    const loaded = (await store.loadWorkflowRun({ ...run, successfulSteps: 'full' }))!;
    return {
      state: loaded.state,
      statePatchBytes: loaded.statePatchBytes,
      storedState: { seq: loaded.lastSeq, patchBytes: loaded.statePatchBytes },
    };
  }

  it.each(['running', 'suspended', 'success', 'failed', 'canceled', 'waiting', 'paused'] as const)(
    'sends nothing for an unchanged state when the run is %s',
    async status => {
      const { store, appendWorkflowRunEntries } = fakeStore();
      const journal = journalFor(store, {}, { a: 1 });

      await journal.write({ snapshot: snapshot({}, status, { a: 1 }) });
      expect(appended(appendWorkflowRunEntries, 0).state).toBe(false);
    },
  );

  it('writes an in-place edit made without setState with the next boundary write', async () => {
    const { store, appendWorkflowRunEntries } = fakeStore();
    const state = { items: ['x'.repeat(100)] };
    const journal = journalFor(store, {}, structuredClone(state));

    state.items.push('b');
    await journal.write({ snapshot: snapshot({}, 'running', state), stepIds: [] });
    expect(appendWorkflowRunEntries).not.toHaveBeenCalled();
    await journal.write({ snapshot: snapshot({}, 'running', state) });
    expect(appendWorkflowRunEntries.mock.calls[0]![0].statePatch).toEqual([
      { op: 'set', path: ['items', 1], value: 'b' },
    ]);

    // The diff is against what was written, not the live object.
    state.items[1] = 'c';
    await journal.write({ snapshot: snapshot({}, 'running', state) });
    expect(appendWorkflowRunEntries.mock.calls[1]![0].statePatch).toEqual([
      { op: 'set', path: ['items', 1], value: 'c' },
    ]);
  });

  it('writes the state as a store keeps JSON, so a Date becomes its ISO string', async () => {
    const { store, writeWorkflowRunCheckpoint } = fakeStore();
    const journal = journalFor(store);
    const at = new Date(0);

    await journal.write({ snapshot: snapshot({}, 'running', { at, gone: undefined }) });
    expect(writeWorkflowRunCheckpoint.mock.calls[0]![0].state).toStrictEqual({ at: at.toISOString() });
  });

  it('writes a full state once the patches since the latest full state outgrow it', async () => {
    const { store, appendWorkflowRunEntries } = fakeStore();
    const state: Record<string, unknown> = { a: kb(0), b: kb(0), c: kb(0) };
    const journal = journalFor(store, {}, structuredClone(state));

    for (let i = 1; i <= 20; i++) {
      state.a = kb(i);
      await journal.write({ snapshot: snapshot({}, 'running', state) });
    }
    // Each overwrite is about a third of the state, so every third write starts over.
    expect(stateArgs(appendWorkflowRunEntries)).toEqual(
      Array.from({ length: 20 }, (_, i) => (i % 3 === 2 ? 'state' : 'patch')),
    );
  });

  it('keeps the patches after the latest full state within the state size, over runs of overwrites', async () => {
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    const state: Record<string, unknown> = { a: kb(0), b: kb(0), c: kb(0), d: kb(0) };
    const size = JSON.stringify(state).length;
    let journal = new RunJournal({ store: memory, ...run });
    await journal.write({ snapshot: snapshot({}, 'running', state) });

    for (let i = 1; i <= 40; i++) {
      state.a = kb(i);
      await journal.write({ snapshot: snapshot({}, 'running', state) });
      const now = await stored(memory);
      expect(now.state).toEqual(state);
      expect(now.statePatchBytes).toBeLessThanOrEqual(size);
      // A resume or restart every other write continues from what the store reports.
      if (i % 2 === 0) {
        journal = new RunJournal({ store: memory, ...run, seed: {}, state: now.state, storedState: now.storedState });
      }
    }
  });

  it('does not double the state when replaying patches onto a state that has them', async () => {
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    const state = { items: [] as string[] };
    const journal = new RunJournal({ store: memory, ...run });
    await journal.write({ snapshot: snapshot({}, 'running', state) });
    for (let i = 0; i < 5; i++) {
      state.items.push(kb(i));
      await journal.write({ snapshot: snapshot({}, 'running', state) });
    }
    expect((await stored(memory)).state).toEqual(state);
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
