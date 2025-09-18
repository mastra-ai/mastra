import type { LanguageModelV1LogProbs } from '@ai-sdk/provider';
import type {
  LanguageModelV2FinishReason,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
  LanguageModelV2CallWarning,
  LanguageModelV2ResponseMetadata,
  LanguageModelV2,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider-v5';
import type { LanguageModelRequestMetadata } from 'ai';
import type { CoreMessage, StepResult, ToolSet, UIMessage } from 'ai-v5';
import type { WorkflowStreamEvent } from '../workflows/types';
import type { OutputSchema, PartialSchemaOutput } from './base/schema';

export enum ChunkFrom {
  AGENT = 'AGENT',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  WORKFLOW = 'WORKFLOW',
}

interface BaseChunkType {
  runId: string;
  from: ChunkFrom;
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

export interface ToolCallPayload {
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  providerExecuted?: boolean;
  providerMetadata?: SharedV2ProviderMetadata;
  output?: unknown;
}

export interface ToolResultPayload {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
  providerExecuted?: boolean;
  providerMetadata?: SharedV2ProviderMetadata;
  args?: Record<string, unknown>;
}

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
    all: CoreMessage[];
    user: CoreMessage[];
    nonUser: CoreMessage[];
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

interface StepStartPayload {
  messageId?: string;
  request: {
    body?: string;
    [key: string]: unknown;
  };
  warnings?: LanguageModelV2CallWarning[];
  [key: string]: unknown;
}

export interface StepFinishPayload {
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
    usage: LanguageModelV2Usage;
  };
  metadata: {
    request?: LanguageModelRequestMetadata;
    providerMetadata?: SharedV2ProviderMetadata;
    [key: string]: unknown;
  };
  messages?: {
    all: CoreMessage[];
    user: CoreMessage[];
    nonUser: CoreMessage[];
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

interface ToolOutputPayload {
  output: unknown;
  [key: string]: unknown;
}

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
  inputData: {
    task: string;
    resourceId: string;
    resourceType: string;
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
  resourceId: string;
  resourceType: string;
  prompt: string;
  result: string;
  isComplete?: boolean;
  selectionReason: string;
  iteration: number;
}

interface AgentExecutionStartPayload {
  agentId: string;
  args: {
    task: string;
    resourceId: string;
    resourceType: string;
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
}

interface WorkflowExecutionStartPayload {
  name: string;
  args: {
    task: string;
    resourceId: string;
    resourceType: string;
    prompt: string;
    result: string;
    isComplete?: boolean;
    selectionReason: string;
    iteration: number;
  };
  runId: string;
}

interface WorkflowExecutionEndPayload {
  task: string;
  resourceId: string;
  resourceType: string;
  result: string;
  isComplete: boolean;
  iteration: number;
}

interface ToolExecutionStartPayload {
  args: Record<string, unknown>;
  toolName: string;
  runId: string;
  toolCallId: string;
}

interface ToolExecutionEndPayload {
  task: string;
  resourceId: string;
  resourceType: string;
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
}

interface NetworkFinishPayload {
  task: string;
  resourceId: string;
  resourceType: string;
  prompt: string;
  result: string;
  isComplete?: boolean;
  completionReason: string;
  iteration: number;
  threadId?: string;
  threadResourceId?: string;
  isOneOff: boolean;
}

export type NetworkChunkType =
  | (BaseChunkType & { type: 'routing-agent-start'; payload: RoutingAgentStartPayload })
  | (BaseChunkType & { type: 'routing-agent-end'; payload: RoutingAgentEndPayload })
  | (BaseChunkType & { type: 'agent-execution-start'; payload: AgentExecutionStartPayload })
  | (BaseChunkType & { type: 'agent-execution-end'; payload: AgentExecutionEndPayload })
  | (BaseChunkType & { type: 'workflow-execution-start'; payload: WorkflowExecutionStartPayload })
  | (BaseChunkType & { type: 'workflow-execution-end'; payload: WorkflowExecutionEndPayload })
  | (BaseChunkType & { type: 'tool-execution-start'; payload: ToolExecutionStartPayload })
  | (BaseChunkType & { type: 'tool-execution-end'; payload: ToolExecutionEndPayload })
  | (BaseChunkType & { type: 'network-execution-event-step-finish'; payload: NetworkStepFinishPayload })
  | (BaseChunkType & { type: 'network-execution-event-finish'; payload: NetworkFinishPayload })
  | (BaseChunkType & { type: `agent-execution-event-${string}`; payload: unknown })
  | (BaseChunkType & { type: `workflow-execution-event-${string}`; payload: unknown });

export type ChunkType<OUTPUT extends OutputSchema = undefined> =
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
  | (BaseChunkType & { type: 'tool-result'; payload: ToolResultPayload })
  | (BaseChunkType & { type: 'tool-call-input-streaming-start'; payload: ToolCallInputStreamingStartPayload })
  | (BaseChunkType & { type: 'tool-call-delta'; payload: ToolCallDeltaPayload })
  | (BaseChunkType & { type: 'tool-call-input-streaming-end'; payload: ToolCallInputStreamingEndPayload })
  | (BaseChunkType & { type: 'finish'; payload: FinishPayload })
  | (BaseChunkType & { type: 'error'; payload: ErrorPayload })
  | (BaseChunkType & { type: 'raw'; payload: RawPayload })
  | (BaseChunkType & { type: 'start'; payload: StartPayload })
  | (BaseChunkType & { type: 'step-start'; payload: StepStartPayload })
  | (BaseChunkType & { type: 'step-finish'; payload: StepFinishPayload })
  | (BaseChunkType & { type: 'tool-error'; payload: ToolErrorPayload })
  | (BaseChunkType & { type: 'abort'; payload: AbortPayload })
  | (BaseChunkType & {
      type: 'object';
      object: PartialSchemaOutput<OUTPUT>;
    })
  | (BaseChunkType & { type: 'tool-output'; payload: ToolOutputPayload })
  | (BaseChunkType & { type: 'step-output'; payload: StepOutputPayload })
  | (BaseChunkType & { type: 'workflow-step-output'; payload: StepOutputPayload })
  | (BaseChunkType & { type: 'watch'; payload: WatchPayload })
  | (BaseChunkType & { type: 'tripwire'; payload: TripwirePayload })
  | (BaseChunkType & WorkflowStreamEvent)
  | NetworkChunkType;

export interface LanguageModelV2StreamResult {
  stream: ReadableStream<LanguageModelV2StreamPart>;
  request: {
    body?: unknown;
  };
  response: {
    headers?: Record<string, string>;
  };
  warnings?: LanguageModelV2CallWarning[];
}

export type OnResult = (result: {
  warnings?: LanguageModelV2CallWarning[];
  request: LanguageModelV2StreamResult['request'] | LanguageModelRequestMetadata;
  rawResponse: LanguageModelV2StreamResult['response'] | Record<string, never>;
}) => void;

export type CreateStream = () => Promise<{
  stream: ReadableStream<LanguageModelV2StreamPart>;
  warnings?: LanguageModelV2CallWarning[];
  request: LanguageModelV2StreamResult['request'] | LanguageModelRequestMetadata;
  rawResponse?: LanguageModelV2StreamResult['response'];
  response?: LanguageModelV2StreamResult['response'];
}>;

// Type helpers for chunk payloads
export type SourceChunk = BaseChunkType & { type: 'source'; payload: SourcePayload };
export type FileChunk = BaseChunkType & { type: 'file'; payload: FilePayload };
export type ToolCallChunk = BaseChunkType & { type: 'tool-call'; payload: ToolCallPayload };
export type ToolResultChunk = BaseChunkType & { type: 'tool-result'; payload: ToolResultPayload };

export interface StepBufferItem<TOOLS extends ToolSet = ToolSet>
  extends Omit<StepResult<TOOLS>, 'sources' | 'files' | 'toolCalls' | 'toolResults' | 'response'> {
  // Our custom properties
  stepType: 'initial' | 'tool-result';
  isContinued?: boolean;

  // Keep original Mastra chunk format for these
  sources: SourceChunk[];
  files: FileChunk[];
  toolCalls: ToolCallChunk[];
  toolResults: ToolResultChunk[];

  // Override response to include uiMessages
  response: StepResult<TOOLS>['response'] & {
    uiMessages?: UIMessage[];
  };
}

export interface BufferedByStep {
  text: string;
  reasoning: string;
  sources: SourceChunk[];
  files: FileChunk[];
  toolCalls: ToolCallChunk[];
  toolResults: ToolResultChunk[];
  msgCount: number;
}

export type ExecuteStreamModelManager<T> = (
  callback: (model: LanguageModelV2, isLastModel: boolean) => Promise<T>,
) => Promise<T>;

export type ModelManagerModelConfig = {
  model: LanguageModelV2;
  maxRetries: number;
  id: string;
};
