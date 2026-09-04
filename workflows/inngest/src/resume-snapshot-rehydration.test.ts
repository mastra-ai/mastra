import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InngestExecutionEngine } from './execution-engine';
import { init } from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

async function createHandlerFixture() {
  const inngest = new Inngest({ id: 'resume-rehydration-test' });
  let handler: any;
  vi.spyOn(inngest, 'createFunction').mockImplementation(((config: any, fn: any) => {
    handler = fn;
    return { id: config.id } as any;
  }) as any);

  const { createWorkflow, createStep } = init(inngest);
  const step = createStep({
    id: 'suspended-step',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ inputData }) => inputData,
  });
  const workflow = createWorkflow({
    id: 'resume-rehydration-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    steps: [step],
  })
    .then(step)
    .commit();
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { 'resume-rehydration-workflow': workflow as any },
  });
  workflow.__registerMastra(mastra);
  workflow.getFunction();

  const workflowsStore = await mastra.getStorage()!.getStore('workflows');
  const loadWorkflowSnapshot = vi.spyOn(workflowsStore!, 'loadWorkflowSnapshot');
  const execute = vi.spyOn(InngestExecutionEngine.prototype, 'execute').mockResolvedValue({
    status: 'success',
    result: { value: 'done' },
    steps: {},
    state: { count: 2 },
  } as any);
  const stepRun = vi.fn(async (_id: string, callback: () => Promise<unknown>) => callback());

  return { handler, loadWorkflowSnapshot, execute, stepRun, workflowsStore: workflowsStore! };
}

describe('Inngest workflow resume snapshot rehydration', () => {
  it('rehydrates state omitted from a slim resume event outside step.run', async () => {
    const { handler, loadWorkflowSnapshot, execute, stepRun, workflowsStore } = await createHandlerFixture();
    const runId = 'slim-resume-run';
    const persistedState = { count: 1 };
    const persistedStepResults = { 'suspended-step': { status: 'suspended' } };
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'resume-rehydration-workflow',
      runId,
      snapshot: {
        runId,
        serializedStepGraph: [],
        status: 'running',
        value: persistedState,
        context: persistedStepResults as any,
        activePaths: [],
        suspendedPaths: { 'suspended-step': [0] },
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    await handler({
      event: {
        data: {
          inputData: { approved: true },
          runId,
          resume: {
            steps: ['suspended-step'],
            resumePayload: { approved: true },
            resumePath: [0],
          },
        },
      },
      step: { run: stepRun },
      attempt: 0,
    });

    expect(loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: 'resume-rehydration-workflow',
      runId,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        initialState: persistedState,
        resume: expect.objectContaining({ stepResults: persistedStepResults }),
      }),
    );
    expect(stepRun.mock.calls.map(([id]) => id)).not.toContain(expect.stringContaining('snapshot'));
  });

  it('preserves state carried by legacy resume events', async () => {
    const { handler, loadWorkflowSnapshot, execute, stepRun } = await createHandlerFixture();
    const initialState = { count: 7 };
    const stepResults = { 'suspended-step': { status: 'suspended', payload: { legacy: true } } };

    await handler({
      event: {
        data: {
          inputData: { approved: true },
          initialState,
          runId: 'legacy-resume-run',
          resume: {
            steps: ['suspended-step'],
            stepResults,
            resumePayload: { approved: true },
            resumePath: [0],
          },
        },
      },
      step: { run: stepRun },
      attempt: 0,
    });

    expect(loadWorkflowSnapshot).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        initialState,
        resume: expect.objectContaining({ stepResults }),
      }),
    );
  });
});
