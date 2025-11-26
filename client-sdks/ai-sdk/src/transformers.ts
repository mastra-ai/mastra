import type { LLMStepResult } from '@mastra/core/agent';
import type { ChunkType, DataChunkType, NetworkChunkType } from '@mastra/core/stream';
import type { WorkflowRunStatus, WorkflowStepStatus, WorkflowStreamEvent } from '@mastra/core/workflows';
import type { InferUIMessageChunk, TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions } from 'ai';
import type { ZodType } from 'zod';
import { convertMastraChunkToAISDKv5, convertFullStreamChunkToUIMessageStream } from './helpers';
import {
  isAgentExecutionDataChunkType,
  isDataChunkType,
  isWorkflowExecutionDataChunkType,
  safeParseErrorObject,
} from './utils';

type LanguageModelV2Usage = {
  /**
The number of input (prompt) tokens used.
   */
  inputTokens: number | undefined;
  /**
The number of output (completion) tokens used.
   */
  outputTokens: number | undefined;
  /**
The total number of tokens as reported by the provider.
This number might be different from the sum of `inputTokens` and `outputTokens`
and e.g. include reasoning tokens or other overhead.
   */
  totalTokens: number | undefined;
  /**
The number of reasoning tokens used.
   */
  reasoningTokens?: number | undefined;
  /**
The number of cached input tokens.
   */
  cachedInputTokens?: number | undefined;
};

type StepResult = {
  name: string;
  status: WorkflowStepStatus;
  input: Record<string, unknown> | null;
  output: unknown | null;
  suspendPayload: Record<string, unknown> | null;
  resumePayload: Record<string, unknown> | null;
};

