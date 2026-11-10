/** The two writes a recovery sweep makes on a nested run it will never collect. */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { cancelNestedRun, createNestedRunParentStatusLookup } from './nested-run-recovery';
import { createStep } from './workflow';

const num = z.object({ n: z.number() });

/** A run mid-step, then with its ownership lease lapsed so nothing is driving it. */
async function midStepRun() {
  const storage = new MockStore();
  const store = storage.stores.workflows!;
  const hang = createStep({
    id: 'hang',
    inputSchema: num,
    outputSchema: num,
    execute: () => new Promise(() => {}),
  });
  const wf = createWorkflow({ id: 'wf', inputSchema: num, outputSchema: num }).then(hang).commit();
  new Mastra({ logger: false, storage, workflows: { wf } });
  void (await wf.createRun({ runId: 'r1' })).start({ inputData: { n: 0 } });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(await store.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'r1' })).toBe('running');

  for (const runId of [...(store as any).db.runOwners.keys()]) {
    await store.claimRunOwnership({ runId, ownerId: 'lapsed', leaseMs: -1, force: true });
  }
  return store;
}

/** The same run, marked `success` as if it finished during the sweep. */
async function finishedRun() {
  const store = await midStepRun();
  await store.updateWorkflowState({ workflowName: 'wf', runId: 'r1', opts: { status: 'success' } });
  return store;
}

function debugLogs() {
  const logs: Array<{ message: string; context: any }> = [];
  const logger = { debug: (message: string, context: any) => logs.push({ message, context }) } as any;
  return { logs, logger };
}

describe('canceling a nested run its parent left behind', () => {
  it('keeps a run that finished since the sweep listed it and says why', async () => {
    const store = await finishedRun();
    const { logs, logger } = debugLogs();

    await cancelNestedRun({ store, workflowName: 'wf', runId: 'r1', expectedStatus: 'running', logger });

    expect(await store.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'r1' })).toBe('success');
    expect(logs).toEqual([
      {
        message: 'Left a nested workflow run as it is: it changed status since the sweep listed it',
        context: { workflowName: 'wf', runId: 'r1' },
      },
    ]);
  });

  it('leaves a run another process is driving and says why', async () => {
    const store = await midStepRun();
    const { logs, logger } = debugLogs();
    await store.claimRunOwnership({ runId: 'r1', ownerId: 'other', leaseMs: 60_000, force: true });

    await cancelNestedRun({ store, workflowName: 'wf', runId: 'r1', expectedStatus: 'running', logger });

    expect(await store.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'r1' })).toBe('running');
    expect(logs).toEqual([
      {
        message: 'Left a nested workflow run whose parent finished, because another process is driving it',
        context: { workflowName: 'wf', runId: 'r1' },
      },
    ]);
  });

  it('cancels a run nothing else is driving and says so', async () => {
    const store = await midStepRun();
    const { logs, logger } = debugLogs();

    await cancelNestedRun({ store, workflowName: 'wf', runId: 'r1', expectedStatus: 'running', logger });

    expect(await store.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'r1' })).toBe('canceled');
    expect(logs).toEqual([
      {
        message: 'Canceled a nested workflow run whose parent finished without it',
        context: { workflowName: 'wf', runId: 'r1' },
      },
    ]);
  });
});

describe('parent status lookups within one sweep', () => {
  it('reads each parent once, however many nested runs point at it', async () => {
    const reads: string[] = [];
    const store = {
      loadWorkflowRunStatus: async ({ workflowName, runId }: { workflowName: string; runId: string }) => {
        reads.push(`${workflowName}/${runId}`);
        return 'success' as const;
      },
    };
    const parentStatusOf = createNestedRunParentStatusLookup({ store: store as any });

    const leftovers = Array.from({ length: 3 }, () => ({ workflowName: 'outer', runId: 'run-1' }));
    const statuses = await Promise.all([...leftovers, { workflowName: 'outer', runId: 'run-2' }].map(parentStatusOf));

    expect(statuses).toEqual(['success', 'success', 'success', 'success']);
    expect(reads).toEqual(['outer/run-1', 'outer/run-2']);
  });

  it('reports no parent status when the sweep has no storage', async () => {
    const parentStatusOf = createNestedRunParentStatusLookup({});

    await expect(parentStatusOf({ workflowName: 'outer', runId: 'run-1' })).resolves.toBeNull();
  });
});
