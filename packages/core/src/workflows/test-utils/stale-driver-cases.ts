/**
 * Shared cases for a default-engine run that another process took over while this process
 * stalled (a frozen event loop, a cut database link, a slow store). Run them against every store
 * with run fencing: the stalled process must stop instead of overwriting the new owner's run.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { IMastraLogger } from '../../logger';
import { noopLogger } from '../../logger';
import { Mastra } from '../../mastra';
import type { MastraStorage } from '../../storage';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import { RUN_FENCE_CONFLICT_ERROR_ID, resolveRunFence } from '../../storage/run-fencing';
import type { RunFence } from '../../storage/run-fencing';
import { createWorkflow } from '../create';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS } from '../run-ownership';
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
  'deleteWorkflowRunById',
] as const;

type WriteRecord = { method: string; runId?: string; fenced: boolean; refused?: boolean; error?: unknown };

const empty = z.object({});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function gate() {
  const { promise, resolve } = deferred();
  return { wait: () => promise, open: () => resolve() };
}

/**
 * Records every workflows write and whether it carried a fence. `holdNext()` holds the next write
 * before it reaches the store, as a request sent just before a network cut lands after it heals.
 */
function recordWrites(store: WorkflowsStorage) {
  const writes: WriteRecord[] = [];
  let held: { arrived: () => void; release: Promise<void> } | undefined;
  for (const method of WRITE_METHODS) {
    const original = (store as any)[method].bind(store);
    vi.spyOn(store as any, method).mockImplementation(async (args: any) => {
      const hold = held;
      held = undefined;
      if (hold) {
        hold.arrived();
        await hold.release;
      }
      const record: WriteRecord = {
        method,
        runId: args?.runId,
        fenced: !!resolveRunFence(store, args?.fence, args?.runId),
      };
      writes.push(record);
      try {
        return await original(args);
      } catch (error) {
        record.refused = (error as { id?: string })?.id === RUN_FENCE_CONFLICT_ERROR_ID;
        record.error = error;
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
  };
}

function recordingLogger() {
  const warnings: string[] = [];
  const logger = { ...noopLogger, warn: (message: string) => warnings.push(message) } as IMastraLogger;
  return { logger, lostWarnings: () => warnings.filter(w => w.startsWith('Stopped driving a workflow run')) };
}

export function describeStaleDriverCases({ getStorage }: { getStorage: () => MastraStorage }) {
  describe.each([1, 2] as const)('default engine run taken over by another process (storage v%i)', storageVersion => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    /**
     * `build` returns the workflow the case runs, or that workflow followed by others to register
     * with it (a nested workflow resumed on its own).
     */
    async function setup(
      build: (opts: { id: string; options: Record<string, any> }) => AnyWorkflow | AnyWorkflow[],
      extraOptions: Record<string, any> = {},
    ) {
      const storage = getStorage();
      const store = (await storage.getStore('workflows'))!;
      expect(await store.supportsRunFencing()).toBe(true);
      const callbacks = { onFinish: vi.fn(), onError: vi.fn() };
      const id = `stale-driver-${storageVersion}-${crypto.randomUUID()}`;
      const built = build({ id, options: { storageVersion, ...callbacks, ...extraOptions } });
      const workflows = Array.isArray(built) ? built : [built];
      const { logger, lostWarnings } = recordingLogger();
      const mastra = new Mastra({
        logger,
        storage,
        workflows: Object.fromEntries(workflows.map(workflow => [workflow.id, workflow])),
      });
      const recorder = recordWrites(store);
      return { store, mastra, workflow: mastra.getWorkflow(id), id, callbacks, lostWarnings, ...recorder };
    }

    /** Another process claims the run, as the recovery sweep's restart would, and leaves it running. */
    async function takeOver(store: WorkflowsStorage, runId: string): Promise<RunFence> {
      const claim = await store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs: 60_000, force: true });
      expect(claim.acquired).toBe(true);
      return { runId, generation: claim.record!.generation, ownerId: 'other-process' };
    }

    /** Another process claims the run and finishes it. */
    async function takeOverAndFinish(store: WorkflowsStorage, workflowName: string, runId: string) {
      const fence = await takeOver(store, runId);
      await store.updateWorkflowState({ workflowName, runId, opts: { status: 'success' }, fence });
      return fence;
    }

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

    function staleWritesAfter(writes: WriteRecord[], index: number) {
      return writes.slice(index);
    }

    it("keeps the new owner's finished run when the stalled process wakes up", async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, callbacks, lostWarnings, writes } = await setup(({ id, options }) =>
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
          .commit(),
      );

      const run = await workflow.createRun();
      const created = writes.length;
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      // Every write of the execution carried its claim: a claim on one store with writes going to
      // another would leave them unfenced.
      const driving = writes.slice(created);
      expect(driving.length).toBeGreaterThan(0);
      expect(driving.every(w => w.fenced)).toBe(true);

      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(ran).toEqual(['a']);
      const stale = staleWritesAfter(writes, afterTakeover);
      expect(stale.length).toBeGreaterThan(0);
      expect(stale.every(w => w.refused)).toBe(true);
      const stored = await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      expect(stored?.status).toBe('success');
      expect(stored?.context?.b).toBeUndefined();
      expect(callbacks.onFinish).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(lostWarnings()).toHaveLength(1);
    });

    // The order seen in the chaos soak: the step's result write leaves before the database link is
    // cut and reaches it after another process took the run over.
    it('refuses a write sent before the takeover that reaches the store after it', async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, writes, holdNext } = await setup(({ id, options }) =>
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
          .commit(),
      );

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      const resultWrite = holdNext();
      stalled.open();
      await resultWrite.arrived;

      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      resultWrite.release();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(ran).toEqual(['a']);
      const stale = staleWritesAfter(writes, afterTakeover);
      expect(stale[0]).toMatchObject({ fenced: true, refused: true });
      expect(stale.every(w => w.refused)).toBe(true);
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // The background renewal finds the takeover while the attempt runs, so the failed attempt isn't retried.
    it('does not retry a failed step after the run was taken over', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      let attempts = 0;
      const stalled = gate();
      const { store, workflow, id, callbacks, lostWarnings } = await setup(({ id, options }) =>
        createWorkflow({ id, inputSchema: empty, outputSchema: empty, options })
          .then(
            createStep({
              id: 'a',
              inputSchema: empty,
              outputSchema: empty,
              retries: 2,
              execute: async () => {
                attempts++;
                await stalled.wait();
                throw new Error('upstream timeout');
              },
            }),
          )
          .commit(),
      );

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(attempts).toBe(1));
      await takeOverAndFinish(store, id, run.runId);
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS + 100);
      await vi.waitFor(() => expect(lostWarnings()).toHaveLength(1));
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(attempts).toBe(1);
      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(callbacks.onFinish).not.toHaveBeenCalled();
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // Foreach items write nothing before their body, so the stalled process can run the next items.
    // Their results are refused at the foreach's write and never stored.
    it('never stores the foreach items it ran after the run was taken over', async () => {
      const ran: number[] = [];
      const stalled = gate();
      const item = z.object({ n: z.number() });
      const { store, workflow, id } = await setup(({ id, options }) =>
        createWorkflow({ id, inputSchema: z.array(item), outputSchema: z.array(item), options })
          .foreach(
            createStep({
              id: 'charge',
              inputSchema: item,
              outputSchema: item,
              execute: async ({ inputData }) => {
                ran.push(inputData.n);
                if (inputData.n === 1) await stalled.wait();
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
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      const stored = await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      expect(stored?.status).toBe('success');
      expect(stored?.context?.charge?.status).not.toBe('success');
    });

    // A late renewal is not a loss: nobody else claimed the run, so the renewal succeeds and the run goes on.
    it('keeps running when its lease lapsed but nobody else claimed the run', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, callbacks } = await setup(({ id, options }) =>
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
          .commit(),
      );

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      vi.setSystemTime(Date.now() + WORKFLOW_RUN_LEASE_TTL_MS + 1_000);
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS + 100);
      stalled.open();
      const result = await done;

      expect(result.status).toBe('success');
      expect(ran).toEqual(['a', 'b']);
      expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // A nested run is stored under the parent's runId, a foreach item's under its own; both carry
    // the parent's claim, and losing it must not cancel the child the new owner drives.
    it.each(['nested workflow', 'foreach nested workflow'] as const)(
      'leaves a %s alone when the parent run was taken over',
      async shape => {
        const ran: string[] = [];
        const stalled = gate();
        const childCallbacks = { onFinish: vi.fn(), onError: vi.fn() };
        let childId = '';
        const { store, workflow, id, callbacks } = await setup(({ id, options }) => {
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
          const after = createStep({
            id: 'after',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async () => {
              ran.push('after');
              return {};
            },
          });
          return shape === 'nested workflow'
            ? createWorkflow({ id, inputSchema: empty, outputSchema: z.any(), options })
                .then(child)
                .then(after)
                .commit()
            : createWorkflow({ id, inputSchema: z.array(empty), outputSchema: z.any(), options })
                .foreach(child)
                .then(after)
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
        const result = await done;

        expect(result.status).toBe('waiting');
        expect(ran).toEqual(['c1']);
        const child = await store.loadWorkflowSnapshot({ workflowName: childId, runId: childRunId });
        expect(child?.status).not.toBe('canceled');
        expect(child?.context?.c2).toBeUndefined();
        expect(childCallbacks.onFinish).not.toHaveBeenCalled();
        expect(childCallbacks.onError).not.toHaveBeenCalled();
        expect(callbacks.onFinish).not.toHaveBeenCalled();
        expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
      },
    );

    // The run object is cached per runId, so a restart in the same process reuses it. The stale
    // execution's return must leave it to the execution now driving the run.
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
      expect(await workflow.createRun({ runId: run.runId })).toBe(run);
      const newer = run.restart();
      await vi.waitFor(() => expect(ran).toEqual(['a', 'a', 'b']));

      first.open();
      expect((await stale).status).toBe('waiting');
      expect(await workflow.createRun({ runId: run.runId })).toBe(run);
      expect(run.workflowRunStatus).toBe('running');

      second.open();
      expect((await newer).status).toBe('success');
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    }, 10_000);

    // The order of the soak's sleep-long-default-1577: the stalled process learns of the takeover from
    // its background renewal, before it writes anything, and then writes nothing.
    it('stops without writing when its background renewal finds the run taken over', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, lostWarnings, writes } = await setup(stalledThenNext(ran, stalled));

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS + 100);
      await vi.waitFor(() => expect(lostWarnings()).toHaveLength(1));
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(ran).toEqual(['a']);
      expect(staleWritesAfter(writes, afterTakeover)).toEqual([]);
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // Cancellation is about the run, not about which process drives it, so a cancel() sent to the
    // stalled process still lands, and the new owner stops at its next cancellation check.
    it.each(['while it is still stalled', 'after it stopped'] as const)(
      'lands a cancel() sent to the stalled process %s',
      async when => {
        const ran: string[] = [];
        const stalled = gate();
        const { store, workflow, id } = await setup(stalledThenNext(ran, stalled));

        const run = await workflow.createRun();
        const done = run.start({ inputData: {} });
        await vi.waitFor(() => expect(ran).toEqual(['a']));
        await takeOver(store, run.runId);
        if (when === 'after it stopped') {
          stalled.open();
          expect((await done).status).toBe('waiting');
          await run.cancel();
        } else {
          await run.cancel();
          stalled.open();
          await done;
        }

        expect(ran).toEqual(['a']);
        expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('canceled');
      },
    );

    // A run that persists no terminal status makes no write storage could refuse at its end. Once the
    // background renewal found the takeover, it doesn't report an end of its own.
    it('does not report success when the run persists no terminal status', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, callbacks, lostWarnings } = await setup(
        ({ id, options }) =>
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
            .commit(),
        // Persisting `waiting` is what makes the run recoverable, so it still claims the run.
        { shouldPersistSnapshot: ({ workflowStatus }: { workflowStatus: string }) => workflowStatus === 'waiting' },
      );

      const run = await workflow.createRun();
      const done = run.start({ inputData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['a']));
      await takeOver(store, run.runId);
      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS + 100);
      await vi.waitFor(() => expect(lostWarnings()).toHaveLength(1));
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(callbacks.onFinish).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    // startAsync() claims the run and then saves its first `waiting` snapshot. When that save reaches
    // the store after another process took the run over and finished it, it's refused.
    it('refuses a delayed startAsync() dispatch save after the run was taken over', async () => {
      const ran: string[] = [];
      const stalled = gate();
      const { store, workflow, id, writes, holdNext } = await setup(stalledThenNext(ran, stalled));

      const run = await workflow.createRun();
      const dispatchSave = holdNext();
      const started = run.startAsync({ inputData: {} }).then(
        () => undefined,
        (error: unknown) => error,
      );
      await dispatchSave.arrived;
      await takeOverAndFinish(store, id, run.runId);
      const afterTakeover = writes.length;
      dispatchSave.release();
      const error = await started;
      stalled.open();

      expect(error).toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
      expect(ran).toEqual([]);
      expect(writes.slice(afterTakeover)).toEqual([expect.objectContaining({ fenced: true, refused: true })]);
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // A nested run resumed on its own flips its suspended parent to running and holds the parent's
    // lease. When it loses that lease, the parent belongs to another process: the child must not set
    // it back to suspended.
    it('leaves the parent running when a nested run resumed on its own loses the run', async () => {
      const ran: string[] = [];
      const stalled = gate();
      let childId = '';
      const { store, mastra, workflow, id } = await setup(({ id, options }) => {
        childId = `${id}-child`;
        const child = createWorkflow({
          id: childId,
          inputSchema: empty,
          outputSchema: empty,
          options: { storageVersion },
        })
          .then(
            createStep({
              id: 's1',
              inputSchema: empty,
              outputSchema: empty,
              resumeSchema: empty,
              execute: async ({ resumeData, suspend }) => {
                if (!resumeData) {
                  await suspend({});
                  return {};
                }
                ran.push('s1');
                await stalled.wait();
                return {};
              },
            }),
          )
          .then(
            createStep({
              id: 's2',
              inputSchema: empty,
              outputSchema: empty,
              execute: async () => {
                ran.push('s2');
                return {};
              },
            }),
          )
          .commit();
        const parent = createWorkflow({ id, inputSchema: empty, outputSchema: z.any(), options }).then(child).commit();
        return [parent, child];
      });

      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      const childRun = await mastra.getWorkflow(childId).createRun({ runId: run.runId });
      const resumed = childRun.resume({ step: 's1', resumeData: {} });
      await vi.waitFor(() => expect(ran).toEqual(['s1']));
      expect(await store.loadWorkflowRunStatus({ workflowName: id, runId: run.runId })).toBe('running');

      await takeOver(store, run.runId);
      stalled.open();
      expect((await resumed).status).toBe('waiting');

      expect(ran).toEqual(['s1']);
      expect(await store.loadWorkflowRunStatus({ workflowName: id, runId: run.runId })).toBe('running');
    });
  });
}
