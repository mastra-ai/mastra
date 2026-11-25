/**
 * Shared cases for a default-engine run that another process took over while this process stalled
 * (a frozen event loop, a cut database link, a slow store). Run them against every store with run
 * fencing: storage refuses the stalled process's saves, and its call rejects.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { IMastraLogger } from '../../logger';
import { noopLogger } from '../../logger';
import { Mastra } from '../../mastra';
import type { MastraStorage } from '../../storage';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import { RUN_FENCE_CONFLICT_ERROR_ID, resolveRunFence } from '../../storage/run-fencing';
import { createWorkflow } from '../create';
import { createStep } from '../workflow';
import type { AnyWorkflow } from '../workflow';

const WRITE_METHODS = [
  'persistWorkflowSnapshot',
  'updateWorkflowResults',
  'updateWorkflowState',
  'updateWorkflowRunHeader',
  'writeWorkflowRunCheckpoint',
  'appendWorkflowRunEntries',
  'mergeWorkflowRunStepResult',
  'appendWorkflowRunStateDraft',
] as const;

type WriteRecord = { runId?: string; fenced: boolean; refused?: boolean };

const empty = z.object({});
const conflict = { id: RUN_FENCE_CONFLICT_ERROR_ID };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => (resolve = done));
  return { promise, resolve };
}

function gate() {
  const { promise, resolve } = deferred();
  return { wait: () => promise, open: () => resolve() };
}

/**
 * Records every workflows save and whether it carried a fence. `holdNext()` holds the next save
 * before it reaches the store, as a request sent just before a network cut lands after it heals.
 * After `failWrites()`, every save fails as on a lost database connection.
 */
function recordWrites(store: WorkflowsStorage) {
  const writes: WriteRecord[] = [];
  let held: { arrived: () => void; release: Promise<void> } | undefined;
  let failing = false;
  for (const method of WRITE_METHODS) {
    const original = (store as any)[method].bind(store);
    vi.spyOn(store as any, method).mockImplementation(async (args: any) => {
      if (failing) throw new Error('Connection terminated unexpectedly');
      const hold = held;
      held = undefined;
      if (hold) {
        hold.arrived();
        await hold.release;
      }
      const record: WriteRecord = { runId: args?.runId, fenced: !!resolveRunFence(store, args?.fence, args?.runId) };
      writes.push(record);
      try {
        return await original(args);
      } catch (error) {
        record.refused = (error as { id?: string })?.id === RUN_FENCE_CONFLICT_ERROR_ID;
        throw error;
      }
    });
  }
  return {
    writes,
    holdNext() {
      const arrived = deferred();
      const release = deferred();
      held = { arrived: arrived.resolve, release: release.promise };
      return { arrived: arrived.promise, release: release.resolve };
    },
    failWrites() {
      failing = true;
    },
  };
}

function recordingLogger() {
  const warnings: string[] = [];
  const errors: string[] = [];
  const logger = {
    ...noopLogger,
    warn: (message: string) => warnings.push(message),
    error: (message: string) => errors.push(message),
  } as IMastraLogger;
  return { logger, logged: () => ({ warnings, errors }) };
}

/** The one warning a process logs when it learns it lost the run, and nothing else. */
const LOST_RUN_ONLY = { warnings: [expect.stringMatching(/^Stopped driving a workflow run/)], errors: [] };

