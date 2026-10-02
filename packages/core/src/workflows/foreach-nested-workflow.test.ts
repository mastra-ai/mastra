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

  it.each([1, 5, 10])(
    'starts a fresh child run for each iteration when siblings suspend (concurrency %i)',
    async concurrency => {
      const childStep = createStep({
        id: 'maybe-suspend',
        inputSchema: z.number(),
        outputSchema: z.number(),
        resumeSchema: z.object({ add: z.number() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (inputData % 2 === 1 && !resumeData) {
            return suspend({ value: inputData });
          }
          return inputData + (resumeData?.add ?? 0);
        },
      });

      const childWorkflow = createWorkflow({ id: 'child', inputSchema: z.number(), outputSchema: z.number() })
        .then(childStep)
        .commit();

      const parentWorkflow = createWorkflow({
        id: 'parent',
        inputSchema: z.array(z.number()),
        outputSchema: z.array(z.number()),
      })
        .foreach(childWorkflow, { concurrency })
        .commit();

      new Mastra({ workflows: { parentWorkflow }, storage: new MockStore(), logger: false });

      const run = await parentWorkflow.createRun();
      let result = await run.start({ inputData: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      expect(result.status).toBe('suspended');

      for (const forEachIndex of [1, 3, 5, 7, 9]) {
        expect(result.status).toBe('suspended');
        result = await run.resume({
          step: [childWorkflow.id, childStep.id],
          resumeData: { add: 100 },
          forEachIndex,
        });
      }

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual([0, 101, 2, 103, 4, 105, 6, 107, 8, 109]);
      }
    },
  );
});
