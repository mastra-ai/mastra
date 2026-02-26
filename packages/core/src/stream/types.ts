import type {
  LanguageModelV2FinishReason,
  LanguageModelV2Usage,
  LanguageModelV2CallWarning,
  LanguageModelV2ResponseMetadata,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider-v5';

import type {
  FinishReason,
  LanguageModelRequestMetadata,
  LogProbs as LanguageModelV1LogProbs,
} from '@internal/ai-sdk-v4';
import type { ModelMessage, StepResult, ToolSet, TypedToolCall, UIMessage } from '@internal/ai-sdk-v5';
import type { AIV5ResponseMessage } from '../agent/message-list';
import type { AIV5Type, MastraDBMessage } from '../agent/message-list/types';
import type { StructuredOutputOptions } from '../agent/types';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { ScorerResult } from '../loop';
import type { ObservabilityContext } from '../observability';
import type { OutputProcessorOrWorkflow } from '../processors';
import type { RequestContext } from '../request-context';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../workflows/types';
import type { OutputSchema } from './base/schema';

export enum ChunkFrom {
  AGENT = 'AGENT',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  WORKFLOW = 'WORKFLOW',
  NETWORK = 'NETWORK',
}

/**
 * Extended finish reason that includes Mastra-specific values.
 * 'tripwire' and 'retry' are used for processor scenarios.
 */
export type MastraFinishReason = LanguageModelV2FinishReason | 'tripwire' | 'retry';

/**
A JSON value can be a string, number, boolean, object, array, or null.
JSON values can be serialized and deserialized by the JSON.stringify and JSON.parse methods.
 */
export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
export type JSONObject = {
  [key: string]: JSONValue;
};
export type JSONArray = JSONValue[];

/**
 * Additional provider-specific metadata.
 * The outer record is keyed by the provider name, and the inner
 * record is keyed by the provider-specific metadata key.
 */
export type ProviderMetadata = Record<string, Record<string, JSONValue>>;

interface BaseChunkType {
  runId: string;
  from: ChunkFrom;
  metadata?: Record<string, any>;
}

interface ResponseMetadataPayload {
  signature?: string;
  [key: string]: unknown;
}

export interface TextStartPayload {
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface TextDeltaPayload {
  id: string;
  providerMetadata?: ProviderMetadata;
  text: string;
}

interface TextEndPayload {
  id: string;
  providerMetadata?: ProviderMetadata;
  [key: string]: unknown;
}

export interface ReasoningStartPayload {
  id: string;
  providerMetadata?: ProviderMetadata;
  signature?: string;
}

export interface ReasoningDeltaPayload {
  id: string;
  providerMetadata?: ProviderMetadata;
  text: string;
}

interface ReasoningEndPayload {
  id: string;
  providerMetadata?: ProviderMetadata;
  signature?: string;
}

export interface SourcePayload {
  id: string;
  sourceType: 'url' | 'document';
  title: string;
  mimeType?: string;
  filename?: string;
  url?: string;
  providerMetadata?: ProviderMetadata;
}

export interface FilePayload {
  data: string | Uint8Array;
  base64?: string;
  mimeType: string;
  providerMetadata?: ProviderMetadata;
}

export type ReadonlyJSONValue = null | string | number | boolean | ReadonlyJSONObject | ReadonlyJSONArray;

export type ReadonlyJSONObject = {
  readonly [key: string]: ReadonlyJSONValue;
};

export type ReadonlyJSONArray = readonly ReadonlyJSONValue[];

export interface MastraMetadataMessage {
  type: 'text' | 'tool';
  content?: string;
  toolName?: string;
  toolInput?: ReadonlyJSONValue;
  toolOutput?: ReadonlyJSONValue;
  args?: ReadonlyJSONValue;
  toolCallId?: string;
  result?: ReadonlyJSONValue;
}

export interface MastraMetadata {
  isStreaming?: boolean;
  from?: 'AGENT' | 'WORKFLOW' | 'USER' | 'SYSTEM';
  networkMetadata?: ReadonlyJSONObject;
  toolOutput?: ReadonlyJSONValue | ReadonlyJSONValue[];
  messages?: MastraMetadataMessage[];
  workflowFullState?: ReadonlyJSONObject;
  selectionReason?: string;
}

export interface ToolCallPayload<TArgs = unknown, TOutput = unknown> {
  toolCallId: string;
  toolName: string;
  args?: TArgs & {
    __mastraMetadata?: MastraMetadata;
  };
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
  output?: TOutput;
  dynamic?: boolean;
}

export interface ToolResultPayload<TResult = unknown, TArgs = unknown> {
  toolCallId: string;
  toolName: string;
  result: TResult;
  isError?: boolean;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
  args?: TArgs;
  dynamic?: boolean;
}

export type DynamicToolCallPayload = ToolCallPayload<any, any>;
export type DynamicToolResultPayload = ToolResultPayload<any, any>;

interface ToolCallInputStreamingStartPayload {
  toolCallId: string;
  toolName: string;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
  dynamic?: boolean;
}

interface ToolCallDeltaPayload {
  argsTextDelta: string;
  toolCallId: string;
  providerMetadata?: ProviderMetadata;
  toolName?: string;
}

interface ToolCallInputStreamingEndPayload {
  toolCallId: string;
  providerMetadata?: ProviderMetadata;
}

interface FinishPayload<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> {
  stepResult: {
    /** Includes 'tripwire' and 'retry' for processor scenarios */
    reason: LanguageModelV2FinishReason | 'tripwire' | 'retry';
    warnings?: LanguageModelV2CallWarning[];
    isContinued?: boolean;
    logprobs?: LanguageModelV1LogProbs;
  };
  output: {
    usage: LanguageModelUsage;
    /** Steps array - uses MastraStepResult which extends AI SDK StepResult with tripwire data */
    steps?: MastraStepResult<Tools>[];
  };
  metadata: {
    providerMetadata?: ProviderMetadata;
    request?: LanguageModelRequestMetadata;
    [key: string]: unknown;
  };
  messages: {
    all: ModelMessage[];
    user: ModelMessage[];
    nonUser: AIV5ResponseMessage[];
  };
  response?: LLMStepResult<OUTPUT>['response'];
  [key: string]: unknown;
}

interface ErrorPayload {
  error: unknown;
  [key: string]: unknown;
}

interface RawPayload {
  [key: string]: unknown;
}

interface StartPayload {
  [key: string]: unknown;
}

export interface StepStartPayload {
  messageId?: string;
  request: {
    body?: string;
    [key: string]: unknown;
  };
  warnings?: LanguageModelV2CallWarning[];
  [key: string]: unknown;
}

export interface StepFinishPayload<Tools extends ToolSet = ToolSet, OUTPUT = undefined> {
  id?: string;
  providerMetadata?: ProviderMetadata;
  totalUsage?: LanguageModelUsage;
  response?: LanguageModelV2ResponseMetadata;
  messageId?: string;
  stepResult: {
    logprobs?: LanguageModelV1LogProbs;
    isContinued?: boolean;
    warnings?: LanguageModelV2CallWarning[];
    reason: LanguageModelV2FinishReason;
  };
  output: {
    text?: string;
    toolCalls?: TypedToolCall<Tools>[];
    usage: LanguageModelUsage;
    /** Steps array - uses MastraStepResult which extends AI SDK StepResult with tripwire data */
    steps?: MastraStepResult<Tools>[];
    object?: OUTPUT;
  };
  metadata: {
    request?: LanguageModelRequestMetadata;
    providerMetadata?: ProviderMetadata;
    [key: string]: unknown;
  };
  messages?: {
    all: ModelMessage[];
    user: ModelMessage[];
    nonUser: AIV5ResponseMessage[];
  };
  [key: string]: unknown;
}

interface ToolErrorPayload {
  id?: string;
  providerMetadata?: ProviderMetadata;
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  error: unknown;
  providerExecuted?: boolean;
}

interface AbortPayload {
  [key: string]: unknown;
}

interface ReasoningSignaturePayload {
  id: string;
  signature: string;
  providerMetadata?: ProviderMetadata;
}

interface RedactedReasoningPayload {
  id: string;
  data: unknown;
  providerMetadata?: ProviderMetadata;
}

interface ToolOutputPayload<TOutput = unknown> {
  output: TOutput; // Tool outputs can be any shape, including nested workflow chunks
  toolCallId: string;
  toolName?: string;
  [key: string]: unknown;
}

type DynamicToolOutputPayload = ToolOutputPayload<any>;

// Define a specific type for nested workflow outputs
type NestedWorkflowOutput = {
  from: ChunkFrom;
  type: string;
  payload?: {
    output?: ChunkType | NestedWorkflowOutput; // Allow one level of nesting
    usage?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

interface StepOutputPayload {
  output: ChunkType | NestedWorkflowOutput;
  [key: string]: unknown;
}

interface WatchPayload {
  [key: string]: unknown;
}

interface TripwirePayload<TMetadata = unknown> {
  /** The reason for the tripwire */
  reason: string;
  /** If true, the agent should retry with the tripwire reason as feedback */
  retry?: boolean;
  /** Strongly typed metadata from the processor */
  metadata?: TMetadata;
  /** The ID of the processor that triggered the tripwire */
  processorId?: string;
}

/**
 * Payload for is-task-complete events emitted during stream/generate scoring.
 */
interface IsTaskCompletePayload {
  /** Current iteration number */
  iteration: number;
  /** Whether all/any scorers passed based on strategy */
  passed: boolean;
  /** Individual scorer results */
  results: ScorerResult[];
  /** Total duration of all scoring checks */
  duration: number;
  /** Whether scoring timed out */
  timedOut: boolean;
  /** Reason from the relevant scorer */
  reason?: string;
  /** Whether the maximum iteration was reached */
  maxIterationReached: boolean;
  /** Whether to suppress the completion feedback message */
  suppressFeedback: boolean;
}

// Network-specific payload interfaces
interface RoutingAgentStartPayload {
  agentId: string;
  networkId: string;
  runId: string;
  inputData: {
    task: string;
    primitiveId: string;
    primitiveType: string;
    result?: string;
    iteration: number;
    threadId?: string;
    threadResourceId?: string;
    isOneOff: boolean;
    verboseIntrospection: boolean;
  };
}

interface RoutingAgentEndPayload {
  task: string;
  primitiveId: string;
  primitiveType: string;
  prompt: string;
  result: string;
  isComplete?: boolean;
  selectionReason: string;
  iteration: number;
  runId: string;
  usage: LanguageModelUsage;
}

interface RoutingAgentTextDeltaPayload {
  text: string;
}

interface RoutingAgentTextStartPayload {
  runId: string;
}

interface AgentExecutionStartPayload {
  agentId: string;
  args: {
    task: string;
    primitiveId: string;
    primitiveType: string;
    prompt: string;
    result: string;
    isComplete?: boolean;
    selectionReason: string;
    iteration: number;
  };
  runId: string;
}

interface AgentExecutionApprovalPayload extends ToolCallApprovalPayload {
  agentId: string;
  usage: LanguageModelUsage;
  runId: string;
  selectionReason: string;
}

interface AgentExecutionSuspendedPayload extends ToolCallSuspendedPayload {
  agentId: string;
  suspendPayload: any;
  usage: LanguageModelUsage;
  runId: string;
  selectionReason: string;
}

interface AgentExecutionEndPayload {
  task: string;
  agentId: string;
  result: string;
  isComplete: boolean;
  iteration: number;
  usage: LanguageModelUsage;
  runId: string;
}

interface WorkflowExecutionStartPayload {
  name: string;
  workflowId: string;
  args: {
    task: string;
    primitiveId: string;
    primitiveType: string;
    prompt: string;
    result: string;
    isComplete?: boolean;
    selectionReason: string;
    iteration: number;
  };
  runId: string;
}

interface WorkflowExecutionEndPayload {
  name: string;
  workflowId: string;
  task: string;
  primitiveId: string;
  primitiveType: string;
  result: string;
  isComplete: boolean;
  iteration: number;
  usage: LanguageModelUsage;
  runId: string;
}

interface WorkflowExecutionSuspendPayload extends ToolCallSuspendedPayload {
  name: string;
  workflowId: string;
  suspendPayload: any;
  usage: LanguageModelUsage;
  runId: string;
  selectionReason: string;
}

interface ToolExecutionStartPayload {
  args: Record<string, unknown> & {
    toolName?: string;
    toolCallId?: string;
    args?: Record<string, unknown>; // The actual tool arguments are nested here
    selectionReason?: string;
    __mastraMetadata?: MastraMetadata;
    // Other inputData fields spread here
    [key: string]: unknown;
  };
  runId: string;
}

interface ToolExecutionApprovalPayload extends ToolCallApprovalPayload {
  selectionReason: string;
  runId: string;
}

interface ToolExecutionSuspendedPayload extends ToolCallSuspendedPayload {
  selectionReason: string;
  runId: string;
}

interface ToolExecutionEndPayload {
  task: string;
  primitiveId: string;
  primitiveType: string;
  result: unknown;
  isComplete: boolean;
  iteration: number;
  toolCallId: string;
  toolName: string;
}

interface NetworkStepFinishPayload {
  task: string;
  result: string;
  isComplete: boolean;
  iteration: number;
  runId: string;
}

interface NetworkFinishPayload<OUTPUT = undefined> {
  task: string;
  primitiveId: string;
  primitiveType: string;
  prompt: string;
  result: string;
  /** Structured output object when structuredOutput option is provided */
  object?: OUTPUT;
  isComplete?: boolean;
  completionReason: string;
  iteration: number;
  threadId?: string;
  threadResourceId?: string;
  isOneOff: boolean;
  usage: LanguageModelUsage;
}

interface NetworkValidationStartPayload {
  runId: string;
  iteration: number;
  checksCount: number;
}

interface NetworkValidationEndPayload {
  runId: string;
  iteration: number;
  passed: boolean;
  results: ScorerResult[];
  duration: number;
  timedOut: boolean;
  reason?: string;
  maxIterationReached: boolean;
  suppressFeedback: boolean;
}

interface RoutingAgentAbortPayload {
  primitiveType: 'routing';
  primitiveId: string;
}

interface AgentExecutionAbortPayload {
  primitiveType: 'agent';
  primitiveId: string;
}

interface WorkflowExecutionAbortPayload {
  primitiveType: 'workflow';
  primitiveId: string;
}

interface ToolExecutionAbortPayload {
  primitiveType: 'tool';
  primitiveId: string;
}

interface ToolCallApprovalPayload {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  resumeSchema: string;
}

interface ToolCallSuspendedPayload {
  toolCallId: string;
  toolName: string;
  suspendPayload: any;
  args: Record<string, any>;
  resumeSchema: string;
}

export type DataChunkType = {
  type: `data-${string}`;
  data: any;
  id?: string;
};

export type NetworkChunkType<OUTPUT = undefined> =
  | (BaseChunkType & { type: 'routing-agent-start'; payload: RoutingAgentStartPayload })
  | (BaseChunkType & { type: 'routing-agent-text-delta'; payload: RoutingAgentTextDeltaPayload })
  | (BaseChunkType & { type: 'routing-agent-text-start'; payload: RoutingAgentTextStartPayload })
  | (BaseChunkType & { type: 'routing-agent-end'; payload: RoutingAgentEndPayload })
  | (BaseChunkType & { type: 'routing-agent-abort'; payload: RoutingAgentAbortPayload })
  | (BaseChunkType & { type: 'agent-execution-start'; payload: AgentExecutionStartPayload })
  | (BaseChunkType & { type: 'agent-execution-approval'; payload: AgentExecutionApprovalPayload })
  | (BaseChunkType & { type: 'agent-execution-suspended'; payload: AgentExecutionSuspendedPayload })
  | (BaseChunkType & { type: 'agent-execution-end'; payload: AgentExecutionEndPayload })
  | (BaseChunkType & { type: 'agent-execution-abort'; payload: AgentExecutionAbortPayload })
  | (BaseChunkType & { type: 'workflow-execution-start'; payload: WorkflowExecutionStartPayload })
  | (BaseChunkType & { type: 'workflow-execution-end'; payload: WorkflowExecutionEndPayload })
  | (BaseChunkType & { type: 'workflow-execution-suspended'; payload: WorkflowExecutionSuspendPayload })
  | (BaseChunkType & { type: 'workflow-execution-abort'; payload: WorkflowExecutionAbortPayload })
  | (BaseChunkType & { type: 'tool-execution-start'; payload: ToolExecutionStartPayload })
  | (BaseChunkType & { type: 'tool-execution-end'; payload: ToolExecutionEndPayload })
  | (BaseChunkType & { type: 'tool-execution-approval'; payload: ToolExecutionApprovalPayload })
  | (BaseChunkType & { type: 'tool-execution-suspended'; payload: ToolExecutionSuspendedPayload })
  | (BaseChunkType & { type: 'tool-execution-abort'; payload: ToolExecutionAbortPayload })
  | (BaseChunkType & { type: 'network-execution-event-step-finish'; payload: NetworkStepFinishPayload })
  | (BaseChunkType & { type: 'network-execution-event-finish'; payload: NetworkFinishPayload<OUTPUT> })
  | (BaseChunkType & { type: 'network-validation-start'; payload: NetworkValidationStartPayload })
  | (BaseChunkType & { type: 'network-validation-end'; payload: NetworkValidationEndPayload })
  | (BaseChunkType & { type: `agent-execution-event-${string}`; payload: AgentChunkType })
  | (BaseChunkType & { type: `workflow-execution-event-${string}`; payload: WorkflowStreamEvent })
  | (BaseChunkType & { type: 'network-object'; payload: { object: Partial<OUTPUT> } })
  | (BaseChunkType & { type: 'network-object-result'; payload: { object: OUTPUT } });

// Strongly typed chunk type (currently only OUTPUT is strongly typed, tools use dynamic types)
export type AgentChunkType<OUTPUT = undefined> =
  | (BaseChunkType & { type: 'response-metadata'; payload: ResponseMetadataPayload })
  | (BaseChunkType & { type: 'text-start'; payload: TextStartPayload })
  | (BaseChunkType & { type: 'text-delta'; payload: TextDeltaPayload })
  | (BaseChunkType & { type: 'text-end'; payload: TextEndPayload })
  | (BaseChunkType & { type: 'reasoning-start'; payload: ReasoningStartPayload })
  | (BaseChunkType & { type: 'reasoning-delta'; payload: ReasoningDeltaPayload })
  | (BaseChunkType & { type: 'reasoning-end'; payload: ReasoningEndPayload })
  | (BaseChunkType & { type: 'reasoning-signature'; payload: ReasoningSignaturePayload })
  | (BaseChunkType & { type: 'redacted-reasoning'; payload: RedactedReasoningPayload })
  | (BaseChunkType & { type: 'source'; payload: SourcePayload })
  | (BaseChunkType & { type: 'file'; payload: FilePayload })
  | (BaseChunkType & { type: 'tool-call'; payload: ToolCallPayload })
  | (BaseChunkType & { type: 'tool-call-approval'; payload: ToolCallApprovalPayload })
  | (BaseChunkType & { type: 'tool-call-suspended'; payload: ToolCallSuspendedPayload })
  | (BaseChunkType & { type: 'tool-result'; payload: ToolResultPayload })
  | (BaseChunkType & { type: 'tool-call-input-streaming-start'; payload: ToolCallInputStreamingStartPayload })
  | (BaseChunkType & { type: 'tool-call-delta'; payload: ToolCallDeltaPayload })
  | (BaseChunkType & { type: 'tool-call-input-streaming-end'; payload: ToolCallInputStreamingEndPayload })
  | (BaseChunkType & { type: 'finish'; payload: FinishPayload })
  | (BaseChunkType & { type: 'error'; payload: ErrorPayload })
  | (BaseChunkType & { type: 'raw'; payload: RawPayload })
  | (BaseChunkType & { type: 'start'; payload: StartPayload })
  | (BaseChunkType & { type: 'step-start'; payload: StepStartPayload })
  | (BaseChunkType & { type: 'step-finish'; payload: StepFinishPayload<ToolSet, OUTPUT> })
  | (BaseChunkType & { type: 'tool-error'; payload: ToolErrorPayload })
  | (BaseChunkType & { type: 'abort'; payload: AbortPayload })
  | (BaseChunkType & {
      type: 'object';
      object: Partial<OUTPUT>;
    })
  | (BaseChunkType & {
      /**
       * The object promise is resolved with the object from the object-result chunk
       */
      type: 'object-result';
      object: OUTPUT;
    })
  | (BaseChunkType & { type: 'tool-output'; payload: DynamicToolOutputPayload })
  | (BaseChunkType & { type: 'step-output'; payload: StepOutputPayload })
  | (BaseChunkType & { type: 'watch'; payload: WatchPayload })
  | (BaseChunkType & { type: 'tripwire'; payload: TripwirePayload })
  | (BaseChunkType & { type: 'is-task-complete'; payload: IsTaskCompletePayload });

export type WorkflowStreamEvent =
  | (BaseChunkType & {
      type: 'workflow-start';
      payload: {
        workflowId: string;
      };
    })
  | (BaseChunkType & {
      type: 'workflow-finish';
      payload: {
        workflowStatus: WorkflowRunStatus;
        output: {
          usage: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
          };
        };
        metadata: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      type: 'workflow-canceled';
      payload: {};
    })
  | (BaseChunkType & {
      type: 'workflow-paused';
      payload: {};
    })
  | (BaseChunkType & {
      type: 'workflow-step-start';
      id: string;
      payload: {
        id: string;
        stepCallId: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      type: 'workflow-step-finish';
      payload: {
        id: string;
        metadata: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      type: 'workflow-step-suspended';
      payload: {
        id: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      type: 'workflow-step-waiting';
      payload: {
        id: string;
        payload: Record<string, any>;
        startedAt: number;
        status: WorkflowStepStatus;
      };
    })
  | (BaseChunkType & { type: 'workflow-step-output'; payload: StepOutputPayload })
  | (BaseChunkType & {
      type: 'workflow-step-progress';
      payload: {
        id: string;
        /** Number of iterations completed so far */
        completedCount: number;
        /** Total number of iterations */
        totalCount: number;
        /** Index of the iteration that just completed */
        currentIndex: number;
        /** Status of the iteration that just completed */
        iterationStatus: 'success' | 'failed' | 'suspended';
        /** Output of the iteration that just completed (if successful) */
        iterationOutput?: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      type: 'workflow-step-result';
      payload: {
        id: string;
        stepCallId: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
        /** Tripwire data when step failed due to processor rejection */
        tripwire?: StepTripwireData;
      };
    });

// Strongly typed chunk type (currently only OUTPUT is strongly typed, tools use dynamic types)
export type TypedChunkType<OUTPUT = undefined> =
  | AgentChunkType<OUTPUT>
  | WorkflowStreamEvent
  | NetworkChunkType<OUTPUT>
  | (DataChunkType & { from: never; runId: never; metadata?: BaseChunkType['metadata']; payload: never });

// Default ChunkType for backward compatibility using dynamic (any) tool types
export type ChunkType<OUTPUT = undefined> = TypedChunkType<OUTPUT>;

export interface LanguageModelV2StreamResult {
  stream: ReadableStream<LanguageModelV2StreamPart>;
  request: LLMStepResult['request'];
  response?: LLMStepResult['response'];
  rawResponse: LLMStepResult['response'] | Record<string, never>;
  warnings?: LLMStepResult['warnings'];
}

export type OnResult = (result: Omit<LanguageModelV2StreamResult, 'stream'>) => void;
export type CreateStream = () => Promise<LanguageModelV2StreamResult>;

export type SourceChunk = BaseChunkType & { type: 'source'; payload: SourcePayload };
export type FileChunk = BaseChunkType & { type: 'file'; payload: FilePayload };
export type ToolCallChunk = BaseChunkType & { type: 'tool-call'; payload: ToolCallPayload };
export type ToolResultChunk = BaseChunkType & { type: 'tool-result'; payload: ToolResultPayload };
export type ReasoningChunk = BaseChunkType & { type: 'reasoning'; payload: ReasoningDeltaPayload };

export type ExecuteStreamModelManager<T> = (
  callback: (modelConfig: ModelManagerModelConfig, isLastModel: boolean) => Promise<T>,
) => Promise<T>;

export type ModelManagerModelConfig = {
  model: MastraLanguageModel;
  maxRetries: number;
  id: string;
  headers?: Record<string, string>;
};

/**
 * Extended usage type that includes raw provider data.
 * Extends LanguageModelV2Usage with additional fields for V3 compatibility.
 */
export type LanguageModelUsage = LanguageModelV2Usage & {
  reasoningTokens?: number;
  cachedInputTokens?: number;
  /**
   * Raw usage data from the provider, preserved for advanced use cases.
   * For V3 models, contains the full nested structure:
   * { inputTokens: { total, noCache, cacheRead, cacheWrite }, outputTokens: { total, text, reasoning } }
   */
  raw?: unknown;
};

export type partialModel = {
  modelId?: string;
  provider?: string;
  version?: string;
};

export type MastraOnStepFinishCallback<OUTPUT = undefined> = (
  event: LLMStepResult<OUTPUT> & { model?: partialModel; runId?: string },
) => Promise<void> | void;

export type MastraOnFinishCallbackArgs<OUTPUT = undefined> = LLMStepResult<OUTPUT> & {
  error?: Error | string | { message: string; stack: string };
  object?: OUTPUT;
  steps: LLMStepResult<OUTPUT>[];
  totalUsage: LanguageModelUsage;
  model?: partialModel;
  runId?: string;
};

export type MastraOnFinishCallback<OUTPUT = undefined> = (
  event: MastraOnFinishCallbackArgs<OUTPUT>,
) => Promise<void> | void;

export type MastraModelOutputOptions<OUTPUT = undefined> = {
  runId: string;
  toolCallStreaming?: boolean;
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  onStepFinish?: MastraOnStepFinishCallback<OUTPUT>;
  includeRawChunks?: boolean;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  outputProcessors?: OutputProcessorOrWorkflow[];
  isLLMExecutionStep?: boolean;
  returnScorerData?: boolean;
  processorStates?: Map<string, any>;
  requestContext?: RequestContext;
} & Partial<ObservabilityContext>;

/**
 * Tripwire data attached to a step when a processor triggers a tripwire.
 * When a step has tripwire data, its text is excluded from the final output.
 */
export interface StepTripwireData {
  /** The tripwire reason */
  reason: string;
  /** Whether retry was requested */
  retry?: boolean;
  /** Additional metadata from the tripwire */
  metadata?: unknown;
  /** ID of the processor that triggered the tripwire */
  processorId?: string;
}

/**
 * Extended StepResult that includes tripwire data.
 * This extends the AI SDK's StepResult with our custom tripwire field.
 */
export type MastraStepResult<Tools extends ToolSet = ToolSet> = StepResult<Tools> & {
  /** Tripwire data if this step was rejected by a processor */
  tripwire?: StepTripwireData;
};

export type LLMStepResult<OUTPUT = undefined> = {
  stepType?: 'initial' | 'tool-result';
  toolCalls: ToolCallChunk[];
  toolResults: ToolResultChunk[];
  dynamicToolCalls: ToolCallChunk[];
  dynamicToolResults: ToolResultChunk[];
  staticToolCalls: ToolCallChunk[];
  staticToolResults: ToolResultChunk[];
  files: FileChunk[];
  sources: SourceChunk[];
  text: string;
  reasoning: ReasoningChunk[];
  content: AIV5Type.StepResult<ToolSet>['content'];
  finishReason?: FinishReason | string;
  usage: LanguageModelUsage;
  warnings: LanguageModelV2CallWarning[];
  request: { body?: unknown };
  response: {
    headers?: Record<string, string>;
    messages?: StepResult<ToolSet>['response']['messages'];
    dbMessages?: MastraDBMessage[];
    uiMessages?: UIMessage<
      [OUTPUT] extends [undefined]
        ? undefined
        : {
            structuredOutput?: OUTPUT;
          } & Record<string, unknown>
    >[];
    id?: string;
    timestamp?: Date;
    modelId?: string;
    [key: string]: unknown;
  };
  reasoningText: string | undefined;
  providerMetadata: ProviderMetadata | undefined;
  /** Tripwire data if this step was rejected by a processor */
  tripwire?: StepTripwireData;
};
