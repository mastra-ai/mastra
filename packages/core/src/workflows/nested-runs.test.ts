/**
 * Nested workflow runs and the parent state they share: what the parent stores while a nested
 * run is in flight, which changes a nested run hands back when it finishes next to other steps,
 * and how a nested run is restarted after its process died.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { cloneRunData } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';
import type { AnyWorkflow } from './workflow';

// These tests leave runs as a crash does, written just now; a zero grace lets recovery restart them at once.
const stopped = { workflowGraceMs: 0 };

const num = z.object({ n: z.number() });
const items = z.object({ items: z.array(z.string()) });

/** Appends `<id>:<n>` to `state.items` after `onRun`; with `suspends`, only once resumed. */
function appendItem(id: string, { suspends = false, onRun }: { suspends?: boolean; onRun?: () => unknown } = {}) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    stateSchema: items,
    resumeSchema: z.boolean(),
    execute: async ({ inputData, state, setState, resumeData, suspend }) => {
      if (suspends && resumeData === undefined) return suspend({});
      await onRun?.();
      await setState({ items: [...state.items, `${id}:${inputData.n}`] });
      return { n: inputData.n + 1 };
    },
  });
}

/** A dead process stops renewing its run ownership leases; let them lapse so another process can restart its runs. */
async function expireRunLeases(storage: InstanceType<typeof MockStore>) {
  const store = storage.stores.workflows!;
  for (const runId of [...(store as any).db.runOwners.keys()]) {
    await store.claimRunOwnership({ runId, ownerId: 'lapsed', leaseMs: -1, force: true });
  }
}

/** Every stored run's status and state. */
async function storedStates(storage: InstanceType<typeof MockStore>) {
  const store = storage.stores.workflows!;
  const states: Record<string, unknown> = {};
  for (const { workflow_name, run_id } of (store as any).db.workflows.values()) {
    const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow_name, runId: run_id });
    states[`${workflow_name}/${run_id}`] = { status: snapshot?.status, state: snapshot?.value };
  }
  return states;
}

