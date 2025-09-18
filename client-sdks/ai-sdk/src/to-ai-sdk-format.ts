import type { ChunkType, MastraWorkflowStream } from '@mastra/core/workflows';

type StepResult = {
  name: string;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
};

export type WorkflowAiSDKType = {
  type: 'data-workflow';
  id: string;
  data: {
    name: string;
    status: 'running' | 'completed' | 'failed' | 'suspended';
    steps: StepResult[];
  };
};

export function WorkflowStreamToAISDKTransformer() {
  const steps: Record<string, StepResult> = {};
  return new TransformStream<
    ChunkType,
    {
      data: string;
    }
  >({
    start(controller) {
      controller.enqueue({
        data: JSON.stringify({
          type: 'start',
          messageId: '1',
        }),
      });
    },
    flush(controller) {
      controller.enqueue({
        data: JSON.stringify({
          type: 'finish',
        }),
      });
      controller.enqueue({
        data: '[DONE]',
      });
    },
    transform(chunk, controller) {
      if (chunk.type === 'workflow-start') {
        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              name: chunk.payload.name,
              status: 'running',
              steps: [],
            },
          } satisfies WorkflowAiSDKType),
        });
      } else if (chunk.type === 'workflow-step-start') {
        steps[chunk.payload.id] = {
          name: chunk.payload.stepName,
          status: chunk.payload.status,
          input: chunk.payload.payload,
          output: null,
        } satisfies StepResult;

        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              status: 'running',
              steps,
            },
          } satisfies WorkflowAiSDKType),
        });
      } else if (chunk.type === 'workflow-step-result') {
        steps[chunk.payload.id] = {
          ...steps[chunk.payload.id],
          status: chunk.payload.status,
          output: chunk.payload.output,
        } satisfies StepResult;

        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              status: 'running',
              steps,
            },
          } satisfies WorkflowAiSDKType),
        });
      } else if (chunk.type === 'workflow-finish') {
        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              steps,
              output: chunk.payload.output,
              status: chunk.payload.workflowStatus,
            },
          } satisfies WorkflowAiSDKType),
        });
      }
    },
  });
}

export function toAISdkFormat(stream: MastraWorkflowStream) {
  return stream.pipeThrough(WokflowStreamToAISDKTransformer());
}
