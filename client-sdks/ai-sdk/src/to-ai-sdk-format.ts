import type { MastraModelOutput, ChunkType as AgentChunkType, OutputSchema } from '@mastra/core/stream';
import type { ChunkType, WorkflowRunStatus, WorkflowStepStatus } from '@mastra/core/workflows';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import type { ZodType } from 'zod';
import { convertMastraChunkToAISDKv5, convertFullStreamChunkToUIMessageStream } from './helpers';

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

export function AgentStreamToAISDKTransformer<TOutput extends ZodType<any>>() {
  let bufferedSteps = new Map<string, any>();

  return new TransformStream<AgentChunkType<TOutput>, object>({
    transform(chunk, controller) {
      const part = convertMastraChunkToAISDKv5({ chunk, mode: 'stream' });

      const transformedChunk = convertFullStreamChunkToUIMessageStream<any>({
        part: part as any,
        sendReasoning: false,
        sendSources: false,
        sendStart: true,
        sendFinish: true,
        responseMessageId: chunk.runId,
        onError() {
          return 'Error';
        },
      });

      if (transformedChunk) {
        // TODO: make this work for networks and workflows
        if (transformedChunk.type === 'tool-agent') {
          const payload = transformedChunk.payload;
          const agentTransformed = transformAgent<TOutput>(payload as AgentChunkType<TOutput>, bufferedSteps);
          if (agentTransformed) controller.enqueue(agentTransformed);
          //  } else if (transformedChunk.type === 'tool-workflow') {
          //     const workflowChunk = transformWorkflow(payload.payload);
          //     controller.enqueue(workflowChunk);

          //  } else if (transformedChunk.type === 'tool-network') {
          //     const networkChunk = transformNetwork(payload.payload);
          //     controller.enqueue(networkChunk);
        } else {
          controller.enqueue(transformedChunk);
        }
      }
    },
  });
}

function transformAgent<TOutput extends ZodType<any>>(
  payload: AgentChunkType<TOutput>,
  bufferedSteps: Map<string, any>,
) {
  let hasChanged = false;
  switch (payload.type) {
    case 'start':
      bufferedSteps.set(payload.runId!, {
        id: payload.payload.agentId,
        object: null,
        finishReason: null,
        usage: null,
        warnings: [],
        text: '',
        reasoning: [],
        sources: [],
        files: [],
        toolCalls: [],
        toolResults: [],
        request: {},
        response: {
          id: '',
          timestamp: new Date(),
          modelId: '',
          messages: [],
        },
        providerMetadata: undefined,
        steps: [],
        status: 'running',
      });
      hasChanged = true;
      break;
    case 'finish':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        finishReason: payload.payload.stepResult.reason,
        usage: payload.payload?.output?.usage,
        warnings: payload.payload?.stepResult?.warnings,
        steps: bufferedSteps.get(payload.runId!)!.steps,
        status: 'finished',
      });
      hasChanged = true;
      break;
    case 'text-delta':
      const prevData = bufferedSteps.get(payload.runId!)!;
      bufferedSteps.set(payload.runId!, {
        ...prevData,
        text: `${prevData.text}${payload.payload.text}`,
      });
      hasChanged = true;
      break;
    case 'reasoning-delta':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        reasoning: [...bufferedSteps.get(payload.runId)!.reasoning, payload.payload.text],
      });
      hasChanged = true;
      break;
    case 'source':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        sources: [...bufferedSteps.get(payload.runId)!.sources, payload.payload],
      });
      hasChanged = true;
      break;
    case 'file':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        files: [...bufferedSteps.get(payload.runId)!.files, payload.payload],
      });
      hasChanged = true;
      break;
    case 'tool-call':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        toolCalls: [...bufferedSteps.get(payload.runId)!.toolCalls, payload.payload],
      });
      hasChanged = true;
      break;
    case 'tool-result':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        toolResults: [...bufferedSteps.get(payload.runId)!.toolResults, payload.payload],
      });
      hasChanged = true;
      break;
    case 'object-result':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        object: payload.object,
      });
      hasChanged = true;
      break;
    case 'object':
      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!),
        object: payload.object,
      });
      hasChanged = true;
      break;
    case 'step-finish':
      const currentRun = bufferedSteps.get(payload.runId!)!;
      const stepResult = {
        ...bufferedSteps.get(payload.runId!)!,
        stepType: currentRun.steps.length === 0 ? 'initial' : 'tool-result',
        reasoningText: bufferedSteps.get(payload.runId!)!.reasoning.join(''),
        staticToolCalls: bufferedSteps
          .get(payload.runId!)!
          .toolCalls.filter((part: any) => part.type === 'tool-call' && part.payload?.dynamic === false),
        dynamicToolCalls: bufferedSteps
          .get(payload.runId!)!
          .toolCalls.filter((part: any) => part.type === 'tool-call' && part.payload?.dynamic === true),
        staticToolResults: bufferedSteps
          .get(payload.runId!)!
          .toolResults.filter((part: any) => part.type === 'tool-result' && part.payload?.dynamic === false),
        dynamicToolResults: bufferedSteps
          .get(payload.runId!)!
          .toolResults.filter((part: any) => part.type === 'tool-result' && part.payload?.dynamic === true),
        finishReason: payload.payload.stepResult.reason,
        usage: payload.payload.output.usage,
        warnings: payload.payload.stepResult.warnings || [],
        response: {
          id: payload.payload.id || '',
          timestamp: (payload.payload.metadata?.timestamp as Date) || new Date(),
          modelId: (payload.payload.metadata?.modelId as string) || (payload.payload.metadata?.model as string) || '',
          ...bufferedSteps.get(payload.runId!)!.response,
          messages: bufferedSteps.get(payload.runId!)!.response.messages || [],
        },
      };

      bufferedSteps.set(payload.runId!, {
        ...bufferedSteps.get(payload.runId!)!,
        usage: payload.payload.output.usage,
        warnings: payload.payload.stepResult.warnings || [],
        steps: [...bufferedSteps.get(payload.runId!)!.steps, stepResult],
      });
      hasChanged = true;
      break;
    default:
      break;
  }

  if (hasChanged) {
    return {
      type: 'data-tool-agent',
      id: payload.runId!,
      data: bufferedSteps.get(payload.runId!),
    } as const;
  }
  return null;
}

export function toAISdkFormat<TOutput extends OutputSchema>(
  stream: MastraModelOutput<TOutput>,
): ReadableStream<InferUIMessageChunk<UIMessage>> {
  return stream.fullStream.pipeThrough(AgentStreamToAISDKTransformer<any>()) as ReadableStream<
    InferUIMessageChunk<UIMessage>
  >;
}