describe('restarting a nested run whose process died', () => {
  it('restarts a registered nested run only through its parent on boot', async () => {
    let innerBRuns = 0;
    const build = (died?: () => void) => {
      const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: items })
        .then(appendItem('inner-a'))
        .then(
          appendItem('inner-b', {
            // Slow, so two drives at once would overlap here.
            onRun: died
              ? () => (died(), new Promise(() => {}))
              : () => (innerBRuns++, new Promise(resolve => setTimeout(resolve, 20))),
          }),
        )
        .commit();
      const outer = createWorkflow({ id: 'outer', inputSchema: num, outputSchema: num, stateSchema: items })
        .then(appendItem('before'))
        .then(inner)
        .commit();
      return { outer, inner };
    };
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });
    let died = false;
    const first = build(() => (died = true));
    new Mastra({ logger: false, storage, workflows: first });
    void (await first.outer.createRun({ runId: 'run-1' })).start({ inputData: { n: 0 }, initialState: { items: [] } });
    await vi.waitFor(() => expect(died).toBe(true));
    await expireRunLeases(storage);

    await new Mastra({ logger: false, storage, workflows: build(), recovery: stopped }).restartAllActiveWorkflowRuns();

    expect(innerBRuns).toBe(1);
    const state = { items: ['before:0', 'inner-a:1', 'inner-b:2'] };
    expect(await storedStates(storage)).toEqual({
      'outer/run-1': { status: 'success', state },
      'inner/run-1': { status: 'success', state },
    });
  });

  it('runs a foreach item once when the crash leaves its nested run behind', async () => {
    const calls: number[] = [];
    const build = (died?: () => void) => {
      const work = createStep({
        id: 'work',
        inputSchema: num,
        outputSchema: num,
        execute: async ({ inputData }) => {
          calls.push(inputData.n);
          // Hangs on the item that was running when the process died.
          if (inputData.n === 1 && died) {
            died();
            return new Promise(() => {});
          }
          return inputData;
        },
      });
      const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num }).then(work).commit();
      const outer = createWorkflow({ id: 'outer', inputSchema: z.array(num), outputSchema: z.array(num) })
        .foreach(inner, { concurrency: 1 })
        .commit();
      return { outer, inner };
    };
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });
    const innerStatuses = async () =>
      Object.entries(await storedStates(storage))
        .filter(([key]) => key.startsWith('inner/'))
        .map(([, value]) => (value as { status?: string }).status);

    let died = false;
    const first = build(() => (died = true));
    new Mastra({ logger: false, storage, workflows: first });
    void (await first.outer.createRun({ runId: 'run-1' })).start({
      inputData: [{ n: 0 }, { n: 1 }, { n: 2 }],
    });
    await vi.waitFor(() => expect(died).toBe(true));
    await expireRunLeases(storage);

    // The parent re-drives the item that was running, under a new nested run id; the crash's
    // nested run is left behind.
    await new Mastra({ logger: false, storage, workflows: build(), recovery: stopped }).restartAllActiveWorkflowRuns();
    expect(calls).toEqual([0, 1, 1, 2]);
    expect(await innerStatuses()).toContain('running');

    // The next boot no longer sees an active parent, so the leftover run must not be executed.
    await expireRunLeases(storage);
    await new Mastra({ logger: false, storage, workflows: build(), recovery: stopped }).restartAllActiveWorkflowRuns();
    expect(calls).toEqual([0, 1, 1, 2]);
    expect(await innerStatuses()).not.toContain('running');
    expect(await innerStatuses()).toContain('canceled');
    expect((await storedStates(storage))['outer/run-1']).toMatchObject({ status: 'success' });
  });

  it('cancels the leftover run from the workflow-level sweep once its parent finished', async () => {
    const calls: number[] = [];
    const build = (died?: () => void) => {
      const work = createStep({
        id: 'work',
        inputSchema: num,
        outputSchema: num,
        execute: async ({ inputData }) => {
          calls.push(inputData.n);
          if (inputData.n === 1 && died) {
            died();
            return new Promise(() => {});
          }
          return inputData;
        },
      });
      const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num }).then(work).commit();
      const outer = createWorkflow({ id: 'outer', inputSchema: z.array(num), outputSchema: z.array(num) })
        .foreach(inner, { concurrency: 1 })
        .commit();
      return { outer, inner };
    };
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });
    const innerStatuses = async () =>
      Object.entries(await storedStates(storage))
        .filter(([key]) => key.startsWith('inner/'))
        .map(([, value]) => (value as { status?: string }).status);

    let died = false;
    const first = build(() => (died = true));
    new Mastra({ logger: false, storage, workflows: first });
    void (await first.outer.createRun({ runId: 'run-1' })).start({
      inputData: [{ n: 0 }, { n: 1 }, { n: 2 }],
    });
    await vi.waitFor(() => expect(died).toBe(true));
    await expireRunLeases(storage);

    // The parent finishes and leaves the crash's nested run behind.
    await new Mastra({ logger: false, storage, workflows: build(), recovery: stopped }).restartAllActiveWorkflowRuns();
    expect(calls).toEqual([0, 1, 1, 2]);
    expect(await innerStatuses()).toContain('running');

    // `inner`'s own sweep reaches that run directly, without going through a parent restart.
    const third = build();
    new Mastra({ logger: false, storage, workflows: third });
    await expireRunLeases(storage);
    await third.inner.restartAllActiveWorkflowRuns();

    expect(calls).toEqual([0, 1, 1, 2]);
    expect(await innerStatuses()).not.toContain('running');
    expect(await innerStatuses()).toContain('canceled');
  });

  /** A foreach over `inner` whose item 1 hangs the first time `work` runs, so a restart can finish it. */
  const buildForeach = (calls: number[], died?: () => void) => {
    const work = createStep({
      id: 'work',
      inputSchema: num,
      outputSchema: num,
      execute: async ({ inputData }) => {
        calls.push(inputData.n);
        if (inputData.n === 1 && calls.filter(n => n === 1).length === 1) {
          died?.();
          return new Promise(() => {});
        }
        return inputData;
      },
    });
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num }).then(work).commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: z.array(num), outputSchema: z.array(num) })
      .foreach(inner, { concurrency: 1 })
      .commit();
    return { outer, inner };
  };

  /** Crashes item 1 of `buildForeach`, then rewrites the parent's stored status. */
  async function crashForeachWithParentStatus(parentStatus: 'suspended' | 'paused') {
    const calls: number[] = [];
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });
    let died = false;
    const first = buildForeach(calls, () => (died = true));
    new Mastra({ logger: false, storage, workflows: first });
    void (await first.outer.createRun({ runId: 'run-1' })).start({ inputData: [{ n: 0 }, { n: 1 }, { n: 2 }] });
    await vi.waitFor(() => expect(died).toBe(true));
    await store.updateWorkflowState({ workflowName: 'outer', runId: 'run-1', opts: { status: parentStatus } });
    await expireRunLeases(storage);
    const innerStatuses = async () =>
      Object.entries(await storedStates(storage))
        .filter(([key]) => key.startsWith('inner/'))
        .map(([, value]) => (value as { status?: string }).status);
    return { calls, storage, innerStatuses, build: buildForeach };
  }

  it('reads a parent once for every leftover nested run it decides on', async () => {
    const { calls, storage, innerStatuses, build } = await crashForeachWithParentStatus('paused');
    const store = storage.stores.workflows!;

    // Two more leftovers under the same parent, as a second and third crash would leave them: a
    // crashed foreach of 50 items leaves 50 of these pointing at one parent run.
    const [orphan] = (await store.listWorkflowRuns({ workflowName: 'inner' })).runs.filter(
      run => (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot).status === 'running',
    );
    expect(orphan).toBeDefined();
    for (const suffix of ['b', 'c']) {
      await store.persistWorkflowSnapshot({
        workflowName: 'inner',
        runId: `inner-${suffix}`,
        snapshot: JSON.parse(JSON.stringify(orphan!.snapshot)),
      });
    }

    const lookups = vi.spyOn(store, 'loadWorkflowRunStatus');
    const third = build(calls);
    new Mastra({ logger: false, storage, workflows: third });
    await third.inner.restartAllActiveWorkflowRuns();

    const parentLookups = lookups.mock.calls.filter(([args]) => args.workflowName === 'outer');
    expect(parentLookups).toHaveLength(1);
    expect(calls).toEqual([0, 1]);
    expect(await innerStatuses()).toContain('running');
  });

  it('reads a parent once per run when the Mastra sweep decides on the leftovers', async () => {
    const { calls, storage, innerStatuses, build } = await crashForeachWithParentStatus('paused');
    const store = storage.stores.workflows!;

    const [orphan] = (await store.listWorkflowRuns({ workflowName: 'inner' })).runs.filter(
      run => (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot).status === 'running',
    );
    for (const suffix of ['b', 'c']) {
      await store.persistWorkflowSnapshot({
        workflowName: 'inner',
        runId: `inner-${suffix}`,
        snapshot: JSON.parse(JSON.stringify(orphan!.snapshot)),
      });
    }

    // The Mastra-level sweep is a separate loop over every active run, so its cache is its own.
    const lookups = vi.spyOn(store, 'loadWorkflowRunStatus');
    const third = build(calls);
    await new Mastra({ logger: false, storage, workflows: third, recovery: stopped }).restartAllActiveWorkflowRuns();

    const parentLookups = lookups.mock.calls.filter(([args]) => args.workflowName === 'outer');
    expect(parentLookups).toHaveLength(1);
    expect(calls).toEqual([0, 1]);
    expect(await innerStatuses()).toContain('running');
  });

  it('restarts a nested run on its own while its parent is suspended', async () => {
    const { calls, storage, innerStatuses, build } = await crashForeachWithParentStatus('suspended');

    // A suspended parent waits for its child, so the child is the only way forward (#25979).
    await new Mastra({
      logger: false,
      storage,
      workflows: build(calls),
      recovery: stopped,
    }).restartAllActiveWorkflowRuns();

    expect(calls.length).toBeGreaterThan(2);
    expect(await innerStatuses()).not.toContain('canceled');
  });

  it('leaves a nested run alone while its parent is paused', async () => {
    const { calls, storage, innerStatuses, build } = await crashForeachWithParentStatus('paused');
    const debug = vi.fn();

    await new Mastra({
      logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
      storage,
      workflows: build(calls),
      recovery: stopped,
    }).restartAllActiveWorkflowRuns();

    // The sweep never restarts a paused parent, so restarting the child here would run the item
    // again while the parent can still drive it after a resume.
    expect(calls).toEqual([0, 1]);
    expect(await innerStatuses()).toContain('running');
    // A nested run waiting on a parent that nothing here restarts is only visible in `inner`'s own
    // active runs, so the sweep says out loud that it left it alone.
    expect(debug).toHaveBeenCalledWith(
      'Left a nested workflow run for its parent to drive',
      expect.objectContaining({ workflow: 'inner', parentWorkflow: 'outer', parentStatus: 'paused' }),
    );
    expect(await innerStatuses()).not.toContain('canceled');
  });

  it('says the workflow-level sweep left a nested run for its parent', async () => {
    const { calls, storage, innerStatuses, build } = await crashForeachWithParentStatus('paused');
    const debug = vi.fn();

    const { inner } = build(calls);
    new Mastra({
      logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
      storage,
      workflows: { inner },
    });
    await inner.restartAllActiveWorkflowRuns();

    // Same rule and the same reason to say it out loud as the Mastra-level sweep: nothing here
    // restarts a paused parent, so the run is only visible in `inner`'s own active runs.
    expect(calls).toEqual([0, 1]);
    expect(await innerStatuses()).toContain('running');
    expect(debug).toHaveBeenCalledWith(
      'Left a nested workflow run for its parent to drive',
      expect.objectContaining({ workflowId: 'inner', parentWorkflow: 'outer', parentStatus: 'paused' }),
    );
  });

  it('restarts a nested run on its own when its parent run is gone', async () => {
    const { calls, storage, innerStatuses, build } = await crashForeachWithParentStatus('paused');
    await storage.stores.workflows!.deleteWorkflowRunById({ workflowName: 'outer', runId: 'run-1' });

    await new Mastra({
      logger: false,
      storage,
      workflows: build(calls),
      recovery: stopped,
    }).restartAllActiveWorkflowRuns();

    // Nothing is left that could collect the run, so the sweep is its only way forward.
    expect(calls.length).toBeGreaterThan(2);
    expect(await innerStatuses()).not.toContain('canceled');
  });

  it('keeps sweeping when a nested run parent lookup fails', async () => {
    const { calls, storage, build } = await crashForeachWithParentStatus('paused');

    // An unrelated top-level run that hangs until it is restarted, so the sweep has something to
    // recover besides the nested run whose lookup throws.
    const soloCalls: number[] = [];
    const solo = createWorkflow({ id: 'solo', inputSchema: num, outputSchema: num })
      .then(
        createStep({
          id: 'work',
          inputSchema: num,
          outputSchema: num,
          execute: async ({ inputData }) => {
            soloCalls.push(inputData.n);
            if (soloCalls.length === 1) return new Promise(() => {});
            return inputData;
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { ...build(calls), solo }, recovery: stopped });
    void (await solo.createRun({ runId: 'solo-1' })).start({ inputData: { n: 0 } });
    await vi.waitFor(() => expect(soloCalls).toEqual([0]));
    await expireRunLeases(storage);

    const store = storage.stores.workflows!;
    const loadStatus = store.loadWorkflowRunStatus.bind(store);
    store.loadWorkflowRunStatus = async args => {
      if (args.workflowName === 'outer') throw new Error('storage unavailable');
      return loadStatus(args);
    };

    // The failure belongs to one nested run's lookup. It must not reject the sweep or stop it, or
    // every other run the sweep was going to restart goes unrecovered.
    await expect(mastra.restartAllActiveWorkflowRuns()).resolves.toBeUndefined();
    expect(soloCalls).toEqual([0, 0]);
    expect(calls).toEqual([0, 1]);
  });

  describe('a re-driven nested step whose nested run already finished', () => {
    /** A foreach over `inner`, which suspends, then appends twice once resumed. */
    const build = () => {
      const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: items })
        .then(appendItem('inner-wait', { suspends: true }))
        .then(appendItem('inner-b'))
        .commit();
      return createWorkflow({
        id: 'outer',
        inputSchema: z.array(num),
        outputSchema: z.array(num),
        stateSchema: items,
      })
        .foreach(inner)
        .commit();
    };

    /** Writes of `outer` after `inner`'s success write never finish, as if the process died there. */
    function dieAfterNestedSuccess(storage: InstanceType<typeof MockStore>) {
      const store = storage.stores.workflows!;
      const write = store.persistWorkflowSnapshot.bind(store);
      let innerDone = false;
      let dying = true;
      let died!: () => void;
      const dead = new Promise<void>(resolve => (died = resolve));
      store.persistWorkflowSnapshot = async args => {
        if (dying && innerDone && args.workflowName === 'outer') {
          died();
          return new Promise(() => {});
        }
        // Storage keeps the snapshot object itself; copy it so later in-place edits don't show up stored.
        await write({ ...args, snapshot: structuredClone(args.snapshot) });
        if (args.workflowName === 'inner' && args.snapshot.status === 'success') innerDone = true;
      };
      return dead.then(async () => {
        dying = false;
        await expireRunLeases(storage);
      });
    }

    it('keeps its state changes', async () => {
      const storage = new MockStore();
      const dying = build();
      new Mastra({ logger: false, storage, workflows: { outer: dying } });
      const run = await dying.createRun({ runId: 'run-1' });
      expect((await run.start({ inputData: [{ n: 0 }], initialState: { items: [] } })).status).toBe('suspended');
      const dead = dieAfterNestedSuccess(storage);
      void run.resume({ step: ['inner', 'inner-wait'], resumeData: true });
      await dead;

      const outer = build();
      new Mastra({ logger: false, storage, workflows: { outer } });
      const result = await (
        await outer.createRun({ runId: 'run-1' })
      ).restart({ outputOptions: { includeState: true } });

      expect(result.status).toBe('success');
      const state = { items: ['inner-wait:0', 'inner-b:1'] };
      expect(result.state).toEqual(state);
      expect((await storedStates(storage))['outer/run-1']).toEqual({ status: 'success', state });
    });

    it('does not apply again the changes a foreach item made before it suspended', async () => {
      const build = () => {
        const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: items })
          .then(appendItem('inner-a'))
          .then(appendItem('inner-wait', { suspends: true }))
          .then(appendItem('inner-b'))
          .commit();
        return createWorkflow({
          id: 'outer',
          inputSchema: z.array(num),
          outputSchema: z.array(num),
          stateSchema: items,
        })
          .foreach(inner)
          .commit();
      };

      const storage = new MockStore();
      const first = build();
      new Mastra({ logger: false, storage, workflows: { outer: first } });
      const run = await first.createRun({ runId: 'run-1' });
      expect((await run.start({ inputData: [{ n: 0 }], initialState: { items: [] } })).status).toBe('suspended');

      // The first suspension hands back this item's `inner-a:0`; the resume adds the rest, then
      // the process dies before the parent saves what the resume handed back.
      const dead = dieAfterNestedSuccess(storage);
      void run.resume({ step: ['inner', 'inner-wait'], resumeData: true });
      await dead;

      const outer = build();
      new Mastra({ logger: false, storage, workflows: { outer } });
      const result = await (
        await outer.createRun({ runId: 'run-1' })
      ).restart({ outputOptions: { includeState: true } });
      expect(result.status).toBe('success');
      expect(result.state).toEqual({ items: ['inner-a:0', 'inner-wait:1', 'inner-b:2'] });
    });

    it('does not apply again the changes a nested run made before it suspended', async () => {
      const build = () => {
        const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: items })
          .then(appendItem('inner-a'))
          .then(appendItem('inner-wait', { suspends: true }))
          .then(appendItem('inner-b'))
          .commit();
        return createWorkflow({ id: 'outer', inputSchema: num, outputSchema: num, stateSchema: items })
          .then(inner)
          .commit();
      };

      const storage = new MockStore();
      const first = build();
      new Mastra({ logger: false, storage, workflows: { outer: first } });
      const run = await first.createRun({ runId: 'run-1' });
      expect((await run.start({ inputData: { n: 0 }, initialState: { items: [] } })).status).toBe('suspended');

      // The first suspension hands back `inner-a:0`; the resume adds the rest, then the process dies.
      const dead = dieAfterNestedSuccess(storage);
      void run.resume({ step: ['inner', 'inner-wait'], resumeData: true });
      await dead;

      const outer = build();
      new Mastra({ logger: false, storage, workflows: { outer } });
      const result = await (
        await outer.createRun({ runId: 'run-1' })
      ).restart({ outputOptions: { includeState: true } });

      expect(result.status).toBe('success');
      expect(result.state).toEqual({ items: ['inner-a:0', 'inner-wait:1', 'inner-b:2'] });
    });

    it('keeps a key the nested run never touched at the value a sibling left it', async () => {
      const stateSchema = z.object({ items: z.array(z.string()), tag: z.string() });
      let childStarted!: () => void;
      const started = new Promise<void>(resolve => (childStarted = resolve));
      let siblingWrote!: () => void;
      const wrote = new Promise<void>(resolve => (siblingWrote = resolve));

      // Writes `tag` once, only after the nested run has started. The restart re-runs this branch,
      // and `inner`'s own copy of the state still says 'base', so the merge alone has to keep 'newer'.
      let wroteTag = false;
      const sibling = createStep({
        id: 'sibling',
        inputSchema: num,
        outputSchema: num,
        stateSchema,
        execute: async ({ inputData, state, setState }) => {
          await started;
          if (!wroteTag) {
            wroteTag = true;
            await setState({ ...state, tag: 'newer' });
            siblingWrote();
          }
          return inputData;
        },
      });
      const innerWait = createStep({
        id: 'inner-wait',
        inputSchema: num,
        outputSchema: num,
        stateSchema,
        resumeSchema: z.boolean(),
        execute: async ({ inputData, state, setState, resumeData, suspend }) => {
          childStarted();
          if (resumeData === undefined) {
            await wrote;
            return suspend({});
          }
          await setState({ ...state, items: [...state.items, `inner-wait:${inputData.n}`] });
          return inputData;
        },
      });
      const innerB = createStep({
        id: 'inner-b',
        inputSchema: num,
        outputSchema: num,
        stateSchema,
        execute: async ({ inputData, state, setState }) => {
          const n = inputData.n + 1;
          await setState({ ...state, items: [...state.items, `inner-b:${n}`] });
          return { n };
        },
      });
      const buildParallel = () => {
        const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema })
          .then(innerWait)
          .then(innerB)
          .commit();
        return createWorkflow({ id: 'outer', inputSchema: num, outputSchema: num, stateSchema })
          .parallel([sibling, inner])
          .commit();
      };

      const storage = new MockStore();
      const dying = buildParallel();
      new Mastra({ logger: false, storage, workflows: { outer: dying } });
      const run = await dying.createRun({ runId: 'run-1' });
      expect((await run.start({ inputData: { n: 0 }, initialState: { items: [], tag: 'base' } })).status).toBe(
        'suspended',
      );
      const dead = dieAfterNestedSuccess(storage);
      void run.resume({ step: ['inner', 'inner-wait'], resumeData: true });
      await dead;

      const outer = buildParallel();
      new Mastra({ logger: false, storage, workflows: { outer } });
      const result = await (
        await outer.createRun({ runId: 'run-1' })
      ).restart({ outputOptions: { includeState: true } });

      expect(result.status).toBe('success');
      // `inner` hands back the items it appended; `tag` is the sibling's write, which it never saw.
      expect(result.state).toEqual({ items: ['inner-wait:0', 'inner-b:1'], tag: 'newer' });
    });
  });
});

