import { describe, it, expect } from 'vitest';
import { InngestExecutionEngine } from '../execution-engine';
import { InngestWorkflow } from '../workflow';

describe('InngestExecutionEngine - resume safety', () => {
  it('throws when resume runId is missing', async () => {
    const engine = new InngestExecutionEngine(
      {} as any, // mastra mock
      {
        run: async (_id: string, fn: any) => fn(),
        invoke: async () => ({ result: {}, runId: 'ignored' }),
        sleep: async () => {},
        sleepUntil: async () => {},
      } as any,
      0,
      {} as any,
    );

    //Create a REAL InngestWorkflow instance (or prototype)
    const step = Object.create(InngestWorkflow.prototype);

    await expect(
      engine.executeWorkflowStep({
        step: step as any, // critical fix
        stepResults: {}, // missing runId source
        executionContext: {
          workflowId: 'wf',
          runId: 'run',
          state: {},
          suspendedPaths: {},
          executionPath: [],
        } as any,
        resume: {
          steps: ['missing-step'],
          resumePayload: {},
        },
        inputData: {},
        prevOutput: {},
        pubsub: { publish: async () => {} } as any,
        startedAt: Date.now(),
      }),
    ).rejects.toThrow(/missing runId/i);
  });
});
