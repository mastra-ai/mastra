import { describe, expect, it, vi } from 'vitest';

import { runCloudflareWorkflowAgent } from './entrypoint';
import type { CloudflareWorkflowStep, CloudflareWorkflowStepExecutor } from './types';

describe('runCloudflareWorkflowAgent', () => {
  it('runs settled segments with stable keys and waits for native resume events', async () => {
    const execute = vi
      .fn<CloudflareWorkflowStepExecutor['execute']>()
      .mockResolvedValueOnce({ status: 'suspended' })
      .mockResolvedValueOnce({ status: 'success', output: { text: 'complete' } });
    const step: CloudflareWorkflowStep = {
      do: vi.fn(async (_name, _config, callback) => callback()),
      waitForEvent: vi.fn(async () => ({
        type: 'mastra-resume',
        timestamp: new Date(),
        payload: { resumeData: { answer: 'yes' }, label: 'question-1' },
      })),
    };

    const result = await runCloudflareWorkflowAgent({
      event: {
        instanceId: 'run-1',
        payload: {
          runId: 'run-1',
          input: { agentId: 'agent-1' } as never,
        },
      },
      step,
      executor: { execute },
    });

    expect(result).toEqual({ status: 'success', output: { text: 'complete' } });
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'start',
        idempotencyKey: 'run-1:start',
      }),
    );
    expect(execute).toHaveBeenNthCalledWith(2, {
      operation: 'resume',
      runId: 'run-1',
      idempotencyKey: 'run-1:resume:1',
      resumeData: { answer: 'yes' },
      label: 'question-1',
    });
  });
});