describe('keeps the parent of a nested run stored while it runs a step', () => {
  const cases = {
    'in a parallel': { branch: false, resumes: false },
    'in a branch': { branch: true, resumes: false },
    'in a parallel, once resumed': { branch: false, resumes: true },
    'in a branch, once resumed': { branch: true, resumes: true },
  };

  it.each(Object.entries(cases))('%s', async (_, { branch, resumes }) => {
    const storage = new MockStore();
    let stored: unknown;
    const peek = createStep({
      id: 'peek',
      inputSchema: num,
      outputSchema: num,
      stateSchema: items,
      resumeSchema: z.boolean(),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (resumes && resumeData === undefined) return suspend({});
        const run = await storage.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'inner', runId: 'run-1' });
        stored = { parentWorkflow: run?.parentWorkflow, state: run?.value };
        return inputData;
      },
    });
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: z.any(), stateSchema: items });
    (branch ? inner.branch([[async () => true, peek]]) : inner.parallel([peek])).commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: num, outputSchema: z.any(), stateSchema: items })
      .then(appendItem('before'))
      .then(inner)
      .commit();
    new Mastra({ logger: false, storage, workflows: { outer } });
    const run = await outer.createRun({ runId: 'run-1' });
    let result = await run.start({ inputData: { n: 0 }, initialState: { items: [] } });
    if (resumes) result = await run.resume({ step: ['inner', 'peek'], resumeData: true });

    expect(result.status).toBe('success');
    expect(stored).toEqual({
      parentWorkflow: expect.objectContaining({ workflowId: 'outer', runId: 'run-1', stepId: 'inner' }),
      state: { items: ['before:0'] },
    });
  });
});