export type WorkflowDataPart = {
  type: 'data-workflow' | 'data-tool-workflow';
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

export type NetworkDataPart = {
  type: 'data-network' | 'data-tool-network';
  id: string;
  data: {
    name: string;
    status: 'running' | 'finished';
    steps: StepResult[];
    usage: LanguageModelV2Usage | null;
    output: unknown | null;
  };
};

export type AgentDataPart = {
  type: 'data-tool-agent';
  id: string;
  data: LLMStepResult;
};

// used so it's not serialized to JSON
const PRIMITIVE_CACHE_SYMBOL = Symbol('primitive-cache');

export function WorkflowStreamToAISDKTransformer() {
  const bufferedWorkflows = new Map<
    string,
    {
      name: string;
      steps: Record<string, StepResult>;
    }
  >();
  return new TransformStream<
    ChunkType,
    | {
        data?: string;
        type?: 'start' | 'finish';
      }
    | WorkflowDataPart
    | ChunkType
  >({
    start(controller) {
      controller.enqueue({
        type: 'start',
      });
    },
    flush(controller) {
      controller.enqueue({
        type: 'finish',
      });
    },
    transform(chunk, controller) {
      const transformed = transformWorkflow<any>(chunk, bufferedWorkflows);

      if (transformed) controller.enqueue(transformed);
    },
  });
}

export function AgentNetworkToAISDKTransformer() {
  const bufferedNetworks = new Map<
    string,
    {
      name: string;
      steps: (StepResult & {
        id: string;
        iteration: number;
        task: null | Record<string, unknown>;
        input: StepResult['input'];
        [PRIMITIVE_CACHE_SYMBOL]: Map<string, any>;
      })[];
      usage: LanguageModelV2Usage | null;
      output: unknown | null;
    }
  >();

  return new TransformStream<
    NetworkChunkType,
    | {
        data?: string;
        type?: 'start' | 'finish';
      }
    | NetworkDataPart
    | InferUIMessageChunk<UIMessage>
    | DataChunkType
  >({
    start(controller) {
      controller.enqueue({
        type: 'start',
      });
    },
    flush(controller) {
      controller.enqueue({
        type: 'finish',
      });
    },
    transform(chunk, controller) {
      const transformed = transformNetwork(chunk, bufferedNetworks);
      if (transformed) controller.enqueue(transformed);
    },
  });
}

export function AgentStreamToAISDKTransformer<TOutput extends ZodType<any>>({
  lastMessageId,
  sendStart,
  sendFinish,
  sendReasoning,
  sendSources,
  messageMetadata,
  onError,
}: {
  lastMessageId?: string;
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
  messageMetadata?: UIMessageStreamOptions<UIMessage>['messageMetadata'];
  onError?: UIMessageStreamOptions<UIMessage>['onError'];
}) {
  let bufferedSteps = new Map<string, any>();
  let tripwireOccurred = false;
  let finishEventSent = false;

  return new TransformStream<ChunkType<TOutput>, object>({
    transform(chunk, controller) {
      // Track if tripwire occurred
      if (chunk.type === 'tripwire') {
        tripwireOccurred = true;
      }

      // Track if finish event was sent
      if (chunk.type === 'finish') {
        finishEventSent = true;
      }

      const part = convertMastraChunkToAISDKv5({ chunk, mode: 'stream' });

      const transformedChunk = convertFullStreamChunkToUIMessageStream<any>({
        part: part as any,
        sendReasoning,
        sendSources,
        messageMetadataValue: messageMetadata?.({ part: part as TextStreamPart<ToolSet> }),
        sendStart,
        sendFinish,
        responseMessageId: lastMessageId,
        onError(error) {
          return onError ? onError(error) : safeParseErrorObject(error);
        },
      });

      if (transformedChunk) {
        if (transformedChunk.type === 'tool-agent') {
          const payload = transformedChunk.payload;
          const agentTransformed = transformAgent<TOutput>(payload, bufferedSteps);
          if (agentTransformed) controller.enqueue(agentTransformed);
        } else if (transformedChunk.type === 'tool-workflow') {
          const payload = transformedChunk.payload;
          const workflowChunk = transformWorkflow(payload, bufferedSteps, true);
          if (workflowChunk) controller.enqueue(workflowChunk);
        } else if (transformedChunk.type === 'tool-network') {
          const payload = transformedChunk.payload;
          const networkChunk = transformNetwork(payload, bufferedSteps, true);
          if (networkChunk) controller.enqueue(networkChunk);
        } else {
          controller.enqueue(transformedChunk);
        }
      }
    },
    flush(controller) {
      // If tripwire occurred but no finish event was sent, send a finish event with 'other' reason
      if (tripwireOccurred && !finishEventSent && sendFinish) {
        // Send a finish event with finishReason 'other' to ensure graceful stream completion
        // AI SDK doesn't support tripwires, so we use 'other' as the finish reason
        controller.enqueue({
          type: 'finish',
          finishReason: 'other',
        } as any);
      }
    },
  });
}

export function transformAgent<TOutput extends ZodType<any>>(
  payload: ChunkType<TOutput>,
  bufferedSteps: Map<string, any>,
) {
  let hasChanged = false;
  switch (payload.type) {
    case 'start':
      bufferedSteps.set(payload.runId!, {
        id: payload.payload.id,
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
    } satisfies AgentDataPart;
  }
  return null;
}

export function transformWorkflow<TOutput extends ZodType<any>>(
  payload: ChunkType<TOutput>,
  bufferedWorkflows: Map<
    string,
    {
      name: string;
      steps: Record<string, StepResult>;
    }
  >,
  isNested?: boolean,
) {
  switch (payload.type) {
    case 'workflow-start':
      bufferedWorkflows.set(payload.runId!, {
        name: payload.payload.workflowId,
        steps: {},
      });
      return {
        type: isNested ? 'data-tool-workflow' : 'data-workflow',
        id: payload.runId,
        data: {
          name: bufferedWorkflows.get(payload.runId!)!.name,
          status: 'running',
          steps: bufferedWorkflows.get(payload.runId!)!.steps,
          output: null,
        },
      } as const;
    case 'workflow-step-start': {
      const current = bufferedWorkflows.get(payload.runId!) || { name: '', steps: {} };
      current.steps[payload.payload.id] = {
        name: payload.payload.id,
        status: payload.payload.status,
        input: payload.payload.payload ?? null,
        output: null,
        suspendPayload: null,
        resumePayload: null,
      };
      bufferedWorkflows.set(payload.runId!, current);
      return {
        type: isNested ? 'data-tool-workflow' : 'data-workflow',
        id: payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: null,
        },
      } as const;
    }
    case 'workflow-step-result': {
      const current = bufferedWorkflows.get(payload.runId!);
      if (!current) return null;
      current.steps[payload.payload.id] = {
        ...current.steps[payload.payload.id]!,
        status: payload.payload.status,
        output: payload.payload.output ?? null,
      };
      return {
        type: isNested ? 'data-tool-workflow' : 'data-workflow',
        id: payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: null,
        },
      } as const;
    }
    case 'workflow-step-suspended': {
      const current = bufferedWorkflows.get(payload.runId!);
      if (!current) return null;
      current.steps[payload.payload.id] = {
        ...current.steps[payload.payload.id]!,
        status: payload.payload.status,
        suspendPayload: payload.payload.suspendPayload ?? null,
        resumePayload: payload.payload.resumePayload ?? null,
        output: null,
      } satisfies StepResult;
      return {
        type: isNested ? 'data-tool-workflow' : 'data-workflow',
        id: payload.runId,
        data: {
          name: current.name,
          status: 'suspended',
          steps: current.steps,
          output: null,
        },
      } as const;
    }
    case 'workflow-finish': {
      const current = bufferedWorkflows.get(payload.runId!);
      if (!current) return null;
      return {
        type: isNested ? 'data-tool-workflow' : 'data-workflow',
        id: payload.runId,
        data: {
          name: current.name,
          steps: current.steps,
          output: payload.payload.output ?? null,
          status: payload.payload.workflowStatus,
        },
      } as const;
    }
    case 'workflow-step-output': {
      const output = payload.payload.output;
      if (output && isDataChunkType(output)) {
        if (!('data' in output)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(output)}`,
          );
        }
        return output;
      }
      return null;
    }
    default: {
      // return the chunk as is if it's not a known type
      if (isDataChunkType(payload)) {
        if (!('data' in payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }
        return payload;
      }
      return null;
    }
  }
}

export function transformNetwork(
  payload: NetworkChunkType,
  bufferedNetworks: Map<
    string,
    {
      name: string;
      steps: (StepResult & {
        id: string;
        iteration: number;
        task: null | Record<string, unknown>;
        input: StepResult['input'];
        [PRIMITIVE_CACHE_SYMBOL]: Map<string, any>;
      })[];
      usage: LanguageModelV2Usage | null;
      output: unknown | null;
    }
  >,
  isNested?: boolean,
): InferUIMessageChunk<UIMessage> | NetworkDataPart | DataChunkType | null {
  switch (payload.type) {
    case 'routing-agent-start': {
      if (!bufferedNetworks.has(payload.runId)) {
        bufferedNetworks.set(payload.runId, {
          name: payload.payload.networkId,
          steps: [],
          usage: null,
          output: null,
        });
      }

      const current = bufferedNetworks.get(payload.runId)!;
      current.steps.push({
        id: payload.payload.runId,
        name: payload.payload.agentId,
        status: 'running',
        iteration: payload.payload.inputData.iteration,
        input: {
          task: payload.payload.inputData.task,
          threadId: payload.payload.inputData.threadId,
          threadResourceId: payload.payload.inputData.threadResourceId,
        },
        output: '',
        task: null,
        suspendPayload: null,
        resumePayload: null,
        [PRIMITIVE_CACHE_SYMBOL]: new Map(),
      });

      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          name: bufferedNetworks.get(payload.runId)!.name,
          status: 'running',
          usage: null,
          steps: bufferedNetworks.get(payload.runId)!.steps,
          output: null,
        },
      } as const;
    }
    case 'routing-agent-text-start': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      return {
        type: 'text-start',
        id: payload.runId!,
      } as const;
    }
    case 'routing-agent-text-delta': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      return {
        type: 'text-delta',
        id: payload.runId!,
        delta: payload.payload.text,
      } as const;
    }
    case 'agent-execution-start': {
      const current = bufferedNetworks.get(payload.runId);

      if (!current) return null;

      current.steps.push({
        id: payload.payload.runId,
        name: payload.payload.agentId,
        status: 'running',
        iteration: payload.payload.args?.iteration ?? 0,
        input: { prompt: payload.payload.args?.prompt ?? '' },
        output: null,
        task: null,
        suspendPayload: null,
        resumePayload: null,
        [PRIMITIVE_CACHE_SYMBOL]: new Map(),
      });
      bufferedNetworks.set(payload.runId, current);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          ...current,
          status: 'running',
        },
      } as const;
    }
    case 'workflow-execution-start': {
      const current = bufferedNetworks.get(payload.runId);

      if (!current) return null;

      current.steps.push({
        id: payload.payload.runId,
        name: payload.payload.workflowId,
        status: 'running',
        iteration: payload.payload.args?.iteration ?? 0,
        input: { prompt: payload.payload.args?.prompt ?? '' },
        output: null,
        task: null,
        suspendPayload: null,
        resumePayload: null,
        [PRIMITIVE_CACHE_SYMBOL]: new Map(),
      });
      bufferedNetworks.set(payload.runId, current);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          ...current,
          status: 'running',
        },
      } as const;
    }
    case 'tool-execution-start': {
      const current = bufferedNetworks.get(payload.runId);

      if (!current) return null;

      current.steps.push({
        id: payload.payload.args.toolCallId!,
        name: payload.payload.args?.toolName!,
        status: 'running',
        iteration: payload.payload.args?.iteration ? Number(payload.payload.args.iteration) : 0,
        task: {
          id: payload.payload.args?.toolName!,
        },
        input: payload.payload.args?.args || null,
        output: null,
        suspendPayload: null,
        resumePayload: null,
        [PRIMITIVE_CACHE_SYMBOL]: new Map(),
      });

      bufferedNetworks.set(payload.runId, current);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          ...current,
          status: 'running',
        },
      } as const;
    }
    case 'agent-execution-end': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;

      const stepId = payload.payload.runId;
      const step = current.steps.find(step => step.id === stepId);
      if (!step) {
        return null;
      }

      step.status = 'success';
      step.output = payload.payload.result;

      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          ...current,
          usage: payload.payload?.usage ?? current.usage,
          status: 'running',
          output: payload.payload.result ?? current.output,
        },
      } as const;
    }
    case 'tool-execution-end': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;

      const stepId = payload.payload.toolCallId;
      const step = current.steps.find(step => step.id === stepId);
      if (!step) {
        return null;
      }

      step.status = 'success';
      step.output = payload.payload.result;

      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          ...current,
          status: 'running',
          output: payload.payload.result ?? current.output,
        },
      } as const;
    }
    case 'workflow-execution-end': {
      const current = bufferedNetworks.get(payload.runId);
      if (!current) return null;

      const stepId = payload.payload.runId;
      const step = current.steps.find(step => step.id === stepId);

      if (!step) {
        return null;
      }

      step.status = 'success';
      step.output = payload.payload.result;

      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          ...current,
          usage: payload.payload?.usage ?? current.usage,
          status: 'running',
          output: payload.payload.result ?? current.output,
        },
      } as const;
    }
    case 'routing-agent-end': {
      const current = bufferedNetworks.get(payload.runId);
      if (!current) return null;

      const stepId = payload.payload.runId;
      const step = current.steps.find(step => step.id === stepId);

      if (!step) {
        return null;
      }

      step.status = 'success';
      step.task = {
        id: payload.payload.primitiveId,
        type: payload.payload.primitiveType,
        name: payload.payload.task,
        reason: payload.payload.selectionReason,
      };
      step.output = payload.payload.result;

      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          ...current,
          usage: payload.payload?.usage ?? current.usage,
          output: payload.payload?.result ?? current.output,
        },
      } as const;
    }
    case 'network-execution-event-step-finish': {
      const current = bufferedNetworks.get(payload.runId);
      if (!current) return null;
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          ...current,
          status: 'finished',
          output: payload.payload?.result ?? current.output,
        },
      } as const;
    }
    case 'network-execution-event-finish': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          ...current,
          usage: payload.payload?.usage ?? current.usage,
          status: 'finished',
          output: payload.payload?.result ?? current.output,
        },
      } as const;
    }
    default: {
      if (payload.type.startsWith('agent-execution-event-')) {
        const stepId = payload.payload.runId;
        const current = bufferedNetworks.get(payload.runId!);
        if (!current) return null;

        const step = current.steps.find(step => step.id === stepId);
        if (!step) {
          return null;
        }

        step[PRIMITIVE_CACHE_SYMBOL] = step[PRIMITIVE_CACHE_SYMBOL] || new Map();
        const result = transformAgent(payload.payload as ChunkType<any>, step[PRIMITIVE_CACHE_SYMBOL]);
        if (result) {
          const { request, response, ...data } = result.data;
          step.task = data;
        }
      }

      if (payload.type.startsWith('workflow-execution-event-')) {
        const stepId = payload.payload.runId;
        const current = bufferedNetworks.get(payload.runId!);
        if (!current) return null;

        const step = current.steps.find(step => step.id === stepId);
        if (!step) {
          return null;
        }

        step[PRIMITIVE_CACHE_SYMBOL] = step[PRIMITIVE_CACHE_SYMBOL] || new Map();
        const result = transformWorkflow(payload.payload as WorkflowStreamEvent, step[PRIMITIVE_CACHE_SYMBOL]);
        if (result) {
          const data = result.data;
          step.task = data;

          if (data.name && step.task) {
            step.task.id = data.name;
          }
        }
      }

      // return the chunk as is if it's not a known type
      if (isDataChunkType(payload)) {
        if (!('data' in payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }

        const { type, data } = payload;
        return { type, data };
      }
      if (isAgentExecutionDataChunkType(payload)) {
        if (!('data' in payload.payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }

        const { type, data } = payload.payload;
        return { type, data };
      }
      if (isWorkflowExecutionDataChunkType(payload)) {
        if (!('data' in payload.payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }
        const { type, data } = payload.payload;
        return { type, data };
      }
      return null;
    }
  }
}