export function describeStaleDriverCases({ getStorage }: { getStorage: () => MastraStorage }) {
  describe.each([1, 2] as const)('default engine run taken over by another process (storage v%i)', storageVersion => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** `build` returns the workflow the case runs, or that workflow followed by others to register with it. */
    async function setup(build: (opts: { id: string; options: Record<string, any> }) => AnyWorkflow | AnyWorkflow[]) {
      const storage = getStorage();
      const store = (await storage.getStore('workflows'))!;
      expect(await store.supportsRunFencing()).toBe(true);
      const callbacks = { onFinish: vi.fn(), onError: vi.fn() };
      const id = `stale-driver-${storageVersion}-${crypto.randomUUID()}`;
      const built = build({ id, options: { storageVersion, ...callbacks } });
      const workflows = Array.isArray(built) ? built : [built];
      const { logger, logged } = recordingLogger();
      const mastra = new Mastra({
        logger,
        storage,
        workflows: Object.fromEntries(workflows.map(workflow => [workflow.id, workflow])),
      });
      const recorder = recordWrites(store);
      return { store, mastra, workflow: mastra.getWorkflow(id), id, callbacks, logged, ...recorder };
    }

    /** Another process claims the run, as the recovery sweep's restart would, and leaves it running. */
    async function takeOver(store: WorkflowsStorage, runId: string) {
      const claim = await store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs: 60_000, force: true });
      expect(claim.acquired).toBe(true);
      return { runId, generation: claim.record!.generation, ownerId: 'other-process' };
    }

    /** Another process claims the run and finishes it. */
    async function takeOverAndFinish(store: WorkflowsStorage, workflowName: string, runId: string) {
      const fence = await takeOver(store, runId);
      await store.updateWorkflowState({ workflowName, runId, opts: { status: 'success' }, fence });
    }

    const loadStatus = async (store: WorkflowsStorage, workflowName: string, runId: string) =>
      (await store.loadWorkflowSnapshot({ workflowName, runId }))?.status;

    /** A two-step workflow whose first step waits for `stalled`. */
    function stalledThenNext(ran: string[], stalled: ReturnType<typeof gate>) {
      return ({ id, options }: { id: string; options: Record<string, any> }) =>
        createWorkflow({ id, inputSchema: empty, outputSchema: empty, options })
          .then(
            createStep({
              id: 'a',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                ran.push('a');
                await stalled.wait();
                return {};
              },
            }),
          )
          .then(
            createStep({
              id: 'b',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                ran.push('b');
                return {};
              },
            }),
          )
          .commit();
    }

    it("keeps the new owner's finished run when the stalled process wakes up", async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, callbacks, logged, writes } = await setup(stalledThenNext(ran, stalled));

      const run = await workflow.createRun();
      const created = writes.length;
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      // Every save of the execution carried its claim.
      const driving = writes.slice(created);
      expect(driving.length).toBeGreaterThan(0);
      expect(driving.every(w => w.fenced)).toBe(true);

      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      stalled.open();

      await expect(done).rejects.toMatchObject(conflict);
      expect(ran).toEqual(['a']);
      const stale = writes.slice(afterTakeover);
      expect(stale.length).toBeGreaterThan(0);
      expect(stale.every(w => w.refused)).toBe(true);
      const stored = await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      expect(stored?.status).toBe('success');
      expect(stored?.context?.b).toBeUndefined();
      expect(callbacks.onFinish).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(logged()).toEqual(LOST_RUN_ONLY);
    });

    it("keeps the new owner's finished run when a stalled resume() wakes up", async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, logged } = await setup(({ id, options }) =>
        createWorkflow({ id, inputSchema: empty, outputSchema: empty, options })
          .then(
            createStep({
              id: 'approve',
              inputSchema: empty,
              outputSchema: empty,
              resumeSchema: empty,
              execute: async ({ resumeData, suspend }) => {
                if (!resumeData) return suspend({});
                ran.push('approve');
                await stalled.wait();
                return {};
              },
            }),
          )
          .commit(),
      );

      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      const resumed = run.resume({ step: 'approve', resumeData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['approve']));
      await takeOverAndFinish(store, id, run.runId);
      stalled.open();

      await expect(resumed).rejects.toMatchObject(conflict);
      expect(await loadStatus(store, id, run.runId)).toBe('success');
      expect(logged()).toEqual(LOST_RUN_ONLY);
    });

    // resumeAsync() returned long before, so its rejection only reaches a log. A takeover is the new
    // owner's run going on and logs no error; a store failure still does.
    it.each(['takeover', 'store failure'] as const)('logs a resumeAsync() run that had a %s as such', async how => {
      const stalled = gate();
      const reached = gate();
      const { store, workflow, id, logged, failWrites } = await setup(({ id, options }) =>
        createWorkflow({ id, inputSchema: empty, outputSchema: empty, options })
          .then(
            createStep({
              id: 'approve',
              inputSchema: empty,
              outputSchema: empty,
              resumeSchema: empty,
              execute: async ({ resumeData, suspend }) => {
                if (!resumeData) return suspend({});
                reached.open();
                await stalled.wait();
                return {};
              },
            }),
          )
          .commit(),
      );
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      // Spied after the start, whose own release would resolve it.
      const released = deferred();
      const release = store.releaseRunOwnership.bind(store);
      vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
        await release(fence);
        released.resolve();
      });
      await run.resumeAsync({ step: 'approve', resumeData: {} });
      await reached.wait();
      if (how === 'takeover') await takeOverAndFinish(store, id, run.runId);
      else failWrites();
      stalled.open();
      // The resume rejects once it released its lease, with nothing left to wait for but microtasks.
      await released.promise;
      await new Promise(resolve => setImmediate(resolve));

      if (how === 'takeover') {
        expect(logged()).toEqual(LOST_RUN_ONLY);
      } else {
        expect(logged().errors).toContainEqual(expect.stringContaining('Background resume failed'));
      }
    });

    // The takeover lands between time travel's lease claim and its first save, so the rollback of its
    // status claim is refused as well, and the run stays as the new owner has it.
    it('leaves a time-traveled run to the process that took it over before its first save', async () => {
      const ran: string[] = [];
      const open = gate();
      open.open();
      const { store, workflow, id, logged } = await setup(stalledThenNext(ran, open));

      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('success');
      const claim = store.claimRunOwnership.bind(store);
      vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
        const claimed = await claim(args);
        if (args.ownerId !== 'other-process') await takeOver(store, run.runId);
        return claimed;
      });

      await expect(run.timeTravel({ step: 'b' })).rejects.toMatchObject(conflict);
      expect(ran).toEqual(['a', 'b']);
      expect(await loadStatus(store, id, run.runId)).toBe('running');
      expect(logged()).toEqual(LOST_RUN_ONLY);
    });

    // A step that starts another workflow by hand gets that run's conflict as an ordinary error. The
    // outer run still holds its own claim, so it retries the step and fails as usual.
    it('fails a step whose separately started run was taken over, like any step error', async () => {
      const stalls: ReturnType<typeof gate>[] = [];
      const innerRunIds: string[] = [];
      let innerId = '';
      const { store, workflow, id, callbacks } = await setup(({ id, options }) => {
        innerId = `${id}-inner`;
        const inner = createWorkflow({
          id: innerId,
          inputSchema: empty,
          outputSchema: empty,
          options: { storageVersion },
        })
          .then(
            createStep({
              id: 'i1',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                const stall = gate();
                stalls.push(stall);
                await stall.wait();
                return {};
              },
            }),
          )
          .commit();
        const outer = createWorkflow({
          id,
          inputSchema: empty,
          outputSchema: empty,
          options,
          retryConfig: { attempts: 1 },
        })
          .then(
            createStep({
              id: 'o1',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                const innerRun = await inner.createRun();
                innerRunIds.push(innerRun.runId);
                await innerRun.start({ inputData: {} });
                return {};
              },
            }),
          )
          .commit();
        return [outer, inner];
      });

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      for (const attempt of [0, 1]) {
        await vi.waitFor(() => expect(stalls).toHaveLength(attempt + 1));
        await takeOverAndFinish(store, innerId, innerRunIds[attempt]!);
        stalls[attempt]!.open();
      }

      expect((await done).status).toBe('failed');
      expect(innerRunIds).toHaveLength(2);
      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      expect(await loadStatus(store, id, run.runId)).toBe('failed');
    });

    // The order seen in the chaos soak: the step's result save leaves before the database link is
    // cut and reaches it after another process took the run over.
    it('refuses a save sent before the takeover that reaches the store after it', async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, writes, holdNext } = await setup(stalledThenNext(ran, stalled));

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      const resultSave = holdNext();
      stalled.open();
      await resultSave.arrived;

      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      resultSave.release();

      await expect(done).rejects.toMatchObject(conflict);
      expect(ran).toEqual(['a']);
      expect(writes.slice(afterTakeover)).toEqual([expect.objectContaining({ fenced: true, refused: true })]);
      expect(await loadStatus(store, id, run.runId)).toBe('success');
    });

    // Foreach items save nothing before their body, so the stalled process can start the next item
    // before its checkpoint is refused. That item's result is never stored, and no item starts after it.
    it('never stores the foreach items it ran after the run was taken over', async () => {
      const ran: number[] = [];
      const stalled = gate();
      const refused = gate();
      const item = z.object({ n: z.number() });
      const { store, workflow, id, logged, writes } = await setup(({ id, options }) =>
        createWorkflow({ id, inputSchema: z.array(item), outputSchema: z.array(item), options })
          .foreach(
            createStep({
              id: 'charge',
              inputSchema: item,
              outputSchema: item,
              execute: async ({ inputData }) => {
                ran.push(inputData.n);
                if (inputData.n === 1) await stalled.wait();
                // Holds item 2, if it started, until item 1's checkpoint was refused.
                if (inputData.n === 2) await refused.wait();
                return inputData;
              },
            }),
            { concurrency: 1 },
          )
          .commit(),
      );

      const run = await workflow.createRun();
      const done = run.start({ inputData: [{ n: 1 }, { n: 2 }, { n: 3 }] });
      await vi.waitFor(() => expect(ran).toEqual([1]));
      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      stalled.open();
      await vi.waitFor(() => expect(writes.slice(afterTakeover).some(w => w.refused)).toBe(true));
      refused.open();

      await expect(done).rejects.toMatchObject(conflict);
      expect([[1], [1, 2]]).toContainEqual(ran);
      const stored = await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      expect(stored?.status).toBe('success');
      expect(stored?.context?.charge?.status).not.toBe('success');
      expect(logged()).toEqual(LOST_RUN_ONLY);
    });

    // A nested run is stored under the parent's runId, a foreach item's under its own; both carry the
    // parent's claim. The refused save inside the parent's step body must not retry the step (that would
    // run the child again) nor cancel the child the new owner drives.
    it.each(['nested workflow', 'foreach nested workflow'] as const)(
      'leaves a %s alone, without retrying it, when the parent run was taken over',
      async shape => {
        const ran: string[] = [];
        const stalled = gate();
        const childCallbacks = { onFinish: vi.fn(), onError: vi.fn() };
        let childId = '';
        const { store, workflow, id, callbacks, logged } = await setup(({ id, options }) => {
          childId = `${id}-child`;
          const child = createWorkflow({
            id: childId,
            inputSchema: empty,
            outputSchema: empty,
            options: { storageVersion, ...childCallbacks },
          })
            .then(
              createStep({
                id: 'c1',
                inputSchema: empty,
                outputSchema: empty,
                execute: async () => {
                  ran.push('c1');
                  await stalled.wait();
                  return {};
                },
              }),
            )
            .then(
              createStep({
                id: 'c2',
                inputSchema: empty,
                outputSchema: empty,
                execute: async () => {
                  ran.push('c2');
                  return {};
                },
              }),
            )
            .commit();
          const retryConfig = { attempts: 2 };
          return shape === 'nested workflow'
            ? createWorkflow({ id, inputSchema: empty, outputSchema: z.any(), options, retryConfig })
                .then(child)
                .commit()
            : createWorkflow({ id, inputSchema: z.array(empty), outputSchema: z.any(), options, retryConfig })
                .foreach(child)
                .commit();
        });

        const run = await workflow.createRun();
        const done = run.start({ inputData: shape === 'nested workflow' ? {} : [{}] } as any);
        await vi.waitFor(() => expect(ran).toEqual(['c1']));
        const childRuns = await store.listWorkflowRuns({ workflowName: childId });
        expect(childRuns.runs).toHaveLength(1);
        const childRunId = childRuns.runs[0]!.runId;

        await takeOverAndFinish(store, id, run.runId);
        stalled.open();

        await expect(done).rejects.toMatchObject(conflict);
        expect(ran).toEqual(['c1']);
        const child = await store.loadWorkflowSnapshot({ workflowName: childId, runId: childRunId });
        expect(child?.status).toBe('running');
        expect(child?.context?.c2).toBeUndefined();
        expect([childCallbacks, callbacks].flatMap(c => [...c.onFinish.mock.calls, ...c.onError.mock.calls])).toEqual(
          [],
        );
        expect(await loadStatus(store, id, run.runId)).toBe('success');
        expect(logged()).toEqual(LOST_RUN_ONLY);
      },
    );

    // The Run object is cached per runId, so a restart in the same process reuses it. A stale execution
    // rejects before it touches the Run, which stays with the execution now driving the run.
    it('leaves the cached run to a newer execution in the same process', async () => {
      const ran: string[] = [];
      const first = gate();
      const second = gate();
      const { store, workflow, id } = await setup(({ id, options }) =>
        createWorkflow({ id, inputSchema: empty, outputSchema: empty, options })
          .then(
            createStep({
              id: 'a',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                ran.push('a');
                if (ran.length === 1) await first.wait();
                return {};
              },
            }),
          )
          .then(
            createStep({
              id: 'b',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                ran.push('b');
                await second.wait();
                return {};
              },
            }),
          )
          .commit(),
      );

      const run = await workflow.createRun();
      const stale = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      // The first execution's lease lapses (released here), and this process restarts the run.
      const owner = (await store.getRunOwnership({ runId: run.runId }))!;
      await store.releaseRunOwnership({ runId: run.runId, generation: owner.generation, ownerId: owner.ownerId });
      const newer = run.restart();
      await vi.waitFor(() => expect(ran).toEqual(['a', 'a', 'b']));

      first.open();
      await expect(stale).rejects.toMatchObject(conflict);
      expect(await workflow.createRun({ runId: run.runId })).toBe(run);

      second.open();
      expect((await newer).status).toBe('success');
      expect(await loadStatus(store, id, run.runId)).toBe('success');
    }, 10_000);

    // Control, passes without fencing too: cancellation is about the run, not about which process
    // drives it, so a cancel() sent to the stalled process still lands.
    it('lands a cancel() sent to the stalled process', async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id } = await setup(stalledThenNext(ran, stalled));

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} }).catch(error => error);
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      await takeOver(store, run.runId);
      await run.cancel();
      stalled.open();
      await done;

      expect(ran).toEqual(['a']);
      expect(await loadStatus(store, id, run.runId)).toBe('canceled');
    });

    // startAsync() claims the run, then saves its first `waiting` snapshot. When that save reaches the
    // store after another process took the run over and finished it, it's refused.
    it('refuses a delayed startAsync() dispatch save after the run was taken over', async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, writes, holdNext, logged } = await setup(stalledThenNext(ran, stalled));

      const run = await workflow.createRun();
      const dispatchSave = holdNext();
      const started = run.startAsync({ inputData: {} });
      await dispatchSave.arrived;
      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      dispatchSave.release();

      await expect(started).rejects.toMatchObject(conflict);
      stalled.open();
      expect(ran).toEqual([]);
      expect(writes.slice(afterTakeover)).toEqual([expect.objectContaining({ fenced: true, refused: true })]);
      expect(await loadStatus(store, id, run.runId)).toBe('success');
      expect(logged()).toEqual(LOST_RUN_ONLY);
    });

    // startAsync() returned long before, so nobody awaits the stale execution's rejection.
    it('logs no error when a run started with startAsync() is taken over', async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, logged } = await setup(stalledThenNext(ran, stalled));
      const released = deferred();
      const release = store.releaseRunOwnership.bind(store);
      vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
        await release(fence);
        released.resolve();
      });

      const run = await workflow.createRun();
      await run.startAsync({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      await takeOverAndFinish(store, id, run.runId);
      stalled.open();
      // The execution rejects once it released its lease, with nothing left to wait for but microtasks.
      await released.promise;
      await new Promise(resolve => setImmediate(resolve));

      expect(ran).toEqual(['a']);
      expect(await loadStatus(store, id, run.runId)).toBe('success');
      expect(logged()).toEqual(LOST_RUN_ONLY);
    });

    // A nested run resumed on its own flips its suspended parent to running and holds the parent's
    // lease, which it hands to the parent's resume once it finished. When another process takes the
    // parent over meanwhile, neither may set the parent back to suspended or finish it.
    it.each(['nested run', 'parent'] as const)(
      'leaves the parent running when another process takes it over while the %s runs, after a direct resume of the nested run',
      async stalls => {
        const ran: string[] = [];
        const stalled = gate();
        let childId = '';
        const { store, mastra, workflow, id, logged } = await setup(({ id, options }) => {
          childId = `${id}-child`;
          const step = (stepId: string, stallsHere: boolean) =>
            createStep({
              id: stepId,
              inputSchema: z.any(),
              outputSchema: z.any(),
              resumeSchema: empty,
              execute: async ({ resumeData, suspend }) => {
                if (stepId === 's1' && !resumeData) return suspend({});
                ran.push(stepId);
                if (stallsHere) await stalled.wait();
                return {};
              },
            });
          const child = createWorkflow({
            id: childId,
            inputSchema: empty,
            outputSchema: z.any(),
            options: { storageVersion },
          })
            .then(step('s1', stalls === 'nested run'))
            .commit();
          const parent = createWorkflow({ id, inputSchema: empty, outputSchema: z.any(), options })
            .then(child)
            .then(step('after', stalls === 'parent'))
            .commit();
          return [parent, child];
        });

        const run = await workflow.createRun();
        expect((await run.start({ inputData: {} })).status).toBe('suspended');
        const childRun = await mastra.getWorkflow(childId).createRun({ runId: run.runId });
        const resumed = childRun.resume({ step: 's1', resumeData: {} });
        const stallingStep = stalls === 'nested run' ? 's1' : 'after';
        await vi.waitFor(() => expect(ran).toContain(stallingStep));
        expect(await store.loadWorkflowRunStatus({ workflowName: id, runId: run.runId })).toBe('running');

        await takeOver(store, run.runId);
        stalled.open();

        if (stalls === 'nested run') {
          await expect(resumed).rejects.toMatchObject(conflict);
        } else {
          expect((await resumed).status).toBe('success');
          // The parent's resume runs in the background of the nested run's, on the cached parent Run.
          await expect((run as any).executionResults).rejects.toMatchObject(conflict);
          await new Promise(resolve => setImmediate(resolve));
        }
        const parent = await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
        expect(parent?.status).toBe('running');
        expect(parent?.context?.after).toBeUndefined();
        expect(logged()).toEqual(LOST_RUN_ONLY);
      },
    );
  });
}