describe('a nested run hands back only its changes', () => {
  const slow = (ms: number) => () => new Promise(resolve => setTimeout(resolve, ms));
  const innerOf = (steps: ReturnType<typeof appendItem>[], stateSchema: typeof items | undefined = items) =>
    steps
      .reduce<any>(
        (wf, step) => wf.then(step),
        createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema }),
      )
      .commit();
  const outerOf = (inputSchema: z.ZodType = num) =>
    createWorkflow({ id: 'outer', inputSchema, outputSchema: z.any(), stateSchema: items });
  const foreachOver = (concurrency: number, stateSchema?: typeof items) => () =>
    outerOf(z.array(num))
      .foreach(innerOf([appendItem('a', { onRun: slow(5) })], stateSchema), { concurrency })
      .commit();

  const cases: Record<
    string,
    {
      build: () => AnyWorkflow;
      inputData: unknown;
      resumes?: (string | string[])[];
      items: string[];
      unordered?: boolean;
    }
  > = {
    'keeping a parallel sibling that resumed first': {
      build: () =>
        outerOf()
          .parallel([
            appendItem('p', { suspends: true }),
            innerOf([appendItem('inner-a'), appendItem('inner-wait', { suspends: true })]),
          ])
          .commit(),
      inputData: { n: 0 },
      resumes: ['p', ['inner', 'inner-wait']],
      items: ['inner-a:0', 'p:0', 'inner-wait:1'],
    },
    'keeping a parallel sibling that changed the state while it ran': {
      build: () =>
        outerOf()
          .parallel([appendItem('p', { onRun: slow(10) }), innerOf([appendItem('inner-a', { onRun: slow(30) })])])
          .commit(),
      inputData: { n: 0 },
      items: ['p:0', 'inner-a:0'],
    },
    ...Object.fromEntries(
      [1, 2, 3].map(concurrency => [
        `keeping the other iterations of a foreach, ${concurrency} at a time`,
        {
          build: foreachOver(concurrency),
          inputData: [{ n: 0 }, { n: 1 }, { n: 2 }],
          items: ['a:0', 'a:1', 'a:2'],
          unordered: true,
        },
      ]),
    ),
    'keeping the other iterations of a foreach over a nested run without a state schema': {
      build: foreachOver(2, undefined),
      inputData: [{ n: 0 }, { n: 1 }, { n: 2 }],
      items: ['a:0', 'a:1', 'a:2'],
      unordered: true,
    },
  };

  it.each(Object.entries(cases))('%s', async (_, { build, inputData, resumes = [], items: expected, unordered }) => {
    const outer = build();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });
    const run = await outer.createRun();
    let result = await run.start({ inputData, initialState: { items: [] }, outputOptions: { includeState: true } });
    for (const step of resumes) {
      result = await run.resume({ step, resumeData: true, outputOptions: { includeState: true } } as any);
    }
    expect(result.status).toBe('success');
    const appended = (result.state as { items: string[] }).items;
    expect(unordered ? [...appended].sort() : appended).toEqual(expected);
  });

  // https://github.com/mastra-ai/mastra/issues/29347
  let parses = 0;
  it.each([
    ['a default', z.string().default('plain')],
    // Fails if the hand-back re-parses the start state instead of using the one the run started with.
    ['a default computed on each parse', z.string().default(() => `plain-${++parses}`)],
  ])("keeps a sibling's newer value for a key the nested run's schema filled with %s", async (_, tone) => {
    let siblingWrote!: () => void;
    const wrote = new Promise<void>(resolve => (siblingWrote = resolve));
    const sibling = createStep({
      id: 'sibling',
      inputSchema: num,
      outputSchema: num,
      execute: async ({ inputData, state, setState }) => {
        await setState({ ...state, tone: 'newer' });
        siblingWrote();
        return inputData;
      },
    });
    const innerState = z.object({ items: z.array(z.string()), tone });
    const append = createStep({
      id: 'append',
      inputSchema: num,
      outputSchema: num,
      stateSchema: innerState,
      execute: async ({ inputData, state, setState }) => {
        await wrote;
        await setState({ ...state, items: [...state.items, 'inner:0'] });
        return inputData;
      },
    });
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: innerState })
      .then(append)
      .commit();
    const outer = createWorkflow({
      id: 'outer',
      inputSchema: num,
      outputSchema: z.any(),
      stateSchema: z.object({ items: z.array(z.string()), tone: z.string().optional() }),
    })
      .parallel([sibling, inner])
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });

    const run = await outer.createRun();
    const result = await run.start({
      inputData: { n: 0 },
      initialState: { items: [] },
      outputOptions: { includeState: true },
    });

    expect(result.status).toBe('success');
    expect(result.state).toEqual({ items: ['inner:0'], tone: 'newer' });
  });
});

