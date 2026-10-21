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

  it('allows direct reopening of a cached nested child run without parent metadata', async () => {
    const child = setup();
    const nested = await child.createRun({ runId: 'parent-run-iter-2', parentWorkflow });
    expect(await child.createRun({ runId: nested.runId })).toBe(nested);
  });

  it('allows direct reopening of a persisted nested child run without parent metadata', async () => {
    const storage = new MockStore();
    await setup(storage).createRun({ runId: 'parent-run-iter-2', parentWorkflow });
    const reloadedChild = setup(storage);

    await expect(reloadedChild.createRun({ runId: 'parent-run-iter-2' })).resolves.toBeDefined();
  });

  it('allows restarting a legacy nested child whose snapshot has no parent metadata', async () => {
    const storage = new MockStore();
    const child = setup(storage);
    await child.createRun({ runId: 'parent-run' });
    const store = (await storage.getStore('workflows'))!;
    const snapshot = await store.loadWorkflowSnapshot({ workflowName: child.id, runId: 'parent-run' });
    expect(snapshot).toBeDefined();
    await store.persistWorkflowSnapshot({ workflowName: child.id, runId: 'parent-run', snapshot: { ...snapshot! } });
    const reloadedChild = setup(storage);

    await expect(reloadedChild.createRun({ runId: 'parent-run', parentWorkflow })).resolves.toBeDefined();
  });

  it('rejects a foreign derived run ID even when the stored snapshot has no parent metadata', async () => {
    const storage = new MockStore();
    await setup(storage).createRun({ runId: 'parent-run-iter-2' });
    const reloadedChild = setup(storage);
    await expect(reloadedChild.createRun({ runId: 'parent-run-iter-2', parentWorkflow })).rejects.toThrow(
      'already belongs to another workflow execution',
    );
  });

  it('returns the same run for simultaneous requests with the same ID', async () => {
    const child = setup();
    const [first, second, third] = await Promise.all([
      child.createRun({ runId: 'simultaneous-run' }),
      child.createRun({ runId: 'simultaneous-run' }),
      child.createRun({ runId: 'simultaneous-run' }),
    ]);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('rejects simultaneous requests with conflicting parents', async () => {
    const child = setup();
    const results = await Promise.allSettled([
      child.createRun({ runId: 'parent-run-iter-2', parentWorkflow }),
      child.createRun({ runId: 'parent-run-iter-2', parentWorkflow: { ...parentWorkflow, stepId: 'other' } }),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({ status: 'rejected', reason: expect.any(Error) });
  });

  it('allows a nested run to reopen the same persisted child run', async () => {
    const storage = new MockStore();
    await setup(storage).createRun({ runId: 'parent-run-iter-2', parentWorkflow });
    const reloadedChild = setup(storage);

    await expect(reloadedChild.createRun({ runId: 'parent-run-iter-2', parentWorkflow })).resolves.toBeDefined();
  });
});
