import type { LLMStepResult } from '@mastra/core/agent';
import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import type { WorkflowRunStatus, WorkflowStepStatus } from '@mastra/core/workflows';
import type { ZodType } from 'zod';
import { convertMastraChunkToAISDKv5, convertFullStreamChunkToUIMessageStream } from './helpers';

type StepResult = {
  name: string;
  status: WorkflowStepStatus;
  input: Record<string, unknown> | null;
  output: unknown | null;
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
    output: unknown | null;
  };
};

export type AgentDataPart = {
  type: 'data-tool-agent';
  id: string;
  data: LLMStepResult;
};

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
  const bufferedNetworks = new Map<string, { name: string; steps: StepResult[]; text: string }>();

  return new TransformStream<
    NetworkChunkType,
    | {
        data?: string;
        type?: 'start' | 'finish';
      }
    | NetworkDataPart
    | {
        type: 'text-delta';
        id: string;
        delta: string;
      }
    | {
        type: 'text-start';
        id: string;
      }
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

export function AgentStreamToAISDKTransformer<TOutput extends ZodType<any>>() {
  let bufferedSteps = new Map<string, any>();

  return new TransformStream<ChunkType<TOutput>, object>({
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
      } satisfies StepResult;
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
      } satisfies StepResult;
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
    default:
      return null;
  }
}

export function transformNetwork(
  payload: NetworkChunkType,
  bufferedNetworks: Map<string, { name: string; steps: StepResult[] }>,
  isNested?: boolean,
) {
  switch (payload.type) {
    case 'routing-agent-start': {
      if (!bufferedNetworks.has(payload.payload.runId)) {
        bufferedNetworks.set(payload.payload.runId, {
          name: payload.payload.agentId,
          steps: [],
        });
      }
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.payload.runId,
        data: {
          name: bufferedNetworks.get(payload.payload.runId)!.name,
          status: 'running',
          steps: bufferedNetworks.get(payload.payload.runId)!.steps,
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
      const current = bufferedNetworks.get(payload.payload.runId) || { name: '', steps: [] };
      current.steps.push({
        name: payload.payload.agentId,
        status: 'running',
        input: payload.payload.args || null,
        output: null,
      } satisfies StepResult);
      bufferedNetworks.set(payload.payload.runId, current);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: null,
        },
      } as const;
    }
    case 'workflow-execution-start': {
      const current = bufferedNetworks.get(payload.payload.runId) || { name: '', steps: [] };
      current.steps.push({
        name: payload.payload.name,
        status: 'running',
        input: payload.payload.args || null,
        output: null,
      } satisfies StepResult);
      bufferedNetworks.set(payload.payload.runId, current);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: null,
        },
      } as const;
    }
    case 'tool-execution-start': {
      const current = bufferedNetworks.get(payload.payload.runId) || { name: '', steps: [] };
      current.steps.push({
        name: payload.payload.args?.toolName!,
        status: 'running',
        input: payload.payload.args?.args || null,
        output: null,
      } satisfies StepResult);
      bufferedNetworks.set(payload.payload.runId, current);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: null,
        },
      } as const;
    }
    case 'agent-execution-end': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      current.steps.push({
        name: payload.payload.agentId,
        status: 'success',
        input: null,
        output: payload.payload.result,
      } satisfies StepResult);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: payload.payload.result ?? null,
        },
      } as const;
    }
    case 'tool-execution-end': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      current.steps.push({
        name: payload.payload.toolName,
        status: 'success',
        input: null,
        output: payload.payload.result,
      } satisfies StepResult);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: payload.payload.result ?? null,
        },
      } as const;
    }
    case 'workflow-execution-end': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      current.steps.push({
        name: payload.payload.name,
        status: 'success',
        input: null,
        output: payload.payload.result,
      } satisfies StepResult);
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId!,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: payload.payload.result ?? null,
        },
      } as const;
    }
    case 'routing-agent-end': {
      const current = bufferedNetworks.get(payload.payload.runId);
      if (!current) return null;
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: payload.payload?.result ?? null,
        },
      } as const;
    }
    case 'network-execution-event-step-finish': {
      const current = bufferedNetworks.get(payload.payload.runId);
      if (!current) return null;
      return {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.payload.runId,
        data: {
          name: current.name,
          status: 'running',
          steps: current.steps,
          output: payload.payload?.result ?? null,
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
          name: current.name,
          status: 'finished',
          steps: current.steps,
          output: payload.payload?.result ?? null,
        },
      } as const;
    }
    default:
      return null;
  }
}
