import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createWorkflow as createEventedWorkflow } from './evented/workflow';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/24780
describe('Run.cancel after restart cascades to persisted nested runs', () => {
  const schema = z.object({});

  function buildWorkflows() {
    const suspendingStep = createStep({
      id: 'wait-for-approval',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ suspend }) => suspend({}),
    });
    const grandchild = createWorkflow({ id: 'grandchild', inputSchema: schema, outputSchema: schema })
      .then(suspendingStep)
      .commit();
    const child = createWorkflow({ id: 'child', inputSchema: schema, outputSchema: schema }).then(grandchild).commit();
    const parent = createWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema }).then(child).commit();
    return parent;
  }

  it('cancels suspended child and grandchild runs from a recreated run', async () => {
    const storage = new MockStore();
    const processA = new Mastra({ logger: false, storage, workflows: { parent: buildWorkflows() } });
    const run = await processA.getWorkflow('parent').createRun();
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('suspended');

    const store = (await storage.getStore('workflows'))!;
    const { runs } = await store.listWorkflowRuns({});
    const nested = runs.filter(r => r.workflowName !== 'parent');
    expect(nested.map(r => r.workflowName).sort()).toEqual(['child', 'grandchild']);

    // Simulate restart: fresh Mastra instance over the same storage.
    const processB = new Mastra({ logger: false, storage, workflows: { parent: buildWorkflows() } });
    const recreated = await processB.getWorkflow('parent').createRun({ runId: run.runId });
    await recreated.cancel();

    for (const r of [{ workflowName: 'parent', runId: run.runId }, ...nested]) {
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: r.workflowName, runId: r.runId });
      expect(snapshot?.status, r.workflowName).toBe('canceled');
    }
  });

  function snapshot(runId: string, status: WorkflowRunState['status'], context: Record<string, any> = {}) {
    return {
      runId,
      status,
      value: {},
      context: { input: {}, ...context },
      serializedStepGraph: [{ type: 'workflow', id: 'child', workflowId: 'child' }] as any,
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState;
  }

  it.each([
    ['default', createWorkflow],
    ['evented', createEventedWorkflow],
  ] as const)('%s engine leaves terminal and unrelated runs untouched', async (_, create) => {
    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const parent = (create as typeof createWorkflow)({ id: 'parent', inputSchema: schema, outputSchema: schema })
      .then(createStep({ id: 'child', inputSchema: schema, outputSchema: schema, execute: async () => ({}) }))
      .commit();
    new Mastra({ logger: false, storage, workflows: { parent } });

    const childStep = (runIds: string[], status = 'suspended') => ({
      child: { status, payload: {}, startedAt: 1, metadata: { nestedRunId: runIds } },
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'parent',
      runId: 'p1',
      snapshot: snapshot('p1', 'suspended', childStep(['c-active', 'c-done'])),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'c-active',
      snapshot: snapshot('c-active', 'suspended'),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'c-done',
      snapshot: snapshot('c-done', 'success'),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'other',
      snapshot: snapshot('other', 'suspended'),
    });

    const run = await parent.createRun({ runId: 'p1' });
    await run.cancel();

    const status = async (workflowName: string, runId: string) =>
      (await store.loadWorkflowSnapshot({ workflowName, runId }))?.status;
    expect(await status('parent', 'p1')).toBe('canceled');
    expect(await status('child', 'c-active')).toBe('canceled');
    expect(await status('child', 'c-done')).toBe('success');
    expect(await status('child', 'other')).toBe('suspended');
  });
});
