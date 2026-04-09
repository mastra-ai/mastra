import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import type { WorkflowDataPart, WorkflowStepDataPart } from '../transformers';
import { WorkflowStreamToAISDKTransformer } from '../transformers';

describe('transformWorkflow cumulative growth', () => {
  function createWorkflowStream(stepCount: number) {
    return new ReadableStream<ChunkType>({
      start(controller) {
        controller.enqueue({
          type: 'workflow-start',
          runId: 'workflow-run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            workflowId: 'test-workflow',
          },
        });

        for (let i = 0; i < stepCount; i++) {
          controller.enqueue({
            type: 'workflow-step-start',
            runId: 'workflow-run-1',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: `step-${i}`,
              stepCallId: `call-${i}`,
              status: 'running',
              payload: { index: i },
            },
          });

          controller.enqueue({
            type: 'workflow-step-result',
            runId: 'workflow-run-1',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: `step-${i}`,
              stepCallId: `call-${i}`,
              status: 'success',
              output: {
                text: `step ${i} output `.repeat(80),
              },
            },
          });
        }

        controller.enqueue({
          type: 'workflow-finish',
          runId: 'workflow-run-1',
          from: ChunkFrom.WORKFLOW,
          payload: {
            metadata: {},
            workflowStatus: 'success',
            output: {
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            },
          },
        });

        controller.close();
      },
    });
  }

  it('should stream full completed step payloads as data-workflow-step deltas', async () => {
    const transformedStream = createWorkflowStream(3).pipeThrough(WorkflowStreamToAISDKTransformer());

    const chunks: any[] = [];
    for await (const chunk of transformedStream) {
      chunks.push(chunk);
    }

    const stepChunks = chunks.filter(chunk => chunk.type === 'data-workflow-step') as WorkflowStepDataPart[];

    expect(stepChunks).toHaveLength(3);
    expect(stepChunks[0]?.data.stepId).toBe('step-0');
    expect(stepChunks[1]?.data.stepId).toBe('step-1');
    expect(stepChunks[2]?.data.stepId).toBe('step-2');
    expect(stepChunks[1]?.data.step.output).toEqual({
      text: `step 1 output `.repeat(80),
    });
  });

  it('should keep intermediate data-workflow snapshots lightweight and only include full outputs on finish', async () => {
    const transformedStream = createWorkflowStream(3).pipeThrough(WorkflowStreamToAISDKTransformer());

    const chunks: any[] = [];
    for await (const chunk of transformedStream) {
      chunks.push(chunk);
    }

    const workflowChunks = chunks.filter(chunk => chunk.type === 'data-workflow') as WorkflowDataPart[];

    expect(workflowChunks.length).toBeGreaterThanOrEqual(5);

    for (const chunk of workflowChunks.slice(0, -1)) {
      for (const step of Object.values(chunk.data.steps)) {
        expect(step.output).toBeNull();
      }
    }

    const finalChunk = workflowChunks[workflowChunks.length - 1]!;
    expect(finalChunk.data.status).toBe('success');
    expect(finalChunk.data.steps['step-0']?.output).toEqual({
      text: `step 0 output `.repeat(80),
    });
    expect(finalChunk.data.steps['step-2']?.output).toEqual({
      text: `step 2 output `.repeat(80),
    });
  });
});
