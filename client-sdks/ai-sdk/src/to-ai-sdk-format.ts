import type {
  ChunkType,
  MastraWorkflowStream,
  Step,
  WorkflowRunStatus,
  WorkflowStepStatus,
} from '@mastra/core/workflows';
import type { ZodType, ZodObject } from 'zod';

type StepResult = {
  name: string;
  status: WorkflowStepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
};

export type WorkflowAiSDKType = {
  type: 'data-workflow';
  id: string;
  data: {
    name: string;
    status: WorkflowRunStatus;
    steps: Record<string, StepResult>;
    output: {
      usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
    } | null;
  };
};

export function WokflowStreamToAISDKTransformer() {
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
      let workflowName = '';
      if (chunk.type === 'workflow-start') {
        // TODO swap with name
        workflowName = chunk.payload.workflowId;
        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              name: workflowName,
              status: 'running',
              steps: {} as Record<string, StepResult>,
              output: null,
            },
          } satisfies WorkflowAiSDKType),
        });
      } else if (chunk.type === 'workflow-step-start') {
        steps[chunk.payload.id] = {
          // TODO swap with name
          name: chunk.payload.id,
          status: chunk.payload.status,
          input: chunk.payload.payload ?? null,
          output: null,
        } satisfies StepResult;

        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              name: workflowName,
              status: 'running',
              steps,
              output: null,
            },
          } satisfies WorkflowAiSDKType),
        });
      } else if (chunk.type === 'workflow-step-result') {
        steps[chunk.payload.id] = {
          ...steps[chunk.payload.id]!,
          status: chunk.payload.status,
          output: chunk.payload.output ?? null,
        } satisfies StepResult;

        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              name: workflowName,
              status: 'running',
              steps,
              output: null,
            },
          } satisfies WorkflowAiSDKType),
        });
      } else if (chunk.type === 'workflow-finish') {
        controller.enqueue({
          data: JSON.stringify({
            type: 'data-workflow',
            id: chunk.runId,
            data: {
              name: workflowName,
              steps,
              output: chunk.payload.output ?? null,
              status: chunk.payload.workflowStatus,
            },
          } satisfies WorkflowAiSDKType),
        });
      }
    },
  });
}

export function toAISdkFormat<
  TState extends ZodObject<any>,
  TInput extends ZodType<any>,
  TOutput extends ZodType<any>,
  TSteps extends Step<string, any, any>[],
>(stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>) {
  return stream.pipeThrough(WokflowStreamToAISDKTransformer());
}
