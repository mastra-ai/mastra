import { TransformStream } from 'node:stream/web';
import type {
  InferUIMessageChunk,
  TextStreamPart,
  ToolSet,
  UIMessage,
  UIMessageStreamOptions,
} from '@internal/ai-sdk-v5';
import type {
  InferUIMessageChunk as InferUIMessageChunkV6,
  UIMessage as UIMessageV6,
  UIMessageStreamOptions as UIMessageStreamOptionsV6,
} from '@internal/ai-v6';
import type { LLMStepResult } from '@mastra/core/agent';
import type { AgentChunkType, ChunkType, DataChunkType, NetworkChunkType } from '@mastra/core/stream';
import type { WorkflowRunStatus, WorkflowStepStatus, WorkflowStreamEvent } from '@mastra/core/workflows';
import {
  convertMastraChunkToAISDKv5,
  convertMastraChunkToAISDKv6,
  convertFullStreamChunkToUIMessageStream,
} from './helpers';
import type { ToolAgentChunkType, ToolWorkflowChunkType, ToolNetworkChunkType } from './helpers';
import {
  isAgentExecutionDataChunkType,
  isDataChunkType,
  isWorkflowExecutionDataChunkType,
  safeParseErrorObject,
  isMastraTextStreamChunk,
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

export type StepResult = {
  name: string;
  status: WorkflowStepStatus;
  input: unknown | null;
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

export type WorkflowStepDataPart = {
  type: 'data-workflow-step' | 'data-tool-workflow-step';
  id: string;
  data: {
    name: string;
    status: WorkflowRunStatus;
    stepId: string;
    step: StepResult;
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

type ConvertMastraChunkToAISDK = <OUTPUT>(args: { chunk: ChunkType<OUTPUT>; mode?: 'generate' | 'stream' }) => any;

type BufferedWorkflowState = {
  name: string;
  steps: Record<string, StepResult>;
};

function cloneWorkflowStep(step: StepResult, includeOutput: boolean): StepResult {
  return {
    name: step.name,
    status: step.status,
    input: step.input,
    output: includeOutput ? step.output : null,
    suspendPayload: step.suspendPayload,
    resumePayload: step.resumePayload,
  };
}

function serializeWorkflowSteps(
  steps: Record<string, StepResult>,
  { includeOutputs }: { includeOutputs: boolean },
): Record<string, StepResult> {
  return Object.fromEntries(Object.entries(steps).map(([id, step]) => [id, cloneWorkflowStep(step, includeOutputs)]));
}

export function createWorkflowDataPart(args: {
  current: BufferedWorkflowState;
  isNested?: boolean;
  runId: string;
  status: WorkflowRunStatus;
  includeOutputs?: boolean;
  output?: WorkflowDataPart['data']['output'];
}): WorkflowDataPart {
  const { current, isNested, runId, status, includeOutputs = false, output = null } = args;

  return {
    type: isNested ? 'data-tool-workflow' : 'data-workflow',
    id: runId,
    data: {
      name: current.name,
      status,
      steps: serializeWorkflowSteps(current.steps, { includeOutputs }),
      output,
    },
  };
}

export function createWorkflowStepDataPart(args: {
  current: BufferedWorkflowState;
  isNested?: boolean;
  runId: string;
  status: WorkflowRunStatus;
  stepId: string;
}): WorkflowStepDataPart {
  const { current, isNested, runId, status, stepId } = args;

  return {
    type: isNested ? 'data-tool-workflow-step' : 'data-workflow-step',
    id: `${runId}:${stepId}`,
    data: {
      name: current.name,
      status,
      stepId,
      step: cloneWorkflowStep(current.steps[stepId]!, true),
    },
  };
}

export function createWorkflowStreamToAISDKTransformer<UI_CHUNK>(
  convertMastraChunkToAISDK: ConvertMastraChunkToAISDK,
  {
    includeTextStreamParts,
    sendReasoning,
    sendSources,
  }: { includeTextStreamParts?: boolean; sendReasoning?: boolean; sendSources?: boolean } = {},
) {
  const bufferedWorkflows = new Map<
    string,
    {
      name: string;
      steps: Record<string, StepResult>;
    }
  >();
  return new TransformStream<
    ChunkType<any>,
    | {
        data?: string;
        type?: 'start' | 'finish';
      }
    | UI_CHUNK
    | WorkflowDataPart
    | WorkflowStepDataPart
    | ChunkType
    | ToolAgentChunkType
    | ToolWorkflowChunkType
    | ToolNetworkChunkType
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
      const transformed = transformWorkflow<any>(
        chunk,
        bufferedWorkflows,
        false,
        includeTextStreamParts,
        {
          sendReasoning,
          sendSources,
        },
        convertMastraChunkToAISDK,
      );
      if (transformed) {
        if (Array.isArray(transformed)) {
          for (const item of transformed) {
            controller.enqueue(item as UI_CHUNK);
          }
        } else {
          controller.enqueue(transformed as UI_CHUNK);
        }
      }
    },
  });
}

export function WorkflowStreamToAISDKTransformer({
  includeTextStreamParts,
  sendReasoning,
  sendSources,
}: { includeTextStreamParts?: boolean; sendReasoning?: boolean; sendSources?: boolean } = {}) {
  return createWorkflowStreamToAISDKTransformer<InferUIMessageChunk<UIMessage>>(convertMastraChunkToAISDKv5, {
    includeTextStreamParts,
    sendReasoning,
    sendSources,
  });
}

export function WorkflowStreamToAISDKV6Transformer({
  includeTextStreamParts,
  sendReasoning,
  sendSources,
}: { includeTextStreamParts?: boolean; sendReasoning?: boolean; sendSources?: boolean } = {}) {
  return createWorkflowStreamToAISDKTransformer<InferUIMessageChunkV6<UIMessageV6>>(convertMastraChunkToAISDKv6, {
    includeTextStreamParts,
    sendReasoning,
    sendSources,
  });
}

export function createAgentNetworkToAISDKTransformer<UI_CHUNK>() {
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
      hasEmittedText: boolean;
    }
  >();

  return new TransformStream<
    NetworkChunkType,
    | {
        data?: string;
        type?: 'start' | 'finish';
      }
    | NetworkDataPart
    | UI_CHUNK
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
      if (transformed) {
        if (Array.isArray(transformed)) {
          for (const item of transformed) {
            controller.enqueue(item as any);
          }
        } else {
          controller.enqueue(transformed as any);
        }
      }
    },
  });
}

