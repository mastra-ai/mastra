import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

const schema = z.object({ n: z.number() });

function setup(storage = new MockStore()) {
  const child = createWorkflow({ id: 'collision-child', inputSchema: schema, outputSchema: schema })
    .then(
      createStep({
        id: 'inc',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
      }),
    )
    .commit();
  new Mastra({ logger: false, storage, workflows: { child } });
  return child;
}

const parentWorkflow = { workflowId: 'parent', runId: 'parent-run', stepId: 'child-step' };

describe('nested workflow run ID collisions', () => {
  it('rejects a nested run whose derived ID already belongs to a caller-created run', async () => {
    const child = setup();
    await child.createRun({ runId: 'parent-run-iter-2' });

    await expect(child.createRun({ runId: 'parent-run-iter-2', parentWorkflow })).rejects.toThrow(
      'already belongs to another workflow execution',
    );
  });

  it('rejects an unrelated child run after loading its snapshot from storage', async () => {
    const storage = new MockStore();
    await setup(storage).createRun({ runId: 'parent-run-iter-2', parentWorkflow });
    const reloadedChild = setup(storage);

    await expect(
      reloadedChild.createRun({
        runId: 'parent-run-iter-2',
        parentWorkflow: { ...parentWorkflow, stepId: 'another-step' },
      }),
    ).rejects.toThrow('already belongs to another workflow execution');
  });

  it('rejects a caller-created run ID that belongs to a cached nested run', async () => {
    const child = setup();
    await child.createRun({ runId: 'parent-run-iter-2', parentWorkflow });

    await expect(child.createRun({ runId: 'parent-run-iter-2' })).rejects.toThrow(
      'already belongs to another workflow execution',
    );
  });

  it('rejects a caller-created run ID that belongs to a persisted nested run', async () => {
    const storage = new MockStore();
    await setup(storage).createRun({ runId: 'parent-run-iter-2', parentWorkflow });
    const reloadedChild = setup(storage);

    await expect(reloadedChild.createRun({ runId: 'parent-run-iter-2' })).rejects.toThrow(
      'already belongs to another workflow execution',
    );
  });

  it('allows a nested run to reopen the same persisted child run', async () => {
    const storage = new MockStore();
    await setup(storage).createRun({ runId: 'parent-run-iter-2', parentWorkflow });
    const reloadedChild = setup(storage);

    await expect(reloadedChild.createRun({ runId: 'parent-run-iter-2', parentWorkflow })).resolves.toBeDefined();
  });
});
