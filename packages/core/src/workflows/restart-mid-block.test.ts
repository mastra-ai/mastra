/**
 * Regression for https://github.com/mastra-ai/mastra/issues/26214
 *
 * The default engine did not checkpoint parallel arms or foreach items as they
 * finished; it only wrote the block's result once every arm or item was done.
 * A crash inside the block left a checkpoint where finished arms still looked
 * in flight and finished foreach items left no trace, so `restart()` ran them
 * a second time.
 *
 * Each test runs the workflow once and, from inside a still-running step, keeps
 * the latest checkpoint that storage holds at that moment: exactly what a
 * process that died there would leave behind. It then restores that checkpoint
 * into fresh storage with a freshly built workflow and restarts.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { cloneRunData } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

const anySchema = z.any();

/** Called from inside a running step to take the checkpoint a crash at that moment would leave. */
type Crash = () => Promise<void>;

type Built = { workflow: any; fns: Record<string, ReturnType<typeof vi.fn>> };

function step(id: string, execute: (params: { inputData: any }) => Promise<any>) {
  const fn = vi.fn(execute);
  return { fn, step: createStep({ id, inputSchema: anySchema, outputSchema: anySchema, execute: fn }) };
}

/**
 * Yields one macrotask before the crash. That is less time than any timer-based
 * checkpoint could take, so only writes that start as soon as an item finishes make it.
 */
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

/** Finished foreach items recorded on a checkpoint. */
function progressCount(snapshot: WorkflowRunState | undefined, stepId: string) {
  return Object.keys((snapshot?.context?.[stepId] as any)?.metadata?.foreachProgress ?? {}).length;
}

/**
 * The crash keeps a JSON copy of the last snapshot storage was asked to write, taken
 * when the write was made, so later in-memory mutation cannot leak into it.
 */
async function crashAndRestart(
  build: (crash?: Crash) => Built,
  inputData: unknown,
  tamper?: (crashSnapshot: WorkflowRunState) => void,
) {
  const storage = new MockStore();
  let crashSnapshot: WorkflowRunState | undefined;
  let latest: WorkflowRunState | undefined;
  const crash: Crash = async () => {
    await nextTick();
    crashSnapshot = JSON.parse(JSON.stringify(latest));
  };

  const first = build(crash);
  new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
  const store = (await storage.getStore('workflows'))!;
  const persist = store.persistWorkflowSnapshot.bind(store);
  vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
    if (args.workflowName === first.workflow.id) latest = JSON.parse(JSON.stringify(args.snapshot));
    return persist(args);
  });

  const run = await first.workflow.createRun();
  const original = await run.start({ inputData });
  expect(original.status).toBe('success');
  expect(crashSnapshot, 'crash point was never reached').toBeDefined();
  expect(crashSnapshot!.status).toBe('running');

  tamper?.(crashSnapshot!);

  const second = build();
  const freshStorage = new MockStore();
  new Mastra({ logger: false, storage: freshStorage, workflows: { wf: second.workflow } });
  const freshStore = (await freshStorage.getStore('workflows'))!;
  await freshStore.persistWorkflowSnapshot({
    workflowName: second.workflow.id,
    runId: run.runId,
    snapshot: crashSnapshot!,
  });

  const restarted = await (await second.workflow.createRun({ runId: run.runId })).restart();
  const stored = await freshStore.loadWorkflowSnapshot({ workflowName: second.workflow.id, runId: run.runId });
  return { original, restarted, stored, fns: second.fns };
}