export function AgentNetworkToAISDKTransformer() {
  return createAgentNetworkToAISDKTransformer<InferUIMessageChunk<UIMessage>>();
}

export function AgentNetworkToAISDKV6Transformer() {
  return createAgentNetworkToAISDKTransformer<InferUIMessageChunkV6<UIMessageV6>>();
}

export function createAgentStreamToAISDKTransformer<OUTPUT>(
  convertMastraChunkToAISDK: ConvertMastraChunkToAISDK,
  {
    lastMessageId,
    sendStart = true,
    sendFinish = true,
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
    messageMetadata?: (args: { part: any }) => unknown;
    onError?: (error: unknown) => string;
  },
) {
  let bufferedSteps = new Map<string, any>();
  let tripwireOccurred = false;
  let finishEventSent = false;
  // Processors can rotate the active response message id between the run-level
  // `start` chunk and the first model step (e.g. observational memory sealing a
  // buffer chunk). The rotated id only reaches the wire via
  // `step-start.payload.messageId`, so hold `start` (and any processor `data-*`
  // chunks emitted before the model runs) until the first `step-start` and
  // announce that step's id — the id the first assistant message is actually
  // persisted under. Held chunks are flushed in their original order.
  let heldChunks: ChunkType<OUTPUT>[] | null = null;
  let startIdResolved = false;

  const processChunk = (chunk: ChunkType<OUTPUT>, controller: TransformStreamDefaultController<object>) => {
    if (chunk.type === 'tripwire') {
      tripwireOccurred = true;
    }

    if (chunk.type === 'finish') {
      finishEventSent = true;
    }

    if (chunk.type === 'object-result') {
      controller.enqueue({
        type: 'data-structured-output',
        data: {
          object: chunk.object,
        },
      });
    }

    const part = convertMastraChunkToAISDK({ chunk, mode: 'stream' });

    const enqueueTransformedPart = (p: any) => {
      const transformedChunk = convertFullStreamChunkToUIMessageStream<any>({
        part: p as any,
        sendReasoning,
        sendSources,
        messageMetadataValue: p ? messageMetadata?.({ part: p as TextStreamPart<ToolSet> }) : undefined,
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
          const agentTransformed = transformAgent<OUTPUT>(payload, bufferedSteps);
          if (agentTransformed) controller.enqueue(agentTransformed);
        } else if (transformedChunk.type === 'tool-workflow') {
          const payload = transformedChunk.payload;
          const workflowChunk = transformWorkflow(
            payload,
            bufferedSteps,
            true,
            undefined,
            undefined,
            convertMastraChunkToAISDK,
          );
          if (workflowChunk) {
            if (Array.isArray(workflowChunk)) {
              for (const item of workflowChunk) {
                controller.enqueue(item);
              }
            } else {
              controller.enqueue(workflowChunk);
            }
          }
        } else if (transformedChunk.type === 'tool-network') {
          const payload = transformedChunk.payload;
          const networkChunk = transformNetwork(payload, bufferedSteps, true);
          if (Array.isArray(networkChunk)) {
            for (const c of networkChunk) {
              if (c) controller.enqueue(c);
            }
          } else if (networkChunk) {
            controller.enqueue(networkChunk);
          }
        } else {
          controller.enqueue(transformedChunk as any);
        }
      }
    };

    if (Array.isArray(part)) {
      for (const p of part) {
        enqueueTransformedPart(p);
      }
    } else {
      enqueueTransformedPart(part);
    }
  };

  return new TransformStream<ChunkType<OUTPUT>, object>({
    transform(chunk, controller) {
      if (!startIdResolved) {
        if (chunk.type === 'start') {
          heldChunks = [chunk];
          return;
        }
        if (heldChunks) {
          if (typeof chunk.type === 'string' && chunk.type.startsWith('data-')) {
            heldChunks.push(chunk);
            return;
          }
          startIdResolved = true;
          const held = heldChunks;
          heldChunks = null;
          if (chunk.type === 'step-start') {
            // held[0] is always the run-level `start` chunk (the only chunk type that opens the hold).
            const startPayload = (held[0] as { payload?: { messageId?: unknown } } | undefined)?.payload;
            const stepMessageId = (chunk.payload as { messageId?: unknown } | undefined)?.messageId;
            // Re-announce under the step's id only when the run's `start`
            // carried an id in the first place (durable streams emit `start`
            // without a payload and must stay untouched).
            if (
              held[0] &&
              typeof stepMessageId === 'string' &&
              typeof startPayload?.messageId === 'string' &&
              stepMessageId !== startPayload.messageId
            ) {
              held[0] = { ...held[0], payload: { ...startPayload, messageId: stepMessageId } } as ChunkType<OUTPUT>;
            }
          }
          for (const heldChunk of held) {
            processChunk(heldChunk, controller);
          }
        } else {
          startIdResolved = true;
        }
      }
      processChunk(chunk, controller);
    },
    flush(controller) {
      if (heldChunks) {
        for (const heldChunk of heldChunks) {
          processChunk(heldChunk, controller);
        }
        heldChunks = null;
      }
      if (tripwireOccurred && !finishEventSent && sendFinish) {
        controller.enqueue({
          type: 'finish',
          finishReason: 'other',
        } as any);
      }
    },
  });
}

