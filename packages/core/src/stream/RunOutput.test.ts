import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import { WorkflowRunOutput } from './RunOutput';
import { ChunkFrom } from './types';
import type { WorkflowStreamEvent } from './types';

function createWorkflowStream(chunks: WorkflowStreamEvent[]): ReadableStream<WorkflowStreamEvent> {
  return new ReadableStream<WorkflowStreamEvent>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createWorkflowStepOutput(usage: Record<string, unknown>): WorkflowStreamEvent {
  return {
    type: 'workflow-step-output',
    runId: 'run-1',
    from: ChunkFrom.WORKFLOW,
    payload: {
      id: 'step-output',
      stepId: 'step-1',
      output: {
        type: 'finish',
        payload: {
          usage,
        },
      },
    },
  } as WorkflowStreamEvent;
}

describe('WorkflowRunOutput', () => {
  it('should sum cacheCreationInputTokens across workflow step outputs', async () => {
    const output = new WorkflowRunOutput({
      runId: 'run-1',
      workflowId: 'workflow-1',
      stream: createWorkflowStream([
        createWorkflowStepOutput({
          inputTokens: 4557,
          outputTokens: 113,
          totalTokens: 4670,
          cachedInputTokens: 3584,
          cacheCreationInputTokens: 967,
        }),
        createWorkflowStepOutput({
          inputTokens: 4848,
          outputTokens: 117,
          totalTokens: 4965,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 296,
        }),
        createWorkflowStepOutput({
          inputTokens: 8557,
          outputTokens: 1270,
          totalTokens: 9827,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 4005,
        }),
      ]),
    });

    const usage = await output.usage;

    expect(usage.inputTokens).toBe(17962);
    expect(usage.outputTokens).toBe(1500);
    expect(usage.cachedInputTokens).toBe(12686);
    expect((usage as { cacheCreationInputTokens?: number }).cacheCreationInputTokens).toBe(5268);
  });
});
