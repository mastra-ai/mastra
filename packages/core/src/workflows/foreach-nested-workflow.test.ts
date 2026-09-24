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

  it.each([2, 3, 5])(
    'starts each iteration in its own nested run when a sibling suspends first (concurrency %i)',
    async concurrency => {
      const maybeSuspend = createStep({
        id: 'maybe-suspend',
        inputSchema: z.number(),
        outputSchema: z.number(),
        resumeSchema: z.object({ ok: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (inputData % 2 === 1 && !resumeData) {
            return suspend({});
          }
          return inputData * 10;
        },
      });

      const child = createWorkflow({ id: 'child', inputSchema: z.number(), outputSchema: z.number() })
        .then(maybeSuspend)
        .commit();

      const parent = createWorkflow({
        id: 'parent',
        inputSchema: z.array(z.number()),
        outputSchema: z.array(z.number()),
      })
        .foreach(child, { concurrency })
        .commit();

      const mastra = new Mastra({ workflows: { parent }, storage: new MockStore(), logger: false });
      const run = await mastra.getWorkflow('parent').createRun();
      const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      let result = await run.start({ inputData: items });
      expect(result.status).toBe('suspended');

      // Each suspended iteration must have been started, and must be resumable, on its own run.
      for (let guard = 0; result.status === 'suspended' && guard < items.length; guard++) {
        const snapshot = await (await mastra.getStorage()!.getStore('workflows'))!.loadWorkflowSnapshot({
          workflowName: 'parent',
          runId: run.runId,
        });
        const foreachOutput = (snapshot!.context.child as any).suspendPayload.__workflow_meta.foreachOutput as any[];
        const forEachIndex = foreachOutput.findIndex(entry => entry?.status === 'suspended');
        result = await run.resume({ forEachIndex, resumeData: { ok: true } });
      }

      expect(result.status).toBe('success');
      expect((result as any).result).toEqual(items.map(i => i * 10));
    },
  );
});
