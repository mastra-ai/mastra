/** The two writes a recovery sweep makes on a nested run it will never collect. */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { cancelNestedRun } from './nested-run-recovery';
import { createStep } from './workflow';

const num = z.object({ n: z.number() });

/** A run mid-step, whose lease has lapsed, then marked `success` as if it finished during the sweep. */
async function finishedRun() {
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

  await store.updateWorkflowState({ workflowName: 'wf', runId: 'r1', opts: { status: 'success' } });
  for (const runId of [...(store as any).db.runOwners.keys()]) {
    await store.claimRunOwnership({ runId, ownerId: 'lapsed', leaseMs: -1, force: true });
  }
  return store;
}

describe('canceling a nested run its parent left behind', () => {
  it('keeps a run that finished since the sweep listed it', async () => {
    const store = await finishedRun();

    await cancelNestedRun({ store, workflowName: 'wf', runId: 'r1', expectedStatus: 'running' });

    expect(await store.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'r1' })).toBe('success');
  });
});
