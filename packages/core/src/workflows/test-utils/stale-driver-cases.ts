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
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../run-ownership';
import { createStep } from '../workflow';

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

function gate() {
  const { promise, resolve } = Promise.withResolvers<void>();
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
      const arrived = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
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

    async function setup(build: (opts: { id: string; options: any }) => any) {
      const storage = getStorage();
      const store = (await storage.getStore('workflows'))!;
      expect(await store.supportsRunFencing()).toBe(true);
      const callbacks = { onFinish: vi.fn(), onError: vi.fn() };
      const id = `stale-driver-${storageVersion}-${crypto.randomUUID()}`;
      const workflow = build({ id, options: { storageVersion, ...callbacks } });
      const { logger, lostWarnings } = recordingLogger();
      const mastra = new Mastra({ logger, storage, workflows: { [id]: workflow } });
      const recorder = recordWrites(store);
      return { store, workflow: mastra.getWorkflow(id), id, callbacks, lostWarnings, ...recorder };
    }

    /** Another process claims the run and finishes it, as the recovery sweep's restart would. */
    async function takeOverAndFinish(store: WorkflowsStorage, workflowName: string, runId: string) {
      const claim = await store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs: 60_000, force: true });
      expect(claim.acquired).toBe(true);
      const fence: RunFence = { runId, generation: claim.record!.generation, ownerId: 'other-process' };
      await store.updateWorkflowState({ workflowName, runId, opts: { status: 'success' }, fence });
      return fence;
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

    // The lease lapsed while the attempt ran (nothing renewed it), so the retry checks the claim first.
    it('does not retry a failed step after the run was taken over', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      let attempts = 0;
      const stalled = gate();
      const { store, workflow, id, callbacks } = await setup(({ id, options }) =>
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
      vi.setSystemTime(Date.now() + WORKFLOW_RUN_LEASE_TTL_MS + 1_000);
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(attempts).toBe(1);
      expect(callbacks.onError).not.toHaveBeenCalled();
      expect(callbacks.onFinish).not.toHaveBeenCalled();
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // Foreach items write nothing before their body, so only the claim check stops the next one.
    it('does not start the next foreach item after the run was taken over', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
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
      vi.setSystemTime(Date.now() + WORKFLOW_RUN_LEASE_TTL_MS + 1_000);
      stalled.open();
      const result = await done;

      expect(result.status).toBe('waiting');
      expect(ran).toEqual([1]);
      expect((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('success');
    });

    // A late renewal is not a loss: nobody else claimed the run, so it renews before the next step.
    it('keeps running when its lease lapsed but nobody else claimed the run', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
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
  });
}
