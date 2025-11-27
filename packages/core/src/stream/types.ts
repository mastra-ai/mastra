import type { LanguageModelV1LogProbs } from '@ai-sdk/provider';
import type {
  LanguageModelV2FinishReason,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
  LanguageModelV2CallWarning,
  LanguageModelV2ResponseMetadata,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type { FinishReason, LanguageModelRequestMetadata, TelemetrySettings } from 'ai';
import type { ModelMessage, StepResult, ToolSet, TypedToolCall, UIMessage } from 'ai-v5';
import type { AIV5ResponseMessage } from '../agent/message-list';
import type { AIV5Type } from '../agent/message-list/types';
import type { StructuredOutputOptions } from '../agent/types';
import type { TracingContext } from '../ai-tracing/types';
import type { MastraLanguageModelV2 } from '../llm/model/shared.types';
import type { OutputProcessor } from '../processors';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../workflows/types';
import type { InferSchemaOutput, OutputSchema, PartialSchemaOutput } from './base/schema';

export enum ChunkFrom {
  AGENT = 'AGENT',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  WORKFLOW = 'WORKFLOW',
  NETWORK = 'NETWORK',
}

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
  providerMetadata?: SharedV2ProviderMetadata;
}

export interface TextDeltaPayload {
  id: string;
  providerMetadata?: SharedV2ProviderMetadata;
  text: string;
}

interface TextEndPayload {
  id: string;
  providerMetadata?: SharedV2ProviderMetadata;
  [key: string]: unknown;
}

export interface ReasoningStartPayload {
  id: string;
  providerMetadata?: SharedV2ProviderMetadata;
  signature?: string;
}

export interface ReasoningDeltaPayload {
  id: string;
  providerMetadata?: SharedV2ProviderMetadata;
  text: string;
}

interface ReasoningEndPayload {
  id: string;
  providerMetadata?: SharedV2ProviderMetadata;
  signature?: string;
}

export interface SourcePayload {
  id: string;
  sourceType: 'url' | 'document';
  title: string;
  mimeType?: string;
  filename?: string;
  url?: string;
  providerMetadata?: SharedV2ProviderMetadata;
}

export interface FilePayload {
  data: string | Uint8Array;
  base64?: string;
  mimeType: string;
  providerMetadata?: SharedV2ProviderMetadata;
}

type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue | undefined };
type JSONArray = JSONValue[];

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
  providerMetadata?: SharedV2ProviderMetadata;
  output?: TOutput;
  dynamic?: boolean;
}

export interface ToolResultPayload<TResult = unknown, TArgs = unknown> {
  toolCallId: string;
  toolName: string;
  result: TResult;
  isError?: boolean;
  providerExecuted?: boolean;
  providerMetadata?: SharedV2ProviderMetadata;
  args?: TArgs;
  dynamic?: boolean;
}

export type DynamicToolCallPayload = ToolCallPayload<any, any>;
export type DynamicToolResultPayload = ToolResultPayload<any, any>;

interface ToolCallInputStreamingStartPayload {
  toolCallId: string;
  toolName: string;
  providerExecuted?: boolean;
  providerMetadata?: SharedV2ProviderMetadata;
  dynamic?: boolean;
}

interface ToolCallDeltaPayload {
  argsTextDelta: string;
  toolCallId: string;
  providerMetadata?: SharedV2ProviderMetadata;
  toolName?: string;
}

interface ToolCallInputStreamingEndPayload {
  toolCallId: string;
  providerMetadata?: SharedV2ProviderMetadata;
}

