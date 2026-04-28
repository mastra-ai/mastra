import { describe, it, expect } from 'vitest';
import { InngestExecutionEngine } from '../execution-engine';

describe('InngestExecutionEngine - resume safety', () => {
  it('throws when resume runId is missing', async () => {
    const engine = new InngestExecutionEngine(
      {} as any, // mastra mock
      {
        run: async (_id: string, fn: any) => fn(),
        invoke: async () => ({}),
        sleep: async () => {},
        sleepUntil: async () => {},
      } as any,
      0,
      {} as any,
    );

    await expect(
      engine.executeWorkflowStep({
        step: {} as any,
        stepResults: {}, // ← critical: missing runId source
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
    ).rejects.toThrow(/missing runId/);
  });
});