export function AgentStreamToAISDKTransformer<OUTPUT>({
  lastMessageId,
  sendStart = true,
  sendFinish = true,
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
  return createAgentStreamToAISDKTransformer<OUTPUT>(convertMastraChunkToAISDKv5, {
    lastMessageId,
    sendStart,
    sendFinish,
    sendReasoning,
    sendSources,
    messageMetadata,
    onError,
  });
}

export function AgentStreamToAISDKV6Transformer<OUTPUT>({
  lastMessageId,
  sendStart = true,
  sendFinish = true,
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
  messageMetadata?: UIMessageStreamOptionsV6<UIMessageV6>['messageMetadata'];
  onError?: UIMessageStreamOptionsV6<UIMessageV6>['onError'];
}) {
  return createAgentStreamToAISDKTransformer<OUTPUT>(convertMastraChunkToAISDKv6, {
    lastMessageId,
    sendStart,
    sendFinish,
    sendReasoning,
    sendSources,
    messageMetadata,
    onError,
  });
}

function ensureAgentRunState(bufferedSteps: Map<string, any>, runId: string) {
  if (!bufferedSteps.has(runId)) {
    bufferedSteps.set(runId, {
      id: '',
      object: null,
      finishReason: null,
      usage: null,
      warnings: [],
      text: '',
      reasoning: [],
      sources: [],
      files: [],
      toolCalls: [],
      pendingToolCalls: [],
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
  }

  return bufferedSteps.get(runId)!;
}

type PendingAgentToolCall = {
  toolCallId: string;
  toolName: string;
  argsText: string;
  state: 'input-streaming' | 'input-available';
  providerExecuted?: boolean;
  providerMetadata?: unknown;
  dynamic?: boolean;
};

type PendingToolCallUpdate = Partial<
  Pick<PendingAgentToolCall, 'toolName' | 'argsText' | 'state' | 'providerExecuted' | 'providerMetadata' | 'dynamic'>
>;

function upsertPendingToolCall(
  pendingToolCalls: PendingAgentToolCall[] = [],
  toolCallId: string,
  updates: PendingToolCallUpdate,
) {
  const existingIndex = pendingToolCalls.findIndex(call => call.toolCallId === toolCallId);
  if (existingIndex === -1) {
    return [
      ...pendingToolCalls,
      {
        toolCallId,
        toolName: updates.toolName || '',
        argsText: updates.argsText || '',
        state: updates.state || 'input-streaming',
        ...(updates.providerExecuted != null ? { providerExecuted: updates.providerExecuted } : {}),
        ...(updates.providerMetadata != null ? { providerMetadata: updates.providerMetadata } : {}),
        ...(updates.dynamic != null ? { dynamic: updates.dynamic } : {}),
      },
    ];
  }

  return pendingToolCalls.map((call, index) => {
    if (index !== existingIndex) return call;
    return {
      ...call,
      ...updates,
      toolName: updates.toolName || call.toolName,
      argsText: updates.argsText ?? call.argsText,
    };
  });
}

function appendPendingToolCallArgs(
  pendingToolCalls: PendingAgentToolCall[] = [],
  payload: {
    toolCallId: string;
    argsTextDelta?: string;
    toolName?: string;
    providerMetadata?: PendingAgentToolCall['providerMetadata'];
  },
) {
  const existing = pendingToolCalls.find(call => call.toolCallId === payload.toolCallId);
  return upsertPendingToolCall(pendingToolCalls, payload.toolCallId, {
    toolName: payload.toolName || existing?.toolName || '',
    argsText: `${existing?.argsText || ''}${payload.argsTextDelta || ''}`,
    state: 'input-streaming',
    providerMetadata: payload.providerMetadata ?? existing?.providerMetadata,
  });
}

function removePendingToolCall(pendingToolCalls: PendingAgentToolCall[] = [], toolCallId: string) {
  return pendingToolCalls.filter(call => call.toolCallId !== toolCallId);
}

export function transformAgent<OUTPUT>(payload: ChunkType<OUTPUT>, bufferedSteps: Map<string, any>) {
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
        pendingToolCalls: [],
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
    case 'tool-call-input-streaming-start': {
      const toolInputStartRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      const existing = toolInputStartRun.pendingToolCalls?.find(
        (call: PendingAgentToolCall) => call.toolCallId === payload.payload.toolCallId,
      );
      bufferedSteps.set(payload.runId!, {
        ...toolInputStartRun,
        pendingToolCalls: upsertPendingToolCall(toolInputStartRun.pendingToolCalls, payload.payload.toolCallId, {
          toolName: payload.payload.toolName,
          argsText: existing?.argsText ?? '',
          state: 'input-streaming',
          providerExecuted: payload.payload.providerExecuted,
          providerMetadata: payload.payload.providerMetadata,
          dynamic: payload.payload.dynamic,
        }),
      });
      hasChanged = true;
      break;
    }
    case 'tool-call-delta': {
      const toolCallDeltaRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...toolCallDeltaRun,
        pendingToolCalls: appendPendingToolCallArgs(toolCallDeltaRun.pendingToolCalls, payload.payload),
      });
      hasChanged = true;
      break;
    }
    case 'tool-call-input-streaming-end': {
      const toolInputEndRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      const existing = toolInputEndRun.pendingToolCalls?.find(
        (call: PendingAgentToolCall) => call.toolCallId === payload.payload.toolCallId,
      );
      bufferedSteps.set(payload.runId!, {
        ...toolInputEndRun,
        pendingToolCalls: upsertPendingToolCall(toolInputEndRun.pendingToolCalls, payload.payload.toolCallId, {
          toolName: existing?.toolName || '',
          state: 'input-available',
          providerMetadata: payload.payload.providerMetadata ?? existing?.providerMetadata,
        }),
      });
      hasChanged = true;
      break;
    }
    case 'finish': {
      // Not all sub-agent streams emit a `start` chunk before their first
      // content chunk, so the run state may not exist yet. Resumed Agent and
      // A2AAgent streams skip it, as did A2AAgent streams before the chunk
      // contract was aligned with regular Agent streams.
      const finishRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      // Current Agent and A2AAgent streams emit `{ stepResult, output }`;
      // older A2AAgent streams used a flat `{ finishReason, usage }` payload.
      const finishPayload = payload.payload as {
        stepResult?: { reason?: string; warnings?: unknown };
        output?: { usage?: unknown };
        finishReason?: string;
        usage?: unknown;
        response?: Record<string, unknown>;
      };
      bufferedSteps.set(payload.runId!, {
        ...finishRun,
        finishReason: finishPayload.stepResult?.reason ?? finishPayload.finishReason ?? null,
        usage: finishPayload.output?.usage ?? finishPayload.usage,
        warnings: finishPayload.stepResult?.warnings,
        steps: finishRun.steps,
        status: 'finished',
        response: {
          ...finishRun.response,
          ...(finishPayload.response || {}),
        },
      });
      hasChanged = true;
      break;
    }
    case 'text-delta': {
      const prevData = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...prevData,
        text: `${prevData.text}${payload.payload.text}`,
      });
      hasChanged = true;
      break;
    }
    case 'reasoning-delta': {
      const reasoningRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...reasoningRun,
        reasoning: [...reasoningRun.reasoning, payload.payload.text],
      });
      hasChanged = true;
      break;
    }
    case 'source': {
      const sourceRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...sourceRun,
        sources: [...sourceRun.sources, payload.payload],
      });
      hasChanged = true;
      break;
    }
    case 'file': {
      const fileRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...fileRun,
        files: [...fileRun.files, payload.payload],
      });
      hasChanged = true;
      break;
    }
    case 'tool-call': {
      const toolCallRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...toolCallRun,
        pendingToolCalls: removePendingToolCall(toolCallRun.pendingToolCalls, payload.payload.toolCallId),
        toolCalls: [...toolCallRun.toolCalls, payload.payload],
      });
      hasChanged = true;
      break;
    }
    case 'tool-result': {
      const toolResultRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      bufferedSteps.set(payload.runId!, {
        ...toolResultRun,
        pendingToolCalls: removePendingToolCall(toolResultRun.pendingToolCalls, payload.payload.toolCallId),
        toolResults: [...toolResultRun.toolResults, payload.payload],
      });
      hasChanged = true;
      break;
    }
    case 'object-result':
      bufferedSteps.set(payload.runId!, {
        ...ensureAgentRunState(bufferedSteps, payload.runId!),
        object: payload.object,
      });
      hasChanged = true;
      break;
    case 'object':
      bufferedSteps.set(payload.runId!, {
        ...ensureAgentRunState(bufferedSteps, payload.runId!),
        object: payload.object,
      });
      hasChanged = true;
      break;
    case 'step-finish': {
      const stepRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      // Exclude `steps` and internal offset trackers from the stepResult to
      // avoid recursive nesting where each stepResult embeds copies of all
      // prior stepResults (issue #14932).
      const { steps: _steps, _textOffset, _reasoningOffset, ...stepRunWithoutSteps } = stepRun;

      // Derive per-step text and reasoning using tracked offsets so each
      // stepResult only contains its own content, not the cumulative run state.
      const textOffset: number = _textOffset || 0;
      const reasoningOffset: number = _reasoningOffset || 0;
      const stepText = stepRun.text.slice(textOffset);
      const stepReasoning: string[] = stepRun.reasoning.slice(reasoningOffset);

      const stepResult = {
        ...stepRunWithoutSteps,
        text: stepText,
        reasoning: stepReasoning,
        pendingToolCalls: [],
        stepType: stepRun.steps.length === 0 ? 'initial' : 'tool-result',
        reasoningText: stepReasoning.join(''),
        staticToolCalls: stepRun.toolCalls.filter(
          (part: any) => part.type === 'tool-call' && part.payload?.dynamic === false,
        ),
        dynamicToolCalls: stepRun.toolCalls.filter(
          (part: any) => part.type === 'tool-call' && part.payload?.dynamic === true,
        ),
        staticToolResults: stepRun.toolResults.filter(
          (part: any) => part.type === 'tool-result' && part.payload?.dynamic === false,
        ),
        dynamicToolResults: stepRun.toolResults.filter(
          (part: any) => part.type === 'tool-result' && part.payload?.dynamic === true,
        ),
        finishReason: payload.payload.stepResult.reason,
        usage: payload.payload.output.usage,
        warnings: payload.payload.stepResult.warnings || [],
        response: {
          ...stepRun.response,
          id: payload.payload.id || '',
          timestamp: (payload.payload.metadata?.timestamp as Date) || new Date(),
          modelId: (payload.payload.metadata?.modelId as string) || (payload.payload.metadata?.model as string) || '',
          ...((payload.payload as any).response || {}),
          messages:
            ((payload.payload as any).response?.messages as typeof stepRun.response.messages) ??
            stepRun.response.messages ??
            [],
        },
      };

      // Reset per-step structural fields so the next step starts fresh instead
      // of carrying forward all prior toolCalls/toolResults (issue #14932).
      // Text and reasoning stay cumulative at the run level (consumers read
      // `data.text`); offsets track where the next step's content begins.
      // `object` is last-write-wins, so it is NOT reset — clearing it would
      // lose structured output from the completed step.
      bufferedSteps.set(payload.runId!, {
        ...stepRun,
        sources: [],
        files: [],
        toolCalls: [],
        pendingToolCalls: [],
        toolResults: [],
        usage: payload.payload.output.usage,
        warnings: payload.payload.stepResult.warnings || [],
        steps: [...stepRun.steps, stepResult],
        _textOffset: stepRun.text.length,
        _reasoningOffset: stepRun.reasoning.length,
      });
      hasChanged = true;
      break;
    }
    default:
      break;
  }

  if (hasChanged) {
    // Strip internal offset trackers so they don't leak over the wire.
    const { _textOffset: _to, _reasoningOffset: _ro, ...data } = bufferedSteps.get(payload.runId!)!;
    return {
      type: 'data-tool-agent',
      id: payload.runId!,
      data,
    } satisfies AgentDataPart;
  }
  return null;
}