interface FinishPayload {
  stepResult: {
    reason: LanguageModelV2FinishReason;
    warnings?: LanguageModelV2CallWarning[];
    isContinued?: boolean;
    logprobs?: LanguageModelV1LogProbs;
  };
  output: {
    usage: LanguageModelV2Usage;
  };
  metadata: {
    providerMetadata?: SharedV2ProviderMetadata;
    request?: LanguageModelRequestMetadata;
    [key: string]: unknown;
  };
  messages: {
    all: ModelMessage[];
    user: ModelMessage[];
    nonUser: AIV5ResponseMessage[];
  };
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

export interface StepFinishPayload<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> {
  id?: string;
  providerMetadata?: SharedV2ProviderMetadata;
  totalUsage?: LanguageModelV2Usage;
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
    usage: LanguageModelV2Usage;
    steps?: StepResult<Tools>[];
    object?: OUTPUT extends undefined ? unknown : InferSchemaOutput<OUTPUT>;
  };
  metadata: {
    request?: LanguageModelRequestMetadata;
    providerMetadata?: SharedV2ProviderMetadata;
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
  providerMetadata?: SharedV2ProviderMetadata;
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
  providerMetadata?: SharedV2ProviderMetadata;
}

interface RedactedReasoningPayload {
  id: string;
  data: unknown;
  providerMetadata?: SharedV2ProviderMetadata;
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

interface TripwirePayload {
  tripwireReason: string;
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
  usage: LanguageModelV2Usage;
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

interface AgentExecutionEndPayload {
  task: string;
  agentId: string;
  result: string;
  isComplete: boolean;
  iteration: number;
  usage: LanguageModelV2Usage;
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
  usage: LanguageModelV2Usage;
  runId: string;
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

interface NetworkFinishPayload {
  task: string;
  primitiveId: string;
  primitiveType: string;
  prompt: string;
  result: string;
  isComplete?: boolean;
  completionReason: string;
  iteration: number;
  threadId?: string;
  threadResourceId?: string;
  isOneOff: boolean;
  usage: LanguageModelV2Usage;
}

interface ToolCallApprovalPayload {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
}

interface ToolCallSuspendedPayload {
  toolCallId: string;
  toolName: string;
  suspendPayload: any;
}

export type DataChunkType = {
  type: `data-${string}`;
  data: any;
  id?: string;
};

export type NetworkChunkType =
  | (BaseChunkType & { type: 'routing-agent-start'; payload: RoutingAgentStartPayload })
  | (BaseChunkType & { type: 'routing-agent-text-delta'; payload: RoutingAgentTextDeltaPayload })
  | (BaseChunkType & { type: 'routing-agent-text-start'; payload: RoutingAgentTextStartPayload })
  | (BaseChunkType & { type: 'routing-agent-end'; payload: RoutingAgentEndPayload })
  | (BaseChunkType & { type: 'agent-execution-start'; payload: AgentExecutionStartPayload })
  | (BaseChunkType & { type: 'agent-execution-end'; payload: AgentExecutionEndPayload })
  | (BaseChunkType & { type: 'workflow-execution-start'; payload: WorkflowExecutionStartPayload })
  | (BaseChunkType & { type: 'workflow-execution-end'; payload: WorkflowExecutionEndPayload })
  | (BaseChunkType & { type: 'tool-execution-start'; payload: ToolExecutionStartPayload })
  | (BaseChunkType & { type: 'tool-execution-end'; payload: ToolExecutionEndPayload })
  | (BaseChunkType & { type: 'network-execution-event-step-finish'; payload: NetworkStepFinishPayload })
  | (BaseChunkType & { type: 'network-execution-event-finish'; payload: NetworkFinishPayload })
  | (BaseChunkType & { type: `agent-execution-event-${string}`; payload: AgentChunkType })
  | (BaseChunkType & { type: `workflow-execution-event-${string}`; payload: WorkflowStreamEvent });

// Strongly typed chunk type (currently only OUTPUT is strongly typed, tools use dynamic types)
export type AgentChunkType<OUTPUT extends OutputSchema = undefined> =
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
      object: PartialSchemaOutput<OUTPUT>;
    })
  | (BaseChunkType & {
      /**
       * The object promise is resolved with the object from the object-result chunk
       */
      type: 'object-result';
      object: InferSchemaOutput<OUTPUT>;
    })
  | (BaseChunkType & { type: 'tool-output'; payload: DynamicToolOutputPayload })
  | (BaseChunkType & { type: 'step-output'; payload: StepOutputPayload })
  | (BaseChunkType & { type: 'watch'; payload: WatchPayload })
  | (BaseChunkType & { type: 'tripwire'; payload: TripwirePayload });

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
      type: 'workflow-step-result';
      payload: {
        id: string;
        stepCallId: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
      };
    });

// Strongly typed chunk type (currently only OUTPUT is strongly typed, tools use dynamic types)
export type TypedChunkType<OUTPUT extends OutputSchema = undefined> =
  | AgentChunkType<OUTPUT>
  | WorkflowStreamEvent
  | NetworkChunkType
  | (DataChunkType & { from: never; runId: never; metadata?: BaseChunkType['metadata']; payload: never });

// Default ChunkType for backward compatibility using dynamic (any) tool types
export type ChunkType<OUTPUT extends OutputSchema = undefined> = TypedChunkType<OUTPUT>;

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
  callback: (model: MastraLanguageModelV2, isLastModel: boolean) => Promise<T>,
) => Promise<T>;

export type ModelManagerModelConfig = {
  model: MastraLanguageModelV2;
  maxRetries: number;
  id: string;
};

export interface LanguageModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export type partialModel = {
  modelId?: string;
  provider?: string;
  version?: string;
};

export type MastraOnStepFinishCallback = (
  event: LLMStepResult & { model?: partialModel; runId?: string },
) => Promise<void> | void;

export type MastraOnFinishCallbackArgs<OUTPUT extends OutputSchema = undefined> = LLMStepResult & {
  error?: Error | string | { message: string; stack: string };
  object?: InferSchemaOutput<OUTPUT>;
  steps: LLMStepResult[];
  totalUsage: LanguageModelUsage;
  model?: partialModel;
  runId?: string;
};

export type MastraOnFinishCallback = (event: MastraOnFinishCallbackArgs) => Promise<void> | void;

export type MastraModelOutputOptions<OUTPUT extends OutputSchema = undefined> = {
  runId: string;
  rootSpan?: Span;
  telemetry_settings?: TelemetrySettings;
  toolCallStreaming?: boolean;
  onFinish?: MastraOnFinishCallback;
  onStepFinish?: MastraOnStepFinishCallback;
  includeRawChunks?: boolean;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  outputProcessors?: OutputProcessor[];
  isLLMExecutionStep?: boolean;
  returnScorerData?: boolean;
  tracingContext?: TracingContext;
  processorStates?: Map<string, any>;
};

export type LLMStepResult<OUTPUT extends OutputSchema = undefined> = {
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
    uiMessages?: UIMessage<
      OUTPUT extends OutputSchema
        ? {
            structuredOutput?: InferSchemaOutput<OUTPUT>;
          } & Record<string, unknown>
        : unknown
    >[];
    id?: string;
    timestamp?: Date;
    modelId?: string;
    [key: string]: unknown;
  };
  reasoningText: string | undefined;
  providerMetadata: SharedV2ProviderMetadata | undefined;
};