describe('restart after a crash inside a parallel or foreach block (issue #26214)', () => {
  it('does not re-run a parallel arm that finished before the crash', async () => {
    const build = (crash?: Crash): Built => {
      let fastDone!: () => void;
      const fastFinished = new Promise<void>(resolve => (fastDone = resolve));
      const fast = step('fast', async ({ inputData }) => {
        setTimeout(() => fastDone(), 0);
        return { fast: inputData.n + 1 };
      });
      const slow = step('slow', async ({ inputData }) => {
        if (crash) {
          await fastFinished;
          await crash();
        }
        return { slow: inputData.n + 2 };
      });
      const join = step('join', async ({ inputData }) => ({ sum: inputData.fast.fast + inputData.slow.slow }));
      const workflow = createWorkflow({ id: 'mid-parallel', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([fast.step, slow.step])
        .then(join.step)
        .commit();
      return { workflow, fns: { fast: fast.fn, slow: slow.fn, join: join.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, { n: 1 });

    expect(fns.fast).not.toHaveBeenCalled();
    expect(fns.slow).toHaveBeenCalledTimes(1);
    expect(fns.join).toHaveBeenCalledTimes(1);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('re-runs only the unfinished arm when finished arms sit on both sides of it', async () => {
    const build = (crash?: Crash): Built => {
      let finished = 0;
      let bothDone!: () => void;
      const othersFinished = new Promise<void>(resolve => (bothDone = resolve));
      const markDone = () =>
        setTimeout(() => {
          if (++finished === 2) bothDone();
        }, 0);
      const first = step('first', async ({ inputData }) => {
        markDone();
        return { first: inputData.n };
      });
      const middle = step('middle', async ({ inputData }) => {
        if (crash) {
          await othersFinished;
          await crash();
        }
        return { middle: inputData.n * 10 };
      });
      const last = step('last', async ({ inputData }) => {
        markDone();
        return { last: inputData.n * 100 };
      });
      const workflow = createWorkflow({ id: 'mid-parallel-3', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([first.step, middle.step, last.step])
        .commit();
      return { workflow, fns: { first: first.fn, middle: middle.fn, last: last.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, { n: 2 });

    expect(fns.first).not.toHaveBeenCalled();
    expect(fns.last).not.toHaveBeenCalled();
    expect(fns.middle).toHaveBeenCalledTimes(1);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  const foreachBuild =
    (concurrency: number, id = `mid-foreach-${concurrency}`) =>
    (crash?: Crash): Built => {
      let finished = 0;
      let twoDone!: () => void;
      const firstTwoFinished = new Promise<void>(resolve => (twoDone = resolve));
      let crashed!: () => void;
      const afterCrash = new Promise<void>(resolve => (crashed = resolve));
      const item = step('item', async ({ inputData }) => {
        if (crash && inputData >= 2) {
          // Items 0 and 1 finish; the process dies while later items are still running.
          await firstTwoFinished;
          if (inputData === 2) {
            await crash();
            crashed();
          }
          await afterCrash;
          return { doubled: inputData * 2 };
        }
        if (crash) {
          setTimeout(() => {
            if (++finished === 2) twoDone();
          }, 0);
        }
        return { doubled: inputData * 2 };
      });
      const total = step('total', async ({ inputData }) => ({
        total: inputData.reduce((sum: number, r: any) => sum + r.doubled, 0),
      }));
      const workflow = createWorkflow({
        id,
        inputSchema: anySchema,
        outputSchema: anySchema,
      })
        .foreach(item.step, { concurrency })
        .then(total.step)
        .commit();
      return { workflow, fns: { item: item.fn, total: total.fn } };
    };

  it.each([1, 3])(
    'does not re-run foreach items that finished before the crash (concurrency %i)',
    async concurrency => {
      const { original, restarted, stored, fns } = await crashAndRestart(foreachBuild(concurrency), [0, 1, 2, 3, 4]);

      const ranItems = fns.item.mock.calls.map(call => call[0].inputData).sort();
      expect(ranItems).toEqual([2, 3, 4]);
      expect(fns.total).toHaveBeenCalledTimes(1);
      expect(fns.total.mock.calls[0]![0].inputData).toEqual([0, 2, 4, 6, 8].map(doubled => ({ doubled })));
      expect(restarted.status).toBe('success');
      expect(restarted.result).toEqual(original.result);
      expect(restarted.steps.item.output).toEqual(original.steps.item.output);
      // Per-item progress is a crash-recovery record only; it must not survive into results.
      expect(JSON.stringify(restarted)).not.toContain('foreachProgress');
      expect(JSON.stringify(stored)).not.toContain('foreachProgress');
    },
  );

  it.each([1, 3])(
    'charges every customer exactly once when the crash comes right after a charge (concurrency %i)',
    async concurrency => {
      // The issue's billing repro: the process dies right after "charged customer 1", one
      // macrotask after the charge returns, with no time for a timed checkpoint.
      const charged: number[] = [];
      let original = true;
      const build = (crash?: Crash): Built => {
        let done = 0;
        let firstTwoCharged!: () => void;
        const twoCharged = new Promise<void>(resolve => (firstTwoCharged = resolve));
        let crashed!: () => void;
        const afterCrash = new Promise<void>(resolve => (crashed = resolve));
        const charge = step('charge', async ({ inputData }) => {
          if (crash && inputData >= 2) {
            await twoCharged;
            if (inputData === 2) {
              await crash();
              original = false;
              crashed();
            }
            await afterCrash;
          }
          // Only side effects from before the crash, and from the restart, count.
          if (original || !crash) charged.push(inputData);
          if (crash && ++done === 2) firstTwoCharged();
          return { charged: inputData };
        });
        const workflow = createWorkflow({
          id: `foreach-billing-${concurrency}`,
          inputSchema: anySchema,
          outputSchema: anySchema,
        })
          .foreach(charge.step, { concurrency })
          .commit();
        return { workflow, fns: { charge: charge.fn } };
      };

      const { original: first, restarted } = await crashAndRestart(build, [0, 1, 2, 3, 4]);

      expect(charged.sort()).toEqual([0, 1, 2, 3, 4]);
      expect(restarted.status).toBe('success');
      expect(restarted.result).toEqual(first.result);
    },
  );

  it('checkpoints items that finish after the last item start', async () => {
    // Concurrency 5: every item starts up front, so no later item start can carry the
    // progress of items 0 and 1; only the progress checkpoint records them.
    const { original, restarted, fns } = await crashAndRestart(
      foreachBuild(5, 'mid-foreach-all-started'),
      [0, 1, 2, 3, 4],
    );

    expect(fns.item.mock.calls.map(call => call[0].inputData).sort()).toEqual([2, 3, 4]);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('never lands an older foreach checkpoint over a newer one when storage latency varies', async () => {
    // Writes are copied when called and land after a seeded random delay, like a remote
    // store. If writes for the run were not kept in call order, an older snapshot would
    // land after a newer one and drop finished items from the persisted progress.
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const item = step('item', async ({ inputData }) => {
      await new Promise(resolve => setTimeout(resolve, Math.floor(random() * 15)));
      return { doubled: inputData * 2 };
    });
    const workflow = createWorkflow({ id: 'foreach-latency', inputSchema: anySchema, outputSchema: anySchema })
      .foreach(item.step, { concurrency: 4 })
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { wf: workflow } });
    const store = (await storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    const landed: number[] = [];
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      const copy = JSON.parse(JSON.stringify(args));
      await new Promise(resolve => setTimeout(resolve, Math.floor(random() * 20)));
      // Only while the foreach runs; its final result drops the progress record.
      if (copy.snapshot.context.item?.status === 'running') landed.push(progressCount(copy.snapshot, 'item'));
      return persist(copy);
    });

    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = await (await workflow.createRun()).start({ inputData: items });

    expect(result.status).toBe('success');
    expect(Math.max(...landed)).toBeGreaterThan(0);
    const shrunk = landed.filter((count, i) => i > 0 && count < landed[i - 1]!);
    expect(shrunk, `landed progress counts: ${landed.join(',')}`).toEqual([]);
  });

  it('fails the foreach, instead of hanging or succeeding, when a progress checkpoint cannot be written', async () => {
    const item = step('item', async ({ inputData }) => ({ doubled: inputData * 2 }));
    const after = step('after', async () => ({ ran: true }));
    const workflow = createWorkflow({ id: 'foreach-write-fails', inputSchema: anySchema, outputSchema: anySchema })
      .foreach(item.step, { concurrency: 3 })
      .then(after.step)
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { wf: workflow } });
    const store = (await storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      if (args.snapshot.status === 'running' && progressCount(args.snapshot, 'item') > 0) {
        throw new Error('storage unavailable');
      }
      return persist(args);
    });

    const result = await (await workflow.createRun()).start({ inputData: [0, 1, 2, 3, 4] });

    expect(result.status).toBe('failed');
    expect(after.fn).not.toHaveBeenCalled();
  });

  it('never lands an older parallel checkpoint over a newer one when storage latency varies', async () => {
    // Each arm's start write carries the other arms as still running. If it landed after a
    // sibling's arm-end write, the finished sibling would look unfinished again.
    let seed = 11;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const arms = ids.map((id, i) =>
      step(id, async () => {
        await new Promise(resolve => setTimeout(resolve, i * 3));
        return { [id]: i };
      }),
    );
    const workflow = createWorkflow({ id: 'parallel-latency', inputSchema: anySchema, outputSchema: anySchema })
      .parallel(arms.map(arm => arm.step))
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { wf: workflow } });
    const store = (await storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    const landed: number[] = [];
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      const copy = JSON.parse(JSON.stringify(args));
      await new Promise(resolve => setTimeout(resolve, Math.floor(random() * 20)));
      landed.push(ids.filter(id => copy.snapshot.context[id]?.status === 'success').length);
      return persist(copy);
    });

    const result = await (await workflow.createRun()).start({ inputData: {} });

    expect(result.status).toBe('success');
    const shrunk = landed.filter((count, i) => i > 0 && count < landed[i - 1]!);
    expect(shrunk, `landed finished-arm counts: ${landed.join(',')}`).toEqual([]);
  });

  it('restarts every item when the crash comes before any item finished', async () => {
    const build = (crash?: Crash): Built => {
      const item = step('item', async ({ inputData }) => {
        if (crash && inputData === 0) await crash();
        return { doubled: inputData * 2 };
      });
      const workflow = createWorkflow({ id: 'foreach-no-progress', inputSchema: anySchema, outputSchema: anySchema })
        .foreach(item.step, { concurrency: 1 })
        .commit();
      return { workflow, fns: { item: item.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, [0, 1, 2]);

    expect(fns.item.mock.calls.map(call => call[0].inputData)).toEqual([0, 1, 2]);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('ignores malformed foreach progress in a stored snapshot and restarts every item', async () => {
    const build = (crash?: Crash): Built => {
      const item = step('item', async ({ inputData }) => {
        if (crash && inputData === 2) await crash();
        return { doubled: inputData * 2 };
      });
      const workflow = createWorkflow({ id: 'foreach-bad-progress', inputSchema: anySchema, outputSchema: anySchema })
        .foreach(item.step, { concurrency: 1 })
        .commit();
      return { workflow, fns: { item: item.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, [0, 1, 2], snapshot => {
      (snapshot.context.item as any).metadata.foreachProgress['0'] = null;
    });

    expect(fns.item.mock.calls.map(call => call[0].inputData)).toEqual([0, 1, 2]);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('keeps progress for items that returned undefined, which JSON storage drops', async () => {
    const build = (crash?: Crash): Built => {
      const item = step('item', async ({ inputData }) => {
        if (crash && inputData === 2) await crash();
        return undefined;
      });
      const workflow = createWorkflow({
        id: 'foreach-undefined-output',
        inputSchema: anySchema,
        outputSchema: anySchema,
      })
        .foreach(item.step, { concurrency: 1 })
        .commit();
      return { workflow, fns: { item: item.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, [0, 1, 2]);

    expect(fns.item.mock.calls.map(call => call[0].inputData)).toEqual([2]);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('writes at most one progress checkpoint per finished item, plus one running write', async () => {
    // Items no longer write their own start snapshot, and progress writes are coalesced
    // on one in-flight chain, so the foreach writes at most once per finished item plus
    // the running write before its first item.
    const payload = 'x'.repeat(200);
    const item = step('item', async ({ inputData }) => ({ index: inputData, payload }));
    const workflow = createWorkflow({ id: 'foreach-volume', inputSchema: anySchema, outputSchema: anySchema })
      .foreach(item.step, { concurrency: 8 })
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { wf: workflow } });
    const store = (await storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    let foreachWrites = 0;
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      if (args.snapshot.context.item?.status === 'running') foreachWrites++;
      return persist(args);
    });

    const items = Array.from({ length: 400 }, (_, i) => i);
    const run = await workflow.createRun();
    const result = await run.start({ inputData: items });

    expect(result.status).toBe('success');
    expect(item.fn).toHaveBeenCalledTimes(items.length);
    expect(foreachWrites).toBeGreaterThan(1);
    expect(foreachWrites, `foreach writes: ${foreachWrites}`).toBeLessThanOrEqual(items.length + 1);
    // The final snapshot is what main writes: the plain foreach result, no progress record.
    const stored = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(JSON.stringify(stored)).not.toContain('foreachProgress');
    expect((stored!.context.item as any).output).toEqual(items.map(index => ({ index, payload })));
  });
});

const RUN_TABLES = ['workflows', 'workflowRunHeaders', 'workflowRunEntries'] as const;
const WRITE_METHODS = [
  'persistWorkflowSnapshot',
  'updateWorkflowResults',
  'updateWorkflowState',
  'updateWorkflowRunHeader',
  'writeWorkflowRunCheckpoint',
  'appendWorkflowRunEntries',
  'appendWorkflowRunStateDraft',
  'deleteWorkflowRunById',
] as const;

type RunTables = Record<(typeof RUN_TABLES)[number], Map<string, any>>;

async function runTablesOf(storage: InstanceType<typeof MockStore>): Promise<RunTables> {
  return ((await storage.getStore('workflows')) as any).db;
}

function seeded(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Publishes foreach progress events only once storage has been asked for another write (or
 * after a while), like a pubsub slower than storage. Checkpoints then get taken while items
 * that already finished wait on their progress event.
 */
class SlowProgressPubSub extends EventEmitterPubSub {
  constructor(private readonly nextWrite: () => Promise<void>) {
    super();
  }

  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    if ((args[1] as any).data?.type === 'workflow-step-progress') await this.nextWrite();
    return super.publish(...args);
  }
}

/**
 * Runs the workflow to the end against a store whose writes are copied when called and land
 * after a random delay. When write number `crashAt` is called, keeps a copy of what storage
 * holds: what a process that died right then leaves behind. Then restores that copy into fresh
 * storage and restarts the run there with a freshly built workflow. Works for both storage
 * versions, since it copies the store's tables rather than a snapshot. Returns undefined when
 * the run made fewer writes, or none had landed yet.
 */
async function crashAtWrite(
  build: () => Built,
  {
    inputData,
    initialState,
    crashAt,
    seed,
  }: { inputData: unknown; initialState?: unknown; crashAt: number; seed: number },
) {
  const random = seeded(seed);
  let writeWaiters: Array<() => void> = [];
  const nextWrite = () =>
    new Promise<void>(resolve => {
      writeWaiters.push(resolve);
      setTimeout(resolve, 20);
    });
  const storage = new MockStore();
  const first = build();
  new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
  const store = (await storage.getStore('workflows'))! as any;
  const tables = await runTablesOf(storage);
  let writes = 0;
  let crashTables: RunTables | undefined;
  for (const method of WRITE_METHODS) {
    const write = store[method].bind(store);
    vi.spyOn(store, method).mockImplementation(async (args: any) => {
      if (writes++ === crashAt) {
        crashTables = Object.fromEntries(RUN_TABLES.map(table => [table, cloneRunData(tables[table])])) as RunTables;
      }
      const copy = cloneRunData(args);
      const waiters = writeWaiters;
      writeWaiters = [];
      waiters.forEach(release => release());
      await sleep(Math.floor(random() * 4));
      return write(copy);
    });
  }

  const run = await first.workflow.createRun({ pubsub: new SlowProgressPubSub(nextWrite) });
  const original = await run.start({ inputData, initialState });
  expect(original.status).toBe('success');
  if (!crashTables) return undefined;

  const second = build();
  const freshStorage = new MockStore();
  new Mastra({ logger: false, storage: freshStorage, workflows: { wf: second.workflow } });
  const freshTables = await runTablesOf(freshStorage);
  for (const table of RUN_TABLES) {
    for (const [key, value] of crashTables[table]) freshTables[table].set(key, value);
  }
  const freshStore = (await freshStorage.getStore('workflows'))!;
  const stored = await freshStore.loadWorkflowSnapshot({ workflowName: second.workflow.id, runId: run.runId });
  if (stored?.status !== 'running') return undefined;

  const restarted = await (await second.workflow.createRun({ runId: run.runId })).restart();
  return { original, restarted, fns: second.fns };
}

describe.each([1, 2] as const)('restart after a crash at any write inside a foreach (storage v%s)', storageVersion => {
  it("applies every item's state changes once, wherever the crash lands", async () => {
    // Items finish while progress checkpoints are in flight. A checkpoint that recorded an
    // item's state changes without recording the item as finished would make the restart run
    // it again on top of its own changes.
    const items = Array.from({ length: 12 }, (_, i) => i);
    const stateSchema = z.record(z.string(), z.number());
    const build = (): Built => {
      const random = seeded(7);
      const execute = vi.fn(async ({ inputData, state, setState }: any) => {
        await sleep(Math.floor(random() * 4));
        await setState({ ...state, [`n${inputData}`]: (state[`n${inputData}`] ?? 0) + 1 });
        return inputData;
      });
      const item = createStep({ id: 'item', inputSchema: z.number(), outputSchema: z.number(), stateSchema, execute });
      const report = createStep({
        id: 'report',
        inputSchema: anySchema,
        outputSchema: anySchema,
        stateSchema,
        execute: async ({ state }) => state,
      });
      const workflow = createWorkflow({
        id: 'foreach-state-once',
        inputSchema: z.array(z.number()),
        outputSchema: anySchema,
        stateSchema,
        options: { storageVersion },
      })
        .foreach(item, { concurrency: 4 })
        .then(report)
        .commit();
      return { workflow, fns: { item: execute } };
    };
    const expected = Object.fromEntries(items.map(i => [`n${i}`, 1]));

    let restarts = 0;
    for (let crashAt = 0; crashAt < 200; crashAt++) {
      const outcome = await crashAtWrite(build, { inputData: items, initialState: {}, crashAt, seed: crashAt });
      if (!outcome) {
        if (restarts > 0) break;
        continue;
      }
      restarts++;
      expect(outcome.original.result).toEqual(expected);
      expect(outcome.restarted.status, `crash at write ${crashAt}`).toBe('success');
      expect(outcome.restarted.result, `crash at write ${crashAt}`).toEqual(expected);
    }
    expect(restarts).toBeGreaterThan(3);
  });
});
