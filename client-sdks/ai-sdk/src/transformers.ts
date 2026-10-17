import { TransformStream } from 'node:stream/web';
import type { LLMStepResult } from '@mastra/core/agent';
import type { InferUIMessageChunk, TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions } from '@mastra/core/ai';
import type { AgentChunkType, ChunkType, DataChunkType } from '@mastra/core/stream';
import type { WorkflowRunStatus, WorkflowStepStatus, WorkflowStreamEvent } from '@mastra/core/workflows';
import {
  convertMastraChunkToAISDK as convertMastraChunkToAISDKDefault,
  convertFullStreamChunkToUIMessageStream,
} from './helpers';
import type { ToolAgentChunkType, ToolWorkflowChunkType } from './helpers';
import type { WithTraceId } from './public-types';
import { isDataChunkType, safeParseErrorObject, isMastraTextStreamChunk, toUIDataChunk } from './utils';

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
      usage: LanguageModelV2Usage;
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

/**
 * A tool call that threw inside a nested agent, normalized to a JSON-safe shape.
 *
 * The raw `tool-error` payload's `error` field is a live `Error` on the non-durable
 * path but a plain `{ name, message, stack }` on the durable path, and
 * `JSON.stringify(new Error(...))` yields `"{}"` — so an `Error` would reach a host
 * as an empty object over SSE. Both shapes are flattened to `errorText` with
 * `safeParseErrorObject`, the same helper the non-nested path uses to build its
 * `tool-output-error` chunk.
 */
export type AgentToolError = {
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  /** JSON-safe rendering of the failure. */
  errorText: string;
  providerExecuted?: boolean;
};

/**
 * `data-tool-agent` payload. Widens `LLMStepResult` with the Mastra-only fields this
 * transform emits; `status` is likewise emitted at runtime but is not part of the
 * AI SDK step shape.
 */
export type AgentRunSnapshot = LLMStepResult & {
  toolErrors?: AgentToolError[];
};

export type AgentStreamAncestryEntry = {
  toolCallId: string;
  toolName?: string;
  agentId?: string;
};

type AgentStreamAncestryMetadata = {
  ancestry: AgentStreamAncestryEntry[];
  depth: number;
  parentAgentId?: string;
};

export type AgentDataPart = {
  type: 'data-tool-agent';
  id: string;
  data: AgentRunSnapshot;
};

export type AgentStepDataPart = {
  type: 'data-tool-agent-step';
  id: string;
  data: {
    runId: string;
    stepIndex: number;
    step: AgentRunSnapshot;
  };
};

export type AgentDataPartWithAncestry = AgentDataPart & AgentStreamAncestryMetadata;
export type AgentStepDataPartWithAncestry = AgentStepDataPart & AgentStreamAncestryMetadata;

