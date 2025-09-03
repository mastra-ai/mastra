import type { LanguageModelV1LogProbs } from '@ai-sdk/provider';
import type {
  LanguageModelV2FinishReason,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
  LanguageModelV2CallWarning,
  LanguageModelV2ResponseMetadata,
} from '@ai-sdk/provider-v5';
import type { LanguageModelV1StreamPart, LanguageModelRequestMetadata } from 'ai';
import type { CoreMessage, StepResult } from 'ai-v5';
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
  [key: string]: any;
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
  [key: string]: any;
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

interface SourcePayload {
  id: string;
  sourceType: 'url' | 'document';
  title: string;
  mimeType?: string;
  filename?: string;
  url?: string;
  providerMetadata?: SharedV2ProviderMetadata;
}

interface FilePayload {
  data: string | Uint8Array;
  base64?: string;
  mimeType: string;
  providerMetadata?: SharedV2ProviderMetadata;
}

interface ToolCallPayload {
  toolCallId: string;
  toolName: string;
  args?: Record<string, any>;
  providerExecuted?: boolean;
  providerMetadata?: SharedV2ProviderMetadata;
  output?: any;
}

interface ToolResultPayload {
  toolCallId: string;
  toolName: string;
  result: any;
  isError?: boolean;
  providerExecuted?: boolean;
  providerMetadata?: SharedV2ProviderMetadata;
  args?: Record<string, any>;
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
    [key: string]: any;
  };
  messages: {
    all: CoreMessage[];
    user: CoreMessage[];
    nonUser: CoreMessage[];
  };
  [key: string]: any;
}

interface ErrorPayload {
  error: unknown;
  [key: string]: any;
}

interface RawPayload {
  [key: string]: any;
}

interface StartPayload {
  [key: string]: any;
}

interface StepStartPayload {
  messageId?: string;
  request: {
    body?: string;
    [key: string]: any;
  };
  warnings?: LanguageModelV2CallWarning[];
  [key: string]: any;
}

interface StepFinishPayload {
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
    [key: string]: any;
  };
  [key: string]: any;
}

interface ToolErrorPayload {
  id?: string;
  providerMetadata?: SharedV2ProviderMetadata;
  toolCallId: string;
  toolName: string;
  args?: Record<string, any>;
  error: unknown;
  providerExecuted?: boolean;
}

interface AbortPayload {
  [key: string]: any;
}

interface ReasoningSignaturePayload {
  id: string;
  signature: string;
  providerMetadata?: SharedV2ProviderMetadata;
}

interface RedactedReasoningPayload {
  id: string;
  data: any;
  providerMetadata?: SharedV2ProviderMetadata;
}

interface ToolOutputPayload {
  output: any;
  [key: string]: any;
}

interface StepOutputPayload {
  output: any;
  [key: string]: any;
}

interface WatchPayload {
  [key: string]: any;
}

interface TripwirePayload {
  tripwireReason: string;
}

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
  | (BaseChunkType & { type: 'watch'; payload: WatchPayload })
  | (BaseChunkType & { type: 'tripwire'; payload: TripwirePayload })
  | (BaseChunkType & WorkflowStreamEvent);

export type OnResult = (result: {
  warnings: Record<string, any>;
  request: Record<string, any>;
  rawResponse: Record<string, any>;
}) => void;

export type CreateStream = () => Promise<{
  stream: ReadableStream<LanguageModelV1StreamPart | Record<string, any>>;
  warnings: Record<string, any>;
  request: Record<string, any>;
  rawResponse?: Record<string, any>;
  response?: Record<string, any>;
}>;

export interface StepBufferItem {
  stepType: 'initial' | 'tool-result';
  text: string;
  reasoning?: string;
  sources: any[];
  files: any[];
  toolCalls: any[];
  toolResults: any[];
  warnings?: LanguageModelV2CallWarning[];
  reasoningDetails?: any;
  providerMetadata?: SharedV2ProviderMetadata;
  experimental_providerMetadata?: SharedV2ProviderMetadata;
  isContinued?: boolean;
  logprobs?: LanguageModelV1LogProbs;
  finishReason?: LanguageModelV2FinishReason;
  response?: StepResult<any>['response'];
  request?: LanguageModelRequestMetadata;
  usage?: LanguageModelV2Usage;
  content: StepResult<any>['content'];
}

export interface BufferedByStep {
  text: string;
  reasoning: string;
  sources: any[];
  files: any[];
  toolCalls: any[];
  toolResults: any[];
  msgCount: number;
}
