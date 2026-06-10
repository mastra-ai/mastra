import { describe, expect, it, vi } from 'vitest';
import { processWorkflowForEach } from './loop';

describe('processWorkflowForEach', () => {
  it('restores a suspended bulk-resume iteration when publishing the resume event fails', async () => {
    const suspendedIteration = {
      status: 'suspended',
      suspendedAt: 1,
      suspendPayload: { reason: 'approval', __workflow_meta: { path: ['approval'] } },
    };
    const updateWorkflowResults = vi.fn(async () => ({}));
    const publishError = new Error('publish failed');

    await expect(
      processWorkflowForEach(
        {
          workflowId: 'workflow-a',
          runId: 'run-a',
          executionPath: ['foreach-step'],
          stepResults: {
            'foreach-step': {
              status: 'success',
              output: [suspendedIteration],
              payload: [{ value: 1 }],
            },
          },
          prevResult: { status: 'success', output: [{ value: 1 }] },
          activeStepsPath: {},
          resumeSteps: ['foreach-step'],
          resumeData: { approved: true },
          parentWorkflow: undefined,
          requestContext: {},
          perStep: false,
          state: undefined,
          outputOptions: undefined,
          forEachIndex: undefined,
        } as any,
        {
          pubsub: {
            publish: vi.fn(async () => {
              throw publishError;
            }),
          } as any,
          mastra: {
            getStorage: () => ({
              getStore: async () => ({ updateWorkflowResults }),
            }),
          } as any,
          step: {
            type: 'foreach',
            step: { id: 'foreach-step', component: 'STEP' },
            opts: { concurrency: 1 },
          } as any,
        },
      ),
    ).rejects.toThrow('publish failed');

    expect(updateWorkflowResults).toHaveBeenCalledTimes(2);
    expect(updateWorkflowResults.mock.calls[0]?.[0].result.output).toEqual([{ __mastra_pending__: true }]);
    expect(updateWorkflowResults.mock.calls[1]?.[0].result.output).toEqual([suspendedIteration]);
  });
});