type TransformAgentResult =
  | AgentDataPartWithAncestry
  | readonly [AgentDataPartWithAncestry, AgentStepDataPartWithAncestry];

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
  return createWorkflowStreamToAISDKTransformer<InferUIMessageChunk<UIMessage>>(convertMastraChunkToAISDKDefault, {
    includeTextStreamParts,
    sendReasoning,
    sendSources,
  });
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
    includeSubAgentMetadata = false,
  }: {
    lastMessageId?: string;
    sendStart?: boolean;
    sendFinish?: boolean;
    sendReasoning?: boolean;
    sendSources?: boolean;
    messageMetadata?: (args: { part: any; traceId?: string }) => unknown;
    onError?: (error: unknown) => string;
    includeSubAgentMetadata?: boolean;
  },
) {
  let bufferedSteps = new Map<string, any>();
  let tripwireOccurred = false;
  let finishEventSent = false;
  // Processors can rotate the response message id before the first model step
  // (e.g. observational memory). Hold `start` (and any preceding `data-*`
  // chunks) until the first `step-start` so the announced id matches the id
  // the response is actually persisted under. With `sendStart: false` no
  // `start` UI chunk is emitted at all, so nothing is held.
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
        messageMetadataValue: p
          ? messageMetadata?.({ part: p as TextStreamPart<ToolSet>, traceId: chunk.traceId })
          : undefined,
        sendStart,
        sendFinish,
        responseMessageId: lastMessageId,
        onError(error) {
          return onError ? onError(error) : safeParseErrorObject(error);
        },
      });

      if (transformedChunk) {
        if (transformedChunk.type === 'tool-agent') {
          if (!includeSubAgentMetadata) {
            return;
          }
          const { payload, ancestry } = transformedChunk;
          const agentTransformed = transformAgent<OUTPUT>(payload, bufferedSteps, ancestry);
          if (agentTransformed) {
            if (Array.isArray(agentTransformed)) {
              for (const part of agentTransformed) {
                controller.enqueue(part);
              }
            } else {
              controller.enqueue(agentTransformed);
            }
          }
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
        if (sendStart && chunk.type === 'start') {
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
            // held[0] is the run-level `start` chunk (the only chunk type that opens the hold).
            const startPayload = (held[0] as { payload?: { messageId?: unknown } } | undefined)?.payload;
            const stepMessageId = (chunk.payload as { messageId?: unknown } | undefined)?.messageId;
            // Durable streams emit `start` without an id — leave those untouched.
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
  includeSubAgentMetadata = false,
}: {
  lastMessageId?: string;
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
  messageMetadata?: WithTraceId<UIMessageStreamOptions<UIMessage>['messageMetadata']>;
  onError?: UIMessageStreamOptions<UIMessage>['onError'];
  includeSubAgentMetadata?: boolean;
}) {
  return createAgentStreamToAISDKTransformer<OUTPUT>(convertMastraChunkToAISDKDefault, {
    lastMessageId,
    sendStart,
    sendFinish,
    sendReasoning,
    sendSources,
    messageMetadata,
    onError,
    includeSubAgentMetadata,
  });
}

function ensureAgentRunState(bufferedSteps: Map<string, any>, runId: string) {
  if (!bufferedSteps.has(runId)) {
    bufferedSteps.set(runId, createAgentRunState());
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

function createAgentResponseState() {
  return {
    id: '',
    timestamp: new Date(),
    modelId: '',
    messages: [],
  };
}

function createAgentRunState(id: unknown = '') {
  return {
    id,
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
    toolErrors: [],
    request: {},
    response: createAgentResponseState(),
    providerMetadata: undefined,
    steps: [],
    status: 'running',
  };
}

function cloneAgentResponse(
  response: Record<string, any> | undefined,
  { includeMessages }: { includeMessages: boolean },
) {
  if (!response) return response;

  return {
    ...response,
    ...(Object.prototype.hasOwnProperty.call(response, 'messages')
      ? { messages: includeMessages ? response.messages : [] }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(response, 'dbMessages')
      ? { dbMessages: includeMessages ? response.dbMessages : [] }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(response, 'uiMessages')
      ? { uiMessages: includeMessages ? response.uiMessages : [] }
      : {}),
  };
}

function cloneAgentStep(step: Record<string, any>, { includeDetails }: { includeDetails: boolean }) {
  if (includeDetails) {
    return {
      ...step,
      response: cloneAgentResponse(step.response, { includeMessages: true }),
    };
  }

  return {
    ...step,
    object: null,
    files: [],
    sources: [],
    toolCalls: [],
    pendingToolCalls: [],
    toolResults: [],
    toolErrors: [],
    dynamicToolCalls: [],
    dynamicToolResults: [],
    staticToolCalls: [],
    staticToolResults: [],
    text: '',
    reasoning: [],
    content: Array.isArray(step.content) ? [] : step.content,
    reasoningText: typeof step.reasoningText === 'string' ? '' : step.reasoningText,
    response: cloneAgentResponse(step.response, { includeMessages: false }),
  };
}

function serializeAgentRun(
  current: Record<string, any>,
  {
    includeCompletedStepDetails,
    includeResponseMessages,
  }: { includeCompletedStepDetails: boolean; includeResponseMessages: boolean },
) {
  const { _textOffset: _to, _reasoningOffset: _ro, ...data } = current;

  return {
    ...data,
    response: cloneAgentResponse(data.response, { includeMessages: includeResponseMessages }),
    steps: data.steps.map((step: Record<string, any>) =>
      cloneAgentStep(step, {
        includeDetails: includeCompletedStepDetails,
      }),
    ),
  };
}

function createAgentStreamAncestryMetadata(ancestry: AgentStreamAncestryEntry[]): AgentStreamAncestryMetadata {
  const parentAgentId = ancestry.at(-2)?.agentId;

  return {
    ancestry,
    depth: ancestry.length,
    ...(parentAgentId ? { parentAgentId } : {}),
  };
}

function createAgentDataPart(args: {
  current: Record<string, any>;
  runId: string;
  ancestry: AgentStreamAncestryEntry[];
  includeCompletedStepDetails: boolean;
  includeResponseMessages: boolean;
}): AgentDataPartWithAncestry {
  const { current, runId, ancestry, includeCompletedStepDetails, includeResponseMessages } = args;

  return {
    type: 'data-tool-agent',
    id: runId,
    data: serializeAgentRun(current, {
      includeCompletedStepDetails,
      includeResponseMessages,
    }) as unknown as AgentRunSnapshot,
    ...createAgentStreamAncestryMetadata(ancestry),
  };
}

function createAgentStepDataPart(args: {
  runId: string;
  stepIndex: number;
  step: Record<string, any>;
  ancestry: AgentStreamAncestryEntry[];
}): AgentStepDataPartWithAncestry {
  const { runId, stepIndex, step, ancestry } = args;

  return {
    type: 'data-tool-agent-step',
    id: `${runId}:${stepIndex}`,
    data: {
      runId,
      stepIndex,
      step: cloneAgentStep(step, { includeDetails: true }) as unknown as AgentRunSnapshot,
    },
    ...createAgentStreamAncestryMetadata(ancestry),
  };
}

export function transformAgent<OUTPUT>(
  payload: ChunkType<OUTPUT>,
  bufferedSteps: Map<string, any>,
  ancestry: AgentStreamAncestryEntry[] = [],
): TransformAgentResult | null {
  let hasChanged = false;
  let completedStep: { stepIndex: number; step: Record<string, any> } | null = null;
  switch (payload.type) {
    case 'start': {
      const startState = createAgentRunState(payload.payload.id);
      bufferedSteps.set(payload.runId!, startState);
      hasChanged = true;
      break;
    }
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
    case 'tool-error': {
      const toolErrorRun = ensureAgentRunState(bufferedSteps, payload.runId!);
      const toolErrorPayload = payload.payload as {
        toolCallId: string;
        toolName: string;
        args?: Record<string, unknown>;
        error: unknown;
        providerExecuted?: boolean;
      };
      bufferedSteps.set(payload.runId!, {
        ...toolErrorRun,
        pendingToolCalls: removePendingToolCall(toolErrorRun.pendingToolCalls, toolErrorPayload.toolCallId),
        toolErrors: [
          ...toolErrorRun.toolErrors,
          {
            toolCallId: toolErrorPayload.toolCallId,
            toolName: toolErrorPayload.toolName,
            ...(toolErrorPayload.args !== undefined ? { args: toolErrorPayload.args } : {}),
            errorText: safeParseErrorObject(toolErrorPayload.error),
            ...(toolErrorPayload.providerExecuted !== undefined
              ? { providerExecuted: toolErrorPayload.providerExecuted }
              : {}),
          },
        ],
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
      const stepIndex = stepRun.steps.length;
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
        toolErrors: [],
        usage: payload.payload.output.usage,
        warnings: payload.payload.stepResult.warnings || [],
        steps: [...stepRun.steps, stepResult],
        _textOffset: stepRun.text.length,
        _reasoningOffset: stepRun.reasoning.length,
      });
      completedStep = { stepIndex, step: stepResult };
      hasChanged = true;
      break;
    }
    default:
      break;
  }

  if (hasChanged) {
    const current = bufferedSteps.get(payload.runId!)!;
    const snapshot = createAgentDataPart({
      current,
      runId: payload.runId!,
      ancestry,
      includeCompletedStepDetails: payload.type === 'finish',
      includeResponseMessages: payload.type === 'finish',
    });

    if (completedStep) {
      return [
        snapshot,
        createAgentStepDataPart({
          runId: payload.runId!,
          stepIndex: completedStep.stepIndex,
          step: completedStep.step,
          ancestry,
        }),
      ] as const;
    }

    return snapshot;
  }
  return null;
}

export function transformWorkflow<OUTPUT>(
  payload: ChunkType<OUTPUT>,
  bufferedWorkflows: Map<string, BufferedWorkflowState>,
  isNested?: boolean,
  includeTextStreamParts?: boolean,
  streamOptions?: { sendReasoning?: boolean; sendSources?: boolean },
  convertMastraChunkToAISDK: ConvertMastraChunkToAISDK = convertMastraChunkToAISDKDefault,
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
        return toUIDataChunk(output);
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
        return toUIDataChunk(payload);
      }
      return null;
    }
  }
}