export function transformWorkflow<OUTPUT>(
  payload: ChunkType<OUTPUT>,
  bufferedWorkflows: Map<string, BufferedWorkflowState>,
  isNested?: boolean,
  includeTextStreamParts?: boolean,
  streamOptions?: { sendReasoning?: boolean; sendSources?: boolean },
  convertMastraChunkToAISDK: ConvertMastraChunkToAISDK = convertMastraChunkToAISDKv5,
) {
  switch (payload.type) {
    case 'workflow-start':
      bufferedWorkflows.set(payload.runId!, {
        name: payload.payload.workflowId,
        steps: {},
      });
      return createWorkflowDataPart({
        current: bufferedWorkflows.get(payload.runId!)!,
        isNested,
        runId: payload.runId!,
        status: 'running',
      });
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
      return createWorkflowDataPart({
        current,
        isNested,
        runId: payload.runId!,
        status: 'running',
      });
    }
    case 'workflow-step-result': {
      const current = bufferedWorkflows.get(payload.runId!);
      if (!current) return null;
      current.steps[payload.payload.id] = {
        ...current.steps[payload.payload.id]!,
        status: payload.payload.status,
        output: payload.payload.output ?? null,
      };
      return [
        createWorkflowDataPart({
          current,
          isNested,
          runId: payload.runId!,
          status: 'running',
        }),
        createWorkflowStepDataPart({
          current,
          isNested,
          runId: payload.runId!,
          status: 'running',
          stepId: payload.payload.id,
        }),
      ] as const;
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
      return [
        createWorkflowDataPart({
          current,
          isNested,
          runId: payload.runId!,
          status: 'suspended',
        }),
        createWorkflowStepDataPart({
          current,
          isNested,
          runId: payload.runId!,
          status: 'suspended',
          stepId: payload.payload.id,
        }),
      ] as const;
    }
    case 'workflow-finish': {
      const current = bufferedWorkflows.get(payload.runId!);
      if (!current) return null;
      return createWorkflowDataPart({
        current,
        isNested,
        runId: payload.runId!,
        status: payload.payload.workflowStatus,
        includeOutputs: true,
        output: payload.payload.output ?? null,
      });
    }
    case 'workflow-step-output': {
      const output = payload.payload.output;

      if (includeTextStreamParts && output && isMastraTextStreamChunk(output)) {
        // @ts-expect-error - generic type mismatch in conversion
        const part = convertMastraChunkToAISDK<OUTPUT>({ chunk: output, mode: 'stream' });

        // convertMastraChunkToAISDK can return an array (e.g. for tool-call-approval v6 chunks)
        if (Array.isArray(part)) {
          return part
            .map(p =>
              convertFullStreamChunkToUIMessageStream({
                part: p as any,
                sendReasoning: streamOptions?.sendReasoning,
                sendSources: streamOptions?.sendSources,
                onError(error) {
                  return safeParseErrorObject(error);
                },
              }),
            )
            .filter(Boolean);
        }

        const transformedChunk = convertFullStreamChunkToUIMessageStream({
          part: part as any,
          sendReasoning: streamOptions?.sendReasoning,
          sendSources: streamOptions?.sendSources,
          onError(error) {
            return safeParseErrorObject(error);
          },
        });

        return transformedChunk;
      }

      if (output && isDataChunkType(output)) {
        if (!('data' in output)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(output)}`,
          );
        }
        const { type, data, id } = output;
        return { type, data, ...(id !== undefined && { id }) };
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
        const { type, data, id } = payload;

        return {
          type,
          data,
          ...(id !== undefined && { id }),
        };
      }
      return null;
    }
  }
}

type TransformNetworkResult = InferUIMessageChunk<UIMessage> | NetworkDataPart | DataChunkType | WorkflowStepDataPart;

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
      hasEmittedText?: boolean;
    }
  >,
  isNested?: boolean,
): TransformNetworkResult | TransformNetworkResult[] | null {
  switch (payload.type) {
    case 'routing-agent-start': {
      if (!bufferedNetworks.has(payload.runId)) {
        bufferedNetworks.set(payload.runId, {
          name: payload.payload.networkId,
          steps: [],
          usage: null,
          output: null,
          hasEmittedText: false,
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
      current.hasEmittedText = true;
      return {
        type: 'text-start',
        id: payload.runId!,
      } as const;
    }
    case 'routing-agent-text-delta': {
      const current = bufferedNetworks.get(payload.runId!);
      if (!current) return null;
      current.hasEmittedText = true;
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

      const resultText = payload.payload?.result;
      const dataNetworkChunk = {
        type: isNested ? 'data-tool-network' : 'data-network',
        id: payload.runId,
        data: {
          ...current,
          status: 'finished',
          output: resultText ?? current.output,
        },
      } as const;

      // Check if the routing agent handled the request directly (no delegation)
      // In that case, the result text is the selectionReason (routing logic), not user-facing content.
      // Text events for the actual answer will come from the validation step instead.
      // Scope to the current step (via payload.payload.runId) to avoid stale matches in multi-iteration scenarios.
      const finishStepId = payload.payload?.runId;
      const routingStep = current.steps.find(
        step => step.id === finishStepId && step.task?.id === 'none' && step.task?.type === 'none',
      );
      const isDirectHandling = !!routingStep;

      // Fallback: emit text events from result if core didn't send routing-agent-text-* events
      // Skip this when routing agent handled directly, as the result contains internal routing reasoning
      if (
        !isDirectHandling &&
        !current.hasEmittedText &&
        resultText &&
        typeof resultText === 'string' &&
        resultText.length > 0
      ) {
        current.hasEmittedText = true;
        return [
          { type: 'text-start', id: payload.runId } as const,
          { type: 'text-delta', id: payload.runId, delta: resultText } as const,
          dataNetworkChunk,
        ];
      }

      return dataNetworkChunk;
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
    case 'network-object':
    case 'network-object-result': {
      // Structured output chunks - currently not exposed in AI SDK format
      // These are used by MastraAgentNetworkStream's .object and .objectStream getters
      return null;
    }
    default: {
      // Check for custom data chunks first (before processing as events)
      if (isAgentExecutionDataChunkType(payload)) {
        if (!('data' in payload.payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }

        const { type, data, id } = payload.payload;
        return { type, data, ...(id !== undefined && { id }) };
      }
      if (isWorkflowExecutionDataChunkType(payload)) {
        if (!('data' in payload.payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }
        const { type, data, id } = payload.payload;
        return { type, data, ...(id !== undefined && { id }) };
      }

      if (payload.type.startsWith('agent-execution-event-')) {
        const stepId = (payload.payload as AgentChunkType).runId;
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

        bufferedNetworks.set(payload.runId!, current);
        return {
          type: isNested ? 'data-tool-network' : 'data-network',
          id: payload.runId!,
          data: {
            ...current,
            status: 'running',
          },
        } as const;
      }

      if (payload.type.startsWith('workflow-execution-event-')) {
        const stepId = (payload.payload as WorkflowStreamEvent).runId;
        const current = bufferedNetworks.get(payload.runId!);
        if (!current) return null;

        const step = current.steps.find(step => step.id === stepId);
        if (!step) {
          return null;
        }

        step[PRIMITIVE_CACHE_SYMBOL] = step[PRIMITIVE_CACHE_SYMBOL] || new Map();
        const result = transformWorkflow(payload.payload as WorkflowStreamEvent, step[PRIMITIVE_CACHE_SYMBOL]);
        const workflowResult = Array.isArray(result)
          ? result.find(item => item?.type === 'data-workflow' || item?.type === 'data-tool-workflow')
          : result;
        if (workflowResult && 'data' in workflowResult) {
          const data = workflowResult.data;
          step.task = data;

          if (data.name && step.task) {
            step.task.id = data.name;
          }
        }

        bufferedNetworks.set(payload.runId!, current);
        const networkChunk = {
          type: isNested ? 'data-tool-network' : 'data-network',
          id: payload.runId!,
          data: {
            ...current,
            status: 'running',
          },
        } as const;
        if (Array.isArray(result)) {
          return [networkChunk, ...result.filter((r): r is TransformNetworkResult => r != null)];
        }
        return networkChunk;
      }

      // return the chunk as is if it's not a known type
      if (isDataChunkType(payload)) {
        if (!('data' in payload)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(payload)}`,
          );
        }

        const { type, data, id } = payload;
        return { type, data, ...(id !== undefined && { id }) };
      }
      return null;
    }
  }
}