describe('what a parked nested run exposes to callers', () => {
  /** `inner` suspends on its first step, so the parent parks on it holding the state it started from. */
  const build = (nested: 'then' | 'foreach') => {
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: items })
      .then(appendItem('inner-wait', { suspends: true }))
      .commit();
    const outer = createWorkflow({
      id: 'outer',
      inputSchema: nested === 'then' ? num : z.array(num),
      outputSchema: nested === 'then' ? num : z.array(num),
      stateSchema: items,
    });
    return (nested === 'then' ? outer.then(inner) : outer.foreach(inner)).commit();
  };

  const parkedMeta = (result: any) => result.steps.inner.suspendPayload.__workflow_meta;

  it('keeps the state a re-driven nested run starts from out of the result and the stored run', async () => {
    const outer = build('then');
    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });
    const run = await outer.createRun({ runId: 'run-1' });

    const result: any = await run.start({ inputData: { n: 0 }, initialState: { items: ['hidden'] } });
    expect(result.status).toBe('suspended');
    // Callers only see workflow state through `includeState`, so a base kept for the recovery sweep
    // has no business riding out inside the step metadata they do get.
    expect(result).not.toHaveProperty('state');
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(parkedMeta(result).runId).toBe('run-1');
    expect(parkedMeta(result)).not.toHaveProperty('startState');

    // The stored run goes through a different projection, and had to strip it as well.
    const stored: any = await outer.getWorkflowRunById('run-1');
    expect(parkedMeta(stored).runId).toBe('run-1');
    expect(parkedMeta(stored)).not.toHaveProperty('startState');
  });

  it('keeps a .foreach() item base out of the result too', async () => {
    const outer = build('foreach');
    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });
    const run = await outer.createRun({ runId: 'run-1' });

    const result: any = await run.start({ inputData: [{ n: 0 }, { n: 1 }], initialState: { items: ['hidden'] } });
    expect(result.status).toBe('suspended');
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(parkedMeta(result)).not.toHaveProperty('startState');
    // Each parked iteration carries its own base for the re-drive.
    const parkedItems = parkedMeta(result).foreachOutput as any[];
    expect(parkedItems.length).toBeGreaterThan(0);
    for (const item of parkedItems) {
      expect(item.suspendPayload.__workflow_meta).not.toHaveProperty('startState');
      expect(item.suspendPayload.__workflow_meta.runId).toBeTypeOf('string');
    }
  });

  it('keeps a parked item base out of the result when a sibling item failed', async () => {
    // The failing sibling leaves the step metadata without a base of its own, so an item's base is
    // only reachable through `foreachOutput`.
    const inner = createWorkflow({ id: 'inner', inputSchema: num, outputSchema: num, stateSchema: items })
      .then(
        createStep({
          id: 'inner-wait',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          resumeSchema: z.boolean(),
          execute: async ({ inputData, state, setState, resumeData, suspend }) => {
            if (inputData.n === 1) {
              // Slow enough that the other item is parked before this one fails.
              await new Promise(resolve => setTimeout(resolve, 30));
              throw new Error('item failed');
            }
            if (resumeData === undefined) {
              await setState({ items: [...state.items, `inner-wait:${inputData.n}`] });
              return suspend({});
            }
            return { n: inputData.n + 1 };
          },
        }),
      )
      .commit();
    const outer = createWorkflow({
      id: 'outer',
      inputSchema: z.array(num),
      outputSchema: z.array(num),
      stateSchema: items,
    })
      .foreach(inner, { concurrency: 2 })
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });
    const run = await outer.createRun({ runId: 'run-1' });

    const result: any = await run.start({ inputData: [{ n: 0 }, { n: 1 }], initialState: { items: ['hidden'] } });
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('hidden');
    const parkedItems = parkedMeta(result).foreachOutput as any[];
    expect(parkedItems[0].suspendPayload.__workflow_meta).not.toHaveProperty('startState');

    const stored: any = await outer.getWorkflowRunById('run-1');
    const storedItems = parkedMeta(stored).foreachOutput as any[];
    expect(storedItems[0].suspendPayload.__workflow_meta).not.toHaveProperty('startState');
  });

  it('leaves the workflow input alone when it happens to look like a step result', async () => {
    // The input is the caller's data. Cleaning it like a step result would rewrite what they passed in.
    const outer = createWorkflow({
      id: 'outer',
      inputSchema: z.any(),
      outputSchema: z.any(),
      stateSchema: items,
    })
      .then(
        createStep({
          id: 'echo-input',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ inputData }) => inputData,
        }),
      )
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });
    const run = await outer.createRun({ runId: 'run-1' });

    const inputData = { suspendPayload: { __workflow_meta: { startState: { items: ['mine'] } } } };
    const result: any = await run.start({ inputData, initialState: { items: [] } });
    expect(result.status).toBe('success');
    expect(result.input).toEqual(inputData);
    expect(result.steps.input).toEqual(inputData);
  });
});
