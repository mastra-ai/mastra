import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('foreach nested workflow runs', () => {
  it('includes every nested workflow invocation in getWorkflowRunById', async () => {
    const itemSchema = z.object({ value: z.string() });

    const childStep = createStep({
      id: 'child-step',
      inputSchema: itemSchema,
      outputSchema: itemSchema,
      execute: async ({ inputData }) => inputData,
    });

    const childWorkflow = createWorkflow({
      id: 'child-workflow',
      inputSchema: itemSchema,
      outputSchema: itemSchema,
    })
      .then(childStep)
      .commit();

    const parentWorkflow = createWorkflow({
      id: 'parent-workflow',
      inputSchema: z.array(itemSchema),
      outputSchema: z.array(itemSchema),
    })
      .foreach(childWorkflow)
      .commit();

    const storage = new MockStore();
    new Mastra({
      workflows: { parentWorkflow },
      storage,
      logger: false,
    });

    const run = await parentWorkflow.createRun();
    await run.start({ inputData: [{ value: 'first' }, { value: 'second' }] });

    const workflowsStore = await storage.getStore('workflows');
    const parentSnapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: run.runId,
    });
    const foreachResult = parentSnapshot?.context?.[childWorkflow.id];
    const nestedRunIds = foreachResult?.metadata?.nestedRunId;

    expect(nestedRunIds).toHaveLength(2);
    expect(nestedRunIds?.[0]).toEqual(expect.any(String));
    expect(nestedRunIds?.[1]).toEqual(expect.any(String));
    expect(nestedRunIds?.[0]).not.toBe(nestedRunIds?.[1]);

    const polled = await parentWorkflow.getWorkflowRunById(run.runId, {
      withNestedWorkflows: true,
      fields: ['steps'],
    });

    expect(polled?.steps?.['child-workflow[0].child-step']).toMatchObject({
      status: 'success',
      output: { value: 'first' },
    });
    expect(polled?.steps?.['child-workflow[1].child-step']).toMatchObject({
      status: 'success',
      output: { value: 'second' },
    });
  });
});
