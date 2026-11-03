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

    await new Mastra({ logger: false, storage, workflows: build() }).restartAllActiveWorkflowRuns();

    expect(innerBRuns).toBe(1);
    const state = { items: ['before:0', 'inner-a:1', 'inner-b:2'] };
    expect(await storedStates(storage)).toEqual({
      'outer/run-1': { status: 'success', state },
      'inner/run-1': { status: 'success', state },
    });
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
});
