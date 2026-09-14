import type { TransformStream } from 'node:stream/web';
import type {
  LanguageModelV2FinishReason,
  LanguageModelV2Usage,
  LanguageModelV2CallWarning,
  LanguageModelV2Prompt,
  LanguageModelV2ResponseMetadata,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider-v5';

import type {
  FinishReason,
  LanguageModelRequestMetadata,
  LogProbs as LanguageModelV1LogProbs,
} from '@internal/ai-sdk-v4';
import type { CallSettings, ModelMessage, StepResult, ToolSet, TypedToolCall, UIMessage } from '@internal/ai-sdk-v5';
import type { AIV5ResponseMessage } from '../agent/message-list';
import type { AIV5Type, MastraDBMessage } from '../agent/message-list/types';
import type { StructuredOutputOptions } from '../agent/types';
import type { ModelConfigModelSettings } from '../llm/model/model-settings';
import type { MastraLanguageModel, SharedProviderOptions } from '../llm/model/shared.types';
import type { ScorerResult } from '../loop';
import type { ClientObservabilityCarrier, ObservabilityContext } from '../observability';
import type { OutputProcessorOrWorkflow } from '../processors';
import type { RequestContext } from '../request-context';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../workflows/types';
import type { OutputSchema } from './base/schema';

/** Identifies the participant or execution component associated with a chunk. */
export enum ChunkFrom {
  /** The chunk belongs to an agent execution. */
  AGENT = 'AGENT',
  /** The chunk is attributed to the user. */
  USER = 'USER',
  /** The chunk is attributed to the system. */
  SYSTEM = 'SYSTEM',
  /** The chunk belongs to a workflow execution. */
  WORKFLOW = 'WORKFLOW',
  /** The chunk belongs to an agent network execution. */
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
/** An object whose string-keyed properties contain JSON values. */
export type JSONObject = {
  /**
   * A JSON value stored under a property name.
   * @param key - Property name in the JSON object.
   */
  [key: string]: JSONValue;
};
/** An ordered collection of JSON values. */
export type JSONArray = JSONValue[];

/**
 * Additional provider-specific metadata.
 * The outer record is keyed by the provider name, and the inner
 * record is keyed by the provider-specific metadata key.
 */
export type ProviderMetadata = Record<string, Record<string, JSONValue>>;

export type StreamTransport = {
  type: 'openai-websocket';
  close: () => void;
  closeOnFinish: boolean;
};

export const MASTRA_MODEL_STREAM_TRANSPORT = Symbol.for('@mastra/core.modelStreamTransport');

export type StreamTransportCarrier = {
  [key: symbol]: StreamTransport | undefined;
};

export function attachModelStreamTransport(target: object, transport?: StreamTransport): void {
  if (!transport) return;
  Object.defineProperty(target, MASTRA_MODEL_STREAM_TRANSPORT, {
    configurable: true,
    value: transport,
  });
}

export function readModelStreamTransport(target: unknown): StreamTransport | undefined {
  return (target as StreamTransportCarrier | undefined)?.[MASTRA_MODEL_STREAM_TRANSPORT];
}

export type StreamTransportRef = {
  current?: StreamTransport;
};

/** Execution identifiers and metadata shared by stream chunks. */
interface BaseChunkType {
  /** Identifier of the run that produced the chunk. */
  runId: string;
  /** Participant or execution component associated with the chunk. */
  from: ChunkFrom;
  /** Additional metadata attached to the chunk. */
  metadata?: Record<string, any>;
}

/** Response metadata forwarded from the model provider. */
interface ResponseMetadataPayload {
  /** Provider-supplied signature, when present in the response metadata. */
  signature?: string;
  /**
   * Additional response metadata forwarded from the provider.
   * @param key - Provider-defined response metadata field name.
   */
  [key: string]: unknown;
}

/** Begins a text block whose subsequent chunks carry the same identifier. */
export interface TextStartPayload {
  /** Identifier of the text block. */
  id: string;
  /** Provider-specific metadata associated with the start of the block. */
  providerMetadata?: ProviderMetadata;
}

/** A fragment of text to append to a text block. */
export interface TextDeltaPayload {
  /** Identifier of the text block receiving this fragment. */
  id: string;
  /** Provider-specific metadata associated with this fragment. */
  providerMetadata?: ProviderMetadata;
  /** Incremental text, rather than the accumulated text of the block. */
  text: string;
}

/** Marks the end of a text block. */
interface TextEndPayload {
  /** Identifier of the completed text block. */
  id: string;
  /** Provider-specific metadata associated with the end of the block. */
  providerMetadata?: ProviderMetadata;
  /**
   * Additional fields associated with the completed text block.
   * @param key - Additional text-end field name.
   */
  [key: string]: unknown;
}

/** Begins a reasoning block emitted by the model. */
export interface ReasoningStartPayload {
  /** Identifier shared by the chunks in this reasoning block. */
  id: string;
  /** Provider-specific metadata associated with the start of the block. */
  providerMetadata?: ProviderMetadata;
  /** Provider-supplied signature for the reasoning block, when available. */
  signature?: string;
}

/** A fragment of model reasoning to append to a reasoning block. */
export interface ReasoningDeltaPayload {
  /** Identifier of the reasoning block receiving this fragment. */
  id: string;
  /** Provider-specific metadata associated with this fragment. */
  providerMetadata?: ProviderMetadata;
  /** Incremental reasoning text, rather than the accumulated block. */
  text: string;
}

/** Marks the end of a reasoning block. */
interface ReasoningEndPayload {
  /** Identifier of the completed reasoning block. */
  id: string;
  /** Provider-specific metadata associated with the end of the block. */
  providerMetadata?: ProviderMetadata;
  /** Provider-supplied signature for the completed reasoning block, when available. */
  signature?: string;
}

/** A URL or document cited as a source by the model. */
export interface SourcePayload {
  /** Identifier of the cited source. */
  id: string;
  /** Whether the citation refers to a URL or a document. */
  sourceType: 'url' | 'document';
  /** Display title of the cited source. */
  title: string;
  /** Media type of a document source, when provided. */
  mimeType?: string;
  /** Filename of a document source, when provided. */
  filename?: string;
  /** Address of a URL source, when provided. */
  url?: string;
  /** Provider-specific metadata associated with the citation. */
  providerMetadata?: ProviderMetadata;
}

/** File content generated by the model. */
export interface FilePayload {
  /** File data as bytes, a base64-encoded string, or a URL for a remotely hosted file. */
  data: string | Uint8Array;
  /** Base64-encoded representation of the file, when available. */
  base64?: string;
  /** Media type of the generated file. */
  mimeType: string;
  /** Name of the generated file, when provided. */
  filename?: string;
  /** Provider-specific metadata associated with the file. */
  providerMetadata?: ProviderMetadata;
}

/** File content emitted as part of the model's reasoning. */
export interface ReasoningFilePayload {
  /** Reasoning file data as bytes, a base64-encoded string, or a URL for a remotely hosted file. */
  data: string | Uint8Array;
  /** Base64-encoded representation of the reasoning file, when available. */
  base64?: string;
  /** Media type of the reasoning file. */
  mimeType: string;
  /** Provider-specific metadata associated with the reasoning file. */
  providerMetadata?: ProviderMetadata;
}

/** Provider-defined content identified by a namespaced kind. */
export interface CustomPayload {
  /** The kind of custom content, in the format `{provider}.{provider-type}`. */
  kind: string;
  /** Provider-specific metadata associated with the custom content. */
  providerMetadata?: ProviderMetadata;
}

/** A JSON value whose nested object properties and array elements are readonly. */
export type ReadonlyJSONValue = null | string | number | boolean | ReadonlyJSONObject | ReadonlyJSONArray;

/** A string-keyed JSON object whose properties cannot be reassigned through this type. */
export type ReadonlyJSONObject = {
  /**
   * A readonly JSON value stored under a property name.
   * @param key - Property name in the readonly JSON object.
   */
  readonly [key: string]: ReadonlyJSONValue;
};

/** An ordered collection of readonly JSON values. */
export type ReadonlyJSONArray = readonly ReadonlyJSONValue[];

/** Text or tool activity that can be carried in Mastra metadata. */
export interface MastraMetadataMessage {
  /** Whether the metadata message represents text or tool activity. */
  type: 'text' | 'tool';
  /** Text content recorded for the message. */
  content?: string;
  /** Name of the tool associated with the message. */
  toolName?: string;
  /** Tool input recorded as JSON-compatible data. */
  toolInput?: ReadonlyJSONValue;
  /** Tool output recorded as JSON-compatible data. */
  toolOutput?: ReadonlyJSONValue;
  /** Arguments associated with the tool invocation. */
  args?: ReadonlyJSONValue;
  /** Identifier of the associated tool invocation. */
  toolCallId?: string;
  /** Result associated with the tool invocation. */
  result?: ReadonlyJSONValue;
}

/** Optional execution context, tool activity and workflow state carried as metadata. */
export interface MastraMetadata {
  /** Whether the associated operation is marked as streaming. */
  isStreaming?: boolean;
  /** Component or actor identified as the origin of the metadata. */
  from?: 'AGENT' | 'WORKFLOW' | 'USER' | 'SYSTEM';
  /** Network-specific metadata represented as a JSON object. */
  networkMetadata?: ReadonlyJSONObject;
  /** Tool output or outputs represented as JSON-compatible data. */
  toolOutput?: ReadonlyJSONValue | ReadonlyJSONValue[];
  /** Text and tool activity messages included in the metadata. */
  messages?: MastraMetadataMessage[];
  /** Workflow state represented as a JSON object. */
  workflowFullState?: ReadonlyJSONObject;
  /** Explanation of the associated routing selection. */
  selectionReason?: string;
}

/** A tool invocation with parsed arguments and execution metadata. */
export interface ToolCallPayload<TArgs = unknown, TOutput = unknown> {
  /** Identifier used to match this call with its result and input-stream chunks. */
  toolCallId: string;
  /** Name of the tool being invoked. */
  toolName: string;
  /** Parsed tool arguments, when available, with optional Mastra execution metadata. */
  args?: TArgs & {
    /** Additional execution context carried alongside the tool arguments. */
    __mastraMetadata?: MastraMetadata;
  };
  /** Whether the model provider executes the tool rather than application code. */
  providerExecuted?: boolean;
  /** Provider-specific metadata associated with this invocation. */
  providerMetadata?: ProviderMetadata;
  /** Tool output carried with the invocation, when supplied. */
  output?: TOutput;
  /** Whether the invocation is marked as a dynamic tool call. */
  dynamic?: boolean;
  /**
   * W3C trace context carrier for client-side tool execution.
   *
   * Populated by the server when emitting a tool call that will be
   * executed in the client (`providerExecuted: false` and the tool has
   * no server-side execute function). The client SDK extracts the
   * carrier, parents any child spans/logs underneath it, and echoes it
   * back in the next request body for cross-request trace correlation.
   */
  observability?: ClientObservabilityCarrier;
}

/** The result of a tool invocation, correlated with the original call. */
export interface ToolResultPayload<TResult = unknown, TArgs = unknown> {
  /** Identifier of the tool call that produced this result. */
  toolCallId: string;
  /** Name of the tool that produced the result. */
  toolName: string;
  /** Value returned by the tool or supplied as its error result. */
  result: TResult;
  /** Whether the result represents a tool error rather than successful output. */
  isError?: boolean;
  /** Whether the model provider executed the tool rather than application code. */
  providerExecuted?: boolean;
  /** Provider-specific metadata associated with the result. */
  providerMetadata?: ProviderMetadata;
  /** Arguments of the corresponding tool invocation, when included. */
  args?: TArgs;
  /** Whether the result is marked as belonging to a dynamic tool. */
  dynamic?: boolean;
}

export type DynamicToolCallPayload = ToolCallPayload<any, any>;
export type DynamicToolResultPayload = ToolResultPayload<any, any>;

/** Begins the incremental delivery of arguments for a tool call. */
interface ToolCallInputStreamingStartPayload {
  /** Identifier shared by the input fragments and completed tool call. */
  toolCallId: string;
  /** Name of the tool whose arguments are being streamed. */
  toolName: string;
  /** Whether the model provider executes this tool rather than application code. */
  providerExecuted?: boolean;
  /** Provider-specific metadata associated with the start of argument streaming. */
  providerMetadata?: ProviderMetadata;
  /** Whether the tool is marked as dynamic. */
  dynamic?: boolean;
  /** Trace context carried to client-side tool execution, when provided. */
  observability?: ClientObservabilityCarrier;
}

/** A fragment of serialized tool arguments, not a complete parsed argument object. */
interface ToolCallDeltaPayload {
  /** Incremental argument text to append to earlier fragments for this call. */
  argsTextDelta: string;
  /** Identifier of the tool call receiving this argument fragment. */
  toolCallId: string;
  /** Provider-specific metadata associated with this fragment. */
  providerMetadata?: ProviderMetadata;
  /** Name of the tool, when included with the fragment. */
  toolName?: string;
}

/** Marks the end of argument streaming for a tool call, not completion of its execution. */
interface ToolCallInputStreamingEndPayload {
  /** Identifier of the tool call whose argument stream has ended. */
  toolCallId: string;
  /** Provider-specific metadata associated with the end of argument streaming. */
  providerMetadata?: ProviderMetadata;
}

/** Completion information for an agent stream, including usage and message history. */
interface FinishPayload<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> {
  /** Finish reason and diagnostics from the final generation step. */
  stepResult: {
    /** Includes 'tripwire' and 'retry' for processor scenarios */
    reason: LanguageModelV2FinishReason | 'tripwire' | 'retry';
    /** Provider's own finish reason (e.g. 'MALFORMED_FUNCTION_CALL'), when the provider reports one */
    rawReason?: string;
    /** Warnings reported by the model provider. */
    warnings?: LanguageModelV2CallWarning[];
    /** Whether this step continues generation. */
    isContinued?: boolean;
    /** Token log probabilities, when supplied by the provider. */
    logprobs?: LanguageModelV1LogProbs;
  };
  /** Token usage and generation steps associated with completion. */
  output: {
    /** Token usage reported for the completed stream. */
    usage: LanguageModelUsage;
    /** Steps array - uses MastraStepResult which extends AI SDK StepResult with tripwire data */
    steps?: MastraStepResult<Tools>[];
  };
  /** Provider and request metadata collected during generation. */
  metadata: {
    /** Provider-specific metadata associated with completion. */
    providerMetadata?: ProviderMetadata;
    /** Metadata describing the model request. */
    request?: LanguageModelRequestMetadata;
    /**
     * Additional generation metadata.
     * @param key - Additional metadata field name.
     */
    [key: string]: unknown;
  };
  /** Provider-specific metadata attached directly to the finish payload. */
  providerMetadata?: ProviderMetadata;
  /** Message history grouped by role. */
  messages: {
    /** Complete model-message history available at completion. */
    all: ModelMessage[];
    /** User messages from the model-message history. */
    user: ModelMessage[];
    /** Assistant and tool response messages from the history. */
    nonUser: AIV5ResponseMessage[];
  };
  /** Response metadata and response messages, when available. */
  response?: LLMStepResult<OUTPUT>['response'];
  /**
   * Additional completion fields forwarded by the stream adapter.
   * @param key - Additional completion field name.
   */
  [key: string]: unknown;
}

/** An error reported by the stream. */
interface ErrorPayload {
  /** Reported error value, which is not necessarily an Error instance. */
  error: unknown;
  /**
   * Additional fields accompanying the error.
   * @param key - Additional error field name.
   */
  [key: string]: unknown;
}

/** Unnormalized provider data forwarded as a raw stream payload. */
interface RawPayload {
  /**
   * A field from the provider's raw chunk.
   * @param key - Provider-defined field name.
   */
  [key: string]: unknown;
}

/** Metadata attached to the start of a stream. */
interface StartPayload {
  /**
   * A field supplied with the stream-start event.
   * @param key - Stream-start metadata field name.
   */
  [key: string]: unknown;
}

/** Request information and diagnostics attached to the start of a model step. */
export interface StepStartPayload {
  /** Identifier of the message associated with this step, when supplied. */
  messageId?: string;
  /** Epoch milliseconds sampled immediately before the model provider call. Absent when no provider call occurred. */
  startedAt?: number;
  /** Metadata describing the request sent to the model provider. */
  request: {
    /** Serialized request body, when available. */
    body?: string;
    /**
     * Additional request metadata supplied by the adapter.
     * @param key - Additional request metadata field name.
     */
    [key: string]: unknown;
  };
  /** Messages in the provider-facing prompt for this step, when included. */
  inputMessages?: LanguageModelV2Prompt;
  /** Warnings reported for the model call. */
  warnings?: LanguageModelV2CallWarning[];
  /**
   * Additional fields associated with starting the step.
   * @param key - Additional step-start field name.
   */
  [key: string]: unknown;
}

/** Output, usage and metadata attached to completion of a model step. */
export interface StepFinishPayload<Tools extends ToolSet = ToolSet, OUTPUT = undefined> {
  /** Identifier attached to the completed step, when supplied. */
  id?: string;
  /** Provider-specific metadata attached directly to the step-finish payload. */
  providerMetadata?: ProviderMetadata;
  /** Accumulated token usage, when supplied separately from this step's usage. */
  totalUsage?: LanguageModelUsage;
  /** Model-provider response metadata for the step. */
  response?: LanguageModelV2ResponseMetadata;
  /** Identifier of the message associated with this step, when supplied. */
  messageId?: string;
  /** Finish reason and diagnostics for this step. */
  stepResult: {
    /** Token log probabilities, when supplied by the provider. */
    logprobs?: LanguageModelV1LogProbs;
    /** Whether this step continues generation. */
    isContinued?: boolean;
    /** Warnings reported by the model provider for this step. */
    warnings?: LanguageModelV2CallWarning[];
    /** Normalized reason the model stopped generating for this step. */
    reason: LanguageModelV2FinishReason;
    /** Provider's own finish reason (e.g. 'MALFORMED_FUNCTION_CALL'), when the provider reports one */
    rawReason?: string;
  };
  /** Generated content and usage associated with this step. */
  output: {
    /** Text generated in this step, when included. */
    text?: string;
    /** Tool calls requested during this step, when included. */
    toolCalls?: TypedToolCall<Tools>[];
    /** Token usage reported for this step. */
    usage: LanguageModelUsage;
    /** Steps array - uses MastraStepResult which extends AI SDK StepResult with tripwire data */
    steps?: MastraStepResult<Tools>[];
    /** Structured output associated with the step, when available. */
    object?: OUTPUT;
  };
  /** Request and provider metadata collected for this step. */
  metadata: {
    /** Metadata describing the model request. */
    request?: LanguageModelRequestMetadata;
    /** Provider-specific metadata associated with the step. */
    providerMetadata?: ProviderMetadata;
    /**
     * Additional step metadata.
     * @param key - Additional step metadata field name.
     */
    [key: string]: unknown;
  };
  /** Message history grouped by role, when included with the completed step. */
  messages?: {
    /** Complete model-message history available at the end of the step. */
    all: ModelMessage[];
    /** User messages from the model-message history. */
    user: ModelMessage[];
    /** Assistant and tool response messages from the history. */
    nonUser: AIV5ResponseMessage[];
  };
  /**
   * Additional fields accompanying step completion.
   * @param key - Additional step-finish field name.
   */
  [key: string]: unknown;
}

/** An error associated with a particular tool invocation. */
export interface ToolErrorPayload {
  /** Additional identifier attached to the error, when supplied. */
  id?: string;
  /** Provider-specific metadata associated with the tool error. */
  providerMetadata?: ProviderMetadata;
  /** Identifier of the tool call that failed. */
  toolCallId: string;
  /** Name of the tool that failed. */
  toolName: string;
  /** Arguments supplied to the failed invocation, when available. */
  args?: Record<string, unknown>;
  /** Error reported for this invocation, not necessarily an Error instance. */
  error: unknown;
  /** Whether the model provider executed the tool rather than application code. */
  providerExecuted?: boolean;
}

/** Terminal stream payload when a requireApproval tool call is declined. */
export interface ToolOutputDeniedPayload {
  /** Identifier of the tool call whose execution was declined. */
  toolCallId: string;
  /** Name of the tool whose execution was declined. */
  toolName: string;
  /** Arguments of the declined invocation, when available. */
  args?: Record<string, unknown>;
  /** Approval decision that prevented tool execution. */
  approval: {
    /** Identifier of the approval request being resolved. */
    id: string;
    /** Always false for a denied tool call. */
    approved: false;
    /** Explanation provided for declining the request, when available. */
    reason?: string;
  };
}

/** Additional information attached to a stream cancellation. */
interface AbortPayload {
  /**
   * A field supplied with the cancellation event.
   * @param key - Cancellation field name.
   */
  [key: string]: unknown;
}

/** A provider-supplied signature associated with a reasoning block. */
interface ReasoningSignaturePayload {
  /** Identifier of the reasoning block associated with the signature. */
  id: string;
  /** Signature supplied by the model provider. */
  signature: string;
  /** Provider-specific metadata accompanying the signature. */
  providerMetadata?: ProviderMetadata;
}

/** Opaque reasoning data that the provider does not expose as readable text. */
interface RedactedReasoningPayload {
  /** Identifier of the redacted reasoning block. */
  id: string;
  /** Provider-supplied redacted data, retained without interpreting its contents. */
  data: unknown;
  /** Provider-specific metadata associated with the redacted block. */
  providerMetadata?: ProviderMetadata;
}

/** An output chunk emitted by a tool, which may contain nested workflow chunks. */
interface ToolOutputPayload<TOutput = unknown> {
  /** Output value emitted by the tool. This need not be its final result. */
  output: TOutput; // Tool outputs can be any shape, including nested workflow chunks
  /** Identifier of the tool call that emitted this output. */
  toolCallId: string;
  /** Name of the emitting tool, when included. */
  toolName?: string;
  /**
   * Additional fields accompanying the tool output.
   * @param key - Additional tool-output field name.
   */
  [key: string]: unknown;
}

/** A tool output chunk whose output type is not statically constrained. */
type DynamicToolOutputPayload = ToolOutputPayload<any>;

/** Workflow output that can contain another stream or workflow-output chunk. */
type NestedWorkflowOutput = {
  /** Origin of the nested chunk. */
  from: ChunkFrom;
  /** Event kind represented by the nested output. */
  type: string;
  /** Nested output and associated usage metadata. */
  payload?: {
    /** Stream or workflow-output chunk carried by this event. */
    output?: ChunkType | NestedWorkflowOutput;
    /** Usage information supplied by the nested producer. */
    usage?: unknown;
    /**
     * Additional nested payload data.
     * @param key - Additional payload field name.
     */
    [key: string]: unknown;
  };
  /**
   * Additional metadata on the nested workflow output.
   * @param key - Additional output field name.
   */
  [key: string]: unknown;
};

/** Output chunk forwarded from a workflow step. */
interface StepOutputPayload {
  /** Stream chunk or nested workflow output emitted by the step. */
  output: ChunkType | NestedWorkflowOutput;
  /**
   * Additional metadata supplied with the step output.
   * @param key - Additional step-output field name.
   */
  [key: string]: unknown;
}

/** Data supplied by a workflow watcher. */
interface WatchPayload {
  /**
   * A field in the workflow watch update.
   * @param key - Watch-update field name.
   */
  [key: string]: unknown;
}

/** Processor rejection details, retry instructions and associated metadata. */
export interface TripwirePayload<TMetadata = unknown> {
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
export interface IsTaskCompletePayload {
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

/** Progress from a goal judge's tool or reasoning activity. */
export interface GoalEvaluationActivity {
  /** Whether the update reports a tool call, tool result or reasoning. */
  type: 'tool-call' | 'tool-result' | 'reason';
  /** Name associated with the reported tool activity, when available. */
  name?: string;
  /** Text describing the current judge activity. */
  message: string;
}

/**
 * Payload for `goal` events emitted by the in-loop goal scorer. Consumers (TUIs,
 * `@mastra/client-js`) use this to render judge progress and the result.
 */
export interface GoalEvaluationPayload {
  /** The objective being judged. */
  objective: string;
  /** Goal evaluations consumed so far (runsUsed after this evaluation). */
  iteration: number;
  /** Max evaluations before the goal stops. */
  maxRuns: number;
  /** Whether the goal is judged complete. */
  passed: boolean;
  /** The objective status after this evaluation. */
  status: 'active' | 'paused' | 'done';
  /** Individual scorer results. */
  results: ScorerResult[];
  /** Judge feedback / stop reason. Falls back to the pause reason when parked. */
  reason?: string;
  /**
   * Why the objective is parked (`status === 'paused'`). Set for judge failure
   * or budget exhaustion. Cleared when `status` is `'active'` or `'done'`.
   */
  pausedReason?: string;
  /**
   * True when the judge decided the goal is not finished but explicitly wants
   * the user to provide input before continuing. The record stays `active` (so
   * the next agent turn is still judged), but `isContinued` is `false` (the
   * auto-loop stops). Display layers use this to show a "waiting" indicator.
   */
  waitingForUser?: boolean;
  /** True when the scorer/judge itself errored (as opposed to scoring 0). */
  judgeFailed?: boolean;
  /** Total duration of the goal scoring check. */
  duration: number;
  /** Whether scoring timed out. */
  timedOut: boolean;
  /** Whether the run budget (`maxRuns`) was reached. */
  maxRunsReached: boolean;
  /** Whether the goal feedback message is suppressed from memory. */
  suppressFeedback: boolean;
  /**
   * The goal gate's continuation decision: `true` when the run loops into
   * another judged iteration, `false` on a terminal evaluation (completion,
   * waiting for user, judge failure, or budget exhaustion). Only set on final
   * (non-pending) evaluation chunks. A `true` value marks an iteration
   * boundary — the turn's messages are persisted and the stream may safely
   * truncate its run-lifetime buffers.
   */
  shouldContinue?: boolean;
  /**
   * True on the "pre-evaluation" chunk emitted before scoring starts. Display
   * layers use this to show a loading/evaluating indicator while the scorer
   * runs. A second chunk with `pending: false` (or absent) follows once the
   * evaluation is complete.
   */
  pending?: boolean;
  /** Judge activity emitted while the evaluation is still running. */
  activity?: GoalEvaluationActivity[];
}

/** Identifies a tool invocation dispatched as a background task. */
export interface BackgroundTaskStartedPayload {
  /** Identifier assigned to the background task. */
  taskId: string;
  /** Name of the tool dispatched in the background. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
}

/** Result and completion metadata for a background task. */
export interface BackgroundTaskResultPayload {
  /** Identifier of the completed background task. */
  taskId: string;
  /** Name of the tool that produced the result. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Value returned by the background task. */
  result: unknown;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Time the task reached its terminal state. */
  completedAt: Date;
  /** Whether the result is flagged as an error, when supplied by the producer. */
  isError?: boolean;
}

/** Failure details and terminal timing for a background task. */
export interface BackgroundTaskFailedPayload {
  /** Identifier of the failed background task. */
  taskId: string;
  /** Name of the tool that failed. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Serialized failure information. */
  error: {
    /** Human-readable failure message. */
    message: string;
  };
  /** Time the task reached its terminal state. */
  completedAt: Date;
}

/** Progress reported while an agent waits for background tasks. */
export interface BackgroundTaskProgressPayload {
  /** Identifiers of the tasks being awaited. */
  taskIds: string[];
  /** Number of running tasks captured when the wait began. */
  runningCount: number;
  /** Milliseconds elapsed in this wait, not total task execution time. */
  elapsedMs: number;
}

/** Running-task snapshot with invocation arguments and execution timing. */
export interface BackgroundTaskRunningPayload {
  /** Identifier of the running background task. */
  taskId: string;
  /** Name of the tool executing in the background. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Time the current task execution entered the running state. */
  startedAt: Date;
  /** Arguments supplied to the background tool invocation. */
  args: Record<string, unknown>;
}

/** Identity and terminal timing of a cancelled background task. */
export interface BackgroundTaskCancelledPayload {
  /** Identifier of the cancelled background task. */
  taskId: string;
  /** Name of the tool whose background execution was cancelled. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Time the task reached the cancelled state. */
  completedAt: Date;
}

/** A tool-output chunk forwarded from a background task. */
export interface BackgroundTaskOutputPayload {
  /** Identifier of the background task emitting output. */
  taskId: string;
  /** Name of the tool emitting output. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Complete nested tool-output chunk, not necessarily the tool's final result. */
  payload: Extract<
    AgentChunkType,
    {
      /** Selects tool-output chunks from the agent chunk union. */
      type: 'tool-output';
    }
  >;
}

/** Invocation context and suspension data for a paused background task. */
export interface BackgroundTaskSuspendedPayload {
  /** Identifier of the suspended background task. */
  taskId: string;
  /** Name of the suspended tool. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Arguments supplied to the suspended tool invocation. */
  args: Record<string, unknown>;
  /** Whatever the tool passed to `suspend(data)`. */
  suspendPayload?: unknown;
  /** When the task suspended. */
  suspendedAt?: Date;
}

/** Invocation context when a suspended background task resumes running. */
export interface BackgroundTaskResumedPayload {
  /** Identifier of the resumed background task. */
  taskId: string;
  /** Name of the resumed tool. */
  toolName: string;
  /** Identifier of the originating tool invocation. */
  toolCallId: string;
  /** Identifier of the agent run associated with the task. */
  runId: string;
  /** Identifier of the agent associated with the task. */
  agentId: string;
  /** Time the resumed execution entered the running state. */
  startedAt: Date;
  /** Arguments supplied to the resumed tool invocation. */
  args: Record<string, unknown>;
}

/** Routing input and identity for a network's next primitive selection. */
interface RoutingAgentStartPayload {
  /** Identifier of the agent making the routing decision. */
  agentId: string;
  /** Identifier of the agent that owns the network. */
  networkId: string;
  /** Identifier generated for this routing step. */
  runId: string;
  /** Task and previous execution context supplied to the routing agent. */
  inputData: {
    /** Task the network is trying to complete. */
    task: string;
    /** Primitive identifier carried into this routing decision. */
    primitiveId: string;
    /** Primitive category carried into this routing decision. */
    primitiveType: string;
    /** Result from the preceding execution, when available. */
    result?: string;
    /** Zero-based routing iteration. */
    iteration: number;
    /** Memory thread associated with the network execution. */
    threadId?: string;
    /** Resource associated with the memory thread. */
    threadResourceId?: string;
    /** Whether routing is instructed to select one primitive for the whole task. */
    isOneOff: boolean;
    /** Whether the routing explanation should also discuss primitives not selected. */
    verboseIntrospection: boolean;
  };
}

/** Primitive selection and token usage returned by the routing agent. */
interface RoutingAgentEndPayload {
  /** Task the network is trying to complete. */
  task: string;
  /** Selected primitive identifier, or none when no primitive is selected. */
  primitiveId: string;
  /** Selected primitive category, or none when no primitive is selected. */
  primitiveType: string;
  /** Instructions prepared for the selected primitive. */
  prompt: string;
  /** Selection explanation when routing is complete, otherwise an empty string. */
  result: string;
  /** Whether the routing agent selected none for both primitive identifier and category. */
  isComplete?: boolean;
  /** Explanation of the routing decision. */
  selectionReason: string;
  /** Zero-based routing iteration. */
  iteration: number;
  /** Identifier of the routing step. */
  runId: string;
  /** Token usage reported by the routing agent. */
  usage: LanguageModelUsage;
}

/** Incremental text emitted by the routing agent. */
interface RoutingAgentTextDeltaPayload {
  /** Text added by this chunk. */
  text: string;
}

/** Identity attached to the beginning of routing-agent text. */
interface RoutingAgentTextStartPayload {
  /** Run identifier associated with the text stream. */
  runId: string;
}

/** Routing context supplied when a network starts a selected agent. */
interface AgentExecutionStartPayload {
  /** Identifier of the selected agent. */
  agentId: string;
  /** Routing decision and task context supplied to the execution step. */
  args: {
    /** Task the network is trying to complete. */
    task: string;
    /** Identifier selected by the routing agent. */
    primitiveId: string;
    /** Category selected by the routing agent. */
    primitiveType: string;
    /** Instructions prepared for the selected agent. */
    prompt: string;
    /** Result carried forward from the routing decision. */
    result: string;
    /** Completion state carried forward from the routing decision. */
    isComplete?: boolean;
    /** Explanation for selecting this agent. */
    selectionReason: string;
    /** Network iteration in which the agent was selected. */
    iteration: number;
  };
  /** Identifier generated for this agent execution step. */
  runId: string;
}

/** Tool approval requested while a network-selected agent is running. */
interface AgentExecutionApprovalPayload extends ToolCallApprovalPayload {
  /** Identifier of the selected agent. */
  agentId: string;
  /** Token usage reported by the agent. */
  usage: LanguageModelUsage;
  /** Identifier of the agent execution step. */
  runId: string;
  /** Explanation for selecting this agent. */
  selectionReason: string;
}

/** Suspension information from a network-selected agent. */
interface AgentExecutionSuspendedPayload extends ToolCallSuspendedPayload {
  /** Identifier of the selected agent. */
  agentId: string;
  /** Data supplied when execution suspended. */
  suspendPayload: any;
  /** Token usage reported by the agent. */
  usage: LanguageModelUsage;
  /** Identifier of the agent execution step. */
  runId: string;
  /** Explanation for selecting this agent. */
  selectionReason: string;
}

/** Text and usage collected when a network-selected agent finishes. */
interface AgentExecutionEndPayload {
  /** Task the network is trying to complete. */
  task: string;
  /** Identifier of the selected agent. */
  agentId: string;
  /** Text collected from the agent execution. */
  result: string;
  /** Network completion flag, emitted as false here pending completion validation. */
  isComplete: boolean;
  /** Network iteration in which the agent ran. */
  iteration: number;
  /** Token usage reported by the agent. */
  usage: LanguageModelUsage;
  /** Identifier of the agent execution step. */
  runId: string;
}

/** Routing context supplied when a network starts a selected workflow. */
interface WorkflowExecutionStartPayload {
  /** Workflow name declared for this event. */
  name: string;
  /** Identifier of the selected workflow. */
  workflowId: string;
  /** Routing decision and task context supplied to the execution step. */
  args: {
    /** Task the network is trying to complete. */
    task: string;
    /** Identifier selected by the routing agent. */
    primitiveId: string;
    /** Category selected by the routing agent. */
    primitiveType: string;
    /** Instructions prepared for the selected workflow. */
    prompt: string;
    /** Result carried forward from the routing decision. */
    result: string;
    /** Completion state carried forward from the routing decision. */
    isComplete?: boolean;
    /** Explanation for selecting this workflow. */
    selectionReason: string;
    /** Network iteration in which the workflow was selected. */
    iteration: number;
  };
  /** Identifier generated for this workflow execution step. */
  runId: string;
}

/** Result and usage reported when a network-selected workflow finishes. */
interface WorkflowExecutionEndPayload {
  /** Name of the selected workflow. */
  name: string;
  /** Workflow identifier declared for this event. */
  workflowId: string;
  /** Task the network is trying to complete. */
  task: string;
  /** Identifier selected by the routing agent. */
  primitiveId: string;
  /** Category selected by the routing agent. */
  primitiveType: string;
  /** Workflow result carried by the completion event. */
  result: string;
  /** Network completion flag, emitted as false here pending completion validation. */
  isComplete: boolean;
  /** Network iteration in which the workflow ran. */
  iteration: number;
  /** Token usage reported by the workflow stream. */
  usage: LanguageModelUsage;
  /** Identifier of the workflow execution step. */
  runId: string;
}

/** Suspension information from a network-selected workflow. */
interface WorkflowExecutionSuspendPayload extends ToolCallSuspendedPayload {
  /** Name of the selected workflow. */
  name: string;
  /** Identifier of the selected workflow. */
  workflowId: string;
  /** Data supplied when the workflow suspended. */
  suspendPayload: any;
  /** Token usage reported by the workflow stream. */
  usage: LanguageModelUsage;
  /** Identifier of the workflow execution step. */
  runId: string;
  /** Explanation for selecting this workflow. */
  selectionReason: string;
}

/** Tool arguments and routing context for a network-selected tool. */
interface ToolExecutionStartPayload {
  /** Execution context containing the actual tool arguments in its args field. */
  args: Record<string, unknown> & {
    /** Name of the selected tool. */
    toolName?: string;
    /** Identifier of the tool invocation. */
    toolCallId?: string;
    /** Arguments passed to the tool. */
    args?: Record<string, unknown>;
    /** Explanation for selecting this tool. */
    selectionReason?: string;
    /** Mastra metadata associated with the tool invocation. */
    __mastraMetadata?: MastraMetadata;
    /**
     * Additional fields carried forward from the routing input.
     * @param key - Routing-input field name.
     */
    [key: string]: unknown;
  };
  /** Run identifier associated with the tool execution. */
  runId: string;
}

/** Approval requested before a network-selected tool can execute. */
interface ToolExecutionApprovalPayload extends ToolCallApprovalPayload {
  /** Explanation for selecting this tool. */
  selectionReason: string;
  /** Run identifier associated with the approval request. */
  runId: string;
}

/** Suspension information from a network-selected tool. */
interface ToolExecutionSuspendedPayload extends ToolCallSuspendedPayload {
  /** Explanation for selecting this tool. */
  selectionReason: string;
  /** Run identifier associated with the suspended execution. */
  runId: string;
}

/** Result of a tool invocation selected by the network. */
interface ToolExecutionEndPayload {
  /** Task the network is trying to complete. */
  task: string;
  /** Identifier selected by the routing agent. */
  primitiveId: string;
  /** Category selected by the routing agent. */
  primitiveType: string;
  /** Tool result or approval-rejection result carried by the event. */
  result: unknown;
  /** Network completion flag, emitted as false here pending completion validation. */
  isComplete: boolean;
  /** Network iteration in which the tool ran. */
  iteration: number;
  /** Identifier of the tool invocation. */
  toolCallId: string;
  /** Name of the selected tool. */
  toolName: string;
}

/** Task progress reported at the end of a network iteration. */
interface NetworkStepFinishPayload {
  /** Task the network is trying to complete. */
  task: string;
  /** Result carried by the completed iteration. */
  result: string;
  /** Whether the task is considered complete at this point. */
  isComplete: boolean;
  /** Network iteration associated with this update. */
  iteration: number;
  /** Run identifier associated with this update. */
  runId: string;
}

/** Final task result, routing context and usage reported by the network. */
interface NetworkFinishPayload<OUTPUT = undefined> {
  /** Task supplied to the network. */
  task: string;
  /** Primitive identifier carried by the final routing state. */
  primitiveId: string;
  /** Primitive category carried by the final routing state. */
  primitiveType: string;
  /** Instructions carried by the final routing state. */
  prompt: string;
  /** Final textual result reported by the network. */
  result: string;
  /** Structured output object when structuredOutput option is provided */
  object?: OUTPUT;
  /** Whether the task met its completion criteria. */
  isComplete?: boolean;
  /** Explanation of the completion decision. */
  completionReason: string;
  /** Final network iteration. */
  iteration: number;
  /** Memory thread associated with the network execution. */
  threadId?: string;
  /** Resource associated with the memory thread. */
  threadResourceId?: string;
  /** Whether routing was configured to select one primitive for the whole task. */
  isOneOff: boolean;
  /** Token usage reported by the network. */
  usage: LanguageModelUsage;
}

/** Beginning of the network's completion checks for an iteration. */
interface NetworkValidationStartPayload {
  /** Run identifier attached to this validation event. */
  runId: string;
  /** Network iteration being evaluated. */
  iteration: number;
  /** Number of configured scorers, or one for the default completion check. */
  checksCount: number;
}

/** Completion-check results used to decide whether the network should continue. */
interface NetworkValidationEndPayload {
  /** Run identifier attached to this validation event. */
  runId: string;
  /** Network iteration evaluated by the checks. */
  iteration: number;
  /** Whether the completion checks consider the task complete. */
  passed: boolean;
  /** Individual scorer results. */
  results: ScorerResult[];
  /** Total elapsed time for the completion checks in milliseconds. */
  duration: number;
  /** Whether the completion checks timed out. */
  timedOut: boolean;
  /** Explanation supplied by the completion checks. */
  reason?: string;
  /** Whether the configured iteration limit has been reached. */
  maxIterationReached: boolean;
  /** Whether completion feedback is marked for suppression. */
  suppressFeedback: boolean;
}

/** Routing primitive associated with an abort event. */
interface RoutingAgentAbortPayload {
  /** Identifies routing as the aborted primitive category. */
  primitiveType: 'routing';
  /** Identifier of the routing primitive. */
  primitiveId: string;
}

/** Selected agent associated with an abort event. */
interface AgentExecutionAbortPayload {
  /** Identifies an agent as the aborted primitive category. */
  primitiveType: 'agent';
  /** Identifier of the selected agent. */
  primitiveId: string;
}

/** Selected workflow associated with an abort event. */
interface WorkflowExecutionAbortPayload {
  /** Identifies a workflow as the aborted primitive category. */
  primitiveType: 'workflow';
  /** Identifier of the selected workflow. */
  primitiveId: string;
}

/** Selected tool associated with an abort event. */
interface ToolExecutionAbortPayload {
  /** Identifies a tool as the aborted primitive category. */
  primitiveType: 'tool';
  /** Identifier of the selected tool. */
  primitiveId: string;
}

/** Invocation details and the approval response schema for a tool awaiting permission. */
interface ToolCallApprovalPayload {
  /** Identifier of the tool invocation awaiting approval. */
  toolCallId: string;
  /** Name of the tool awaiting approval. */
  toolName: string;
  /** Arguments proposed for the tool invocation. */
  args: Record<string, any>;
  /** JSON-serialized schema for the approval response. */
  resumeSchema: string;
}

/** Invocation details and resume information emitted when a tool suspends. */
interface ToolCallSuspendedPayload {
  /** Identifier of the suspended tool invocation. */
  toolCallId: string;
  /** Name of the suspended tool. */
  toolName: string;
  /** Data supplied when the tool suspended. */
  suspendPayload: any;
  /** Arguments supplied to the suspended tool invocation. */
  args: Record<string, any>;
  /** JSON-serialized schema for resume data, or an empty string when none is supplied. */
  resumeSchema: string;
}

/** Application-defined data part identified by a data- prefixed type. */
export type DataChunkType = {
  /** Custom data-part category, prefixed with data-. */
  type: `data-${string}`;
  /** Application-defined data carried by this part. */
  data: any;
  /** Optional identifier for the data part. */
  id?: string;
  /** When true, the chunk is streamed to the client but not persisted to storage. */
  transient?: boolean;
};

/**
 * Network routing, execution and validation events, including forwarded child chunks.
 * @typeParam OUTPUT - Structured output type carried by network object and finish events.
 */
export type NetworkChunkType<OUTPUT = undefined> =
  | (BaseChunkType & {
      /** Identifies the start of a routing decision. */
      type: 'routing-agent-start';
      /** Routing identity, task and previous execution context. */
      payload: RoutingAgentStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies incremental routing-agent text. */
      type: 'routing-agent-text-delta';
      /** Text added by the routing agent. */
      payload: RoutingAgentTextDeltaPayload;
    })
  | (BaseChunkType & {
      /** Identifies the beginning of routing-agent text. */
      type: 'routing-agent-text-start';
      /** Identity associated with the text stream. */
      payload: RoutingAgentTextStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of a routing decision. */
      type: 'routing-agent-end';
      /** Selected primitive, routing explanation and usage. */
      payload: RoutingAgentEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies an aborted routing step. */
      type: 'routing-agent-abort';
      /** Routing primitive associated with the abort. */
      payload: RoutingAgentAbortPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of a selected agent's execution. */
      type: 'agent-execution-start';
      /** Agent identity and routing context. */
      payload: AgentExecutionStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies an approval request from a selected agent. */
      type: 'agent-execution-approval';
      /** Agent identity, tool invocation and approval schema. */
      payload: AgentExecutionApprovalPayload;
    })
  | (BaseChunkType & {
      /** Identifies suspension of a selected agent. */
      type: 'agent-execution-suspended';
      /** Agent identity and suspension information. */
      payload: AgentExecutionSuspendedPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of a selected agent's execution. */
      type: 'agent-execution-end';
      /** Agent result, usage and iteration context. */
      payload: AgentExecutionEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies an aborted agent execution. */
      type: 'agent-execution-abort';
      /** Selected agent associated with the abort. */
      payload: AgentExecutionAbortPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of a selected workflow's execution. */
      type: 'workflow-execution-start';
      /** Workflow identity and routing context. */
      payload: WorkflowExecutionStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of a selected workflow's execution. */
      type: 'workflow-execution-end';
      /** Workflow result, usage and iteration context. */
      payload: WorkflowExecutionEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies suspension of a selected workflow. */
      type: 'workflow-execution-suspended';
      /** Workflow identity and suspension information. */
      payload: WorkflowExecutionSuspendPayload;
    })
  | (BaseChunkType & {
      /** Identifies an aborted workflow execution. */
      type: 'workflow-execution-abort';
      /** Selected workflow associated with the abort. */
      payload: WorkflowExecutionAbortPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of a selected tool's execution. */
      type: 'tool-execution-start';
      /** Tool arguments, invocation identity and routing context. */
      payload: ToolExecutionStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of a selected tool's execution. */
      type: 'tool-execution-end';
      /** Tool result and iteration context. */
      payload: ToolExecutionEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies an approval request for a selected tool. */
      type: 'tool-execution-approval';
      /** Tool invocation, approval schema and routing context. */
      payload: ToolExecutionApprovalPayload;
    })
  | (BaseChunkType & {
      /** Identifies suspension of a selected tool. */
      type: 'tool-execution-suspended';
      /** Tool invocation and suspension information. */
      payload: ToolExecutionSuspendedPayload;
    })
  | (BaseChunkType & {
      /** Identifies an aborted tool execution. */
      type: 'tool-execution-abort';
      /** Selected tool associated with the abort. */
      payload: ToolExecutionAbortPayload;
    })
  | (BaseChunkType & {
      /** Identifies completion of a network iteration. */
      type: 'network-execution-event-step-finish';
      /** Iteration result and task completion state. */
      payload: NetworkStepFinishPayload;
    })
  | (BaseChunkType & {
      /** Identifies completion of network execution. */
      type: 'network-execution-event-finish';
      /** Final result, routing state and usage. */
      payload: NetworkFinishPayload<OUTPUT>;
    })
  | (BaseChunkType & {
      /** Identifies the start of network completion checks. */
      type: 'network-validation-start';
      /** Validation run, iteration and check count. */
      payload: NetworkValidationStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of network completion checks. */
      type: 'network-validation-end';
      /** Scorer results, timing and completion decision. */
      payload: NetworkValidationEndPayload;
    })
  | (BaseChunkType & {
      /** Prefixes an event forwarded from a selected agent. */
      type: `agent-execution-event-${string}`;
      /** Original agent stream chunk. */
      payload: AgentChunkType;
    })
  | (BaseChunkType & {
      /** Prefixes an event forwarded from a selected workflow. */
      type: `workflow-execution-event-${string}`;
      /** Original workflow stream event. */
      payload: WorkflowStreamEvent;
    })
  | (BaseChunkType & {
      /** Identifies a partial network structured-output update. */
      type: 'network-object';
      /** Structured output accumulated so far. */
      payload: {
        /** Partial structured output produced by the network. */
        object: Partial<OUTPUT>;
      };
    })
  | (BaseChunkType & {
      /** Identifies the final network structured-output result. */
      type: 'network-object-result';
      /** Completed structured output. */
      payload: {
        /** Structured output produced by the network. */
        object: OUTPUT;
      };
    });

/**
 * Discriminated union of agent stream chunks, including internal processing events.
 * Structured object chunks use OUTPUT. Tool calls and results carry dynamic data.
 * @typeParam OUTPUT - Structured output type carried by object chunks and step results.
 */
export type AgentChunkType<OUTPUT = undefined> =
  | (BaseChunkType & /** Model response metadata. */ {
      /** Identifies a response-metadata chunk. */
      type: 'response-metadata';
      /** Response identifier, timestamp and model metadata. */
      payload: ResponseMetadataPayload;
    })
  | (BaseChunkType & /** Start of a text block. */ {
      /** Identifies the start of a text block. */
      type: 'text-start';
      /** Identifier and provider metadata for the new block. */
      payload: TextStartPayload;
    })
  | (BaseChunkType & /** Incremental text within a block. */ {
      /** Identifies a text fragment. */
      type: 'text-delta';
      /** Text fragment and its block identifier. */
      payload: TextDeltaPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of a text block. */
      type: 'text-end';
      /** Identifier and metadata for the completed text block. */
      payload: TextEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of a reasoning block. */
      type: 'reasoning-start';
      /** Identifier and provider metadata for the reasoning block. */
      payload: ReasoningStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies an incremental reasoning fragment. */
      type: 'reasoning-delta';
      /** Reasoning text and its block identifier. */
      payload: ReasoningDeltaPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of a reasoning block. */
      type: 'reasoning-end';
      /** Identifier and provider metadata for the completed reasoning block. */
      payload: ReasoningEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies a provider-supplied reasoning signature. */
      type: 'reasoning-signature';
      /** Signature and the reasoning block it belongs to. */
      payload: ReasoningSignaturePayload;
    })
  | (BaseChunkType & {
      /** Identifies reasoning whose contents are not exposed as readable text. */
      type: 'redacted-reasoning';
      /** Opaque provider data and the associated reasoning block identifier. */
      payload: RedactedReasoningPayload;
    })
  | (BaseChunkType & {
      /** Identifies a source referenced by the model response. */
      type: 'source';
      /** Source identifier, location and descriptive metadata. */
      payload: SourcePayload;
    })
  | (BaseChunkType & {
      /** Identifies a generated file. */
      type: 'file';
      /** File data, media type and provider metadata. */
      payload: FilePayload;
    })
  | (BaseChunkType & {
      /** Identifies a file associated with model reasoning. */
      type: 'reasoning-file';
      /** Reasoning file data and media type. */
      payload: ReasoningFilePayload;
    })
  | (BaseChunkType & {
      /** Identifies application-defined stream data. */
      type: 'custom';
      /** Application-defined data carried by the chunk. */
      payload: CustomPayload;
    })
  | (BaseChunkType & {
      /** Identifies a tool invocation requested by the model. */
      type: 'tool-call';
      /** Tool identity, parsed arguments and execution metadata. */
      payload: ToolCallPayload;
    })
  | (BaseChunkType & {
      /** Identifies a tool invocation awaiting approval. */
      type: 'tool-call-approval';
      /** Tool invocation and the information needed to approve or decline it. */
      payload: ToolCallApprovalPayload;
    })
  | (BaseChunkType & {
      /** Identifies a suspended tool invocation. */
      type: 'tool-call-suspended';
      /** Tool invocation and its suspension data. */
      payload: ToolCallSuspendedPayload;
    })
  | (BaseChunkType & {
      /** Identifies a completed tool invocation's result. */
      type: 'tool-result';
      /** Tool result, invocation identity and execution metadata. */
      payload: ToolResultPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of streamed tool arguments. */
      type: 'tool-call-input-streaming-start';
      /** Identity of the tool invocation whose arguments are being streamed. */
      payload: ToolCallInputStreamingStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies a fragment of streamed tool arguments. */
      type: 'tool-call-delta';
      /** Argument text fragment and its tool invocation identity. */
      payload: ToolCallDeltaPayload;
    })
  | (BaseChunkType & {
      /** Identifies the end of streamed tool arguments. */
      type: 'tool-call-input-streaming-end';
      /** Identity of the tool invocation whose argument stream ended. */
      payload: ToolCallInputStreamingEndPayload;
    })
  | (BaseChunkType & {
      /** Identifies completion of model generation. */
      type: 'finish';
      /** Finish reason, generated output, usage and response metadata. */
      payload: FinishPayload;
    })
  | (BaseChunkType & {
      /** Identifies an error reported through the stream. */
      type: 'error';
      /** Reported error and any accompanying metadata. */
      payload: ErrorPayload;
    })
  | (BaseChunkType & {
      /** Identifies unprocessed provider stream data. */
      type: 'raw';
      /** Provider data retained without interpreting its shape. */
      payload: RawPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of model generation. */
      type: 'start';
      /** Metadata attached to stream startup. */
      payload: StartPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of a model step. */
      type: 'step-start';
      /** Step request, input messages and diagnostics. */
      payload: StepStartPayload;
    })
  | (BaseChunkType & {
      /** Identifies completion of a model step. */
      type: 'step-finish';
      /** Step output, finish reason, usage and metadata. */
      payload: StepFinishPayload<ToolSet, OUTPUT>;
    })
  | (BaseChunkType & {
      /** Identifies an error associated with a tool invocation. */
      type: 'tool-error';
      /** Failed invocation, arguments and reported error. */
      payload: ToolErrorPayload;
    })
  | (BaseChunkType & {
      /** Identifies a tool invocation whose approval was declined. */
      type: 'tool-output-denied';
      /** Declined invocation and its approval decision. */
      payload: ToolOutputDeniedPayload;
    })
  | (BaseChunkType & {
      /** Identifies stream cancellation. */
      type: 'abort';
      /** Information accompanying cancellation. */
      payload: AbortPayload;
    })
  | (BaseChunkType & {
      /** Identifies a partial structured-output update. */
      type: 'object';
      /** Structured output available so far. */
      object: Partial<OUTPUT>;
    })
  | (BaseChunkType & {
      /**
       * The object promise is resolved with the object from the object-result chunk
       */
      type: 'object-result';
      /** Completed structured output used to resolve the object promise. */
      object: OUTPUT;
    })
  | (BaseChunkType & {
      /** Identifies output emitted while a tool is running. */
      type: 'tool-output';
      /** Streamed output and its tool invocation identity, not necessarily a final result. */
      payload: DynamicToolOutputPayload;
    })
  | (BaseChunkType & {
      /** Identifies output forwarded from a workflow step. */
      type: 'step-output';
      /** Chunk emitted by the step, including nested workflow output. */
      payload: StepOutputPayload;
    })
  | (BaseChunkType & {
      /** Identifies a workflow watch update. */
      type: 'watch';
      /** Data supplied by the workflow watcher. */
      payload: WatchPayload;
    })
  | (BaseChunkType & {
      /** Identifies a processor tripwire. */
      type: 'tripwire';
      /** Tripwire reason, retry request and processor metadata. */
      payload: TripwirePayload;
    })
  | (BaseChunkType & {
      /** Identifies a task-completion scoring result. */
      type: 'is-task-complete';
      /** Scorer results and the completion decision for the current iteration. */
      payload: IsTaskCompletePayload;
    })
  | (BaseChunkType & {
      /** Identifies goal-evaluation progress or a goal decision. */
      type: 'goal';
      /** Objective status, scorer activity and continuation decision. */
      payload: GoalEvaluationPayload;
    })
  | (BaseChunkType & {
      /** Identifies the start of a background task. */
      type: 'background-task-started';
      /** Task identifier and the tool invocation that started it. */
      payload: BackgroundTaskStartedPayload;
    })
  | (BaseChunkType & {
      /** Identifies completion of a background task. */
      type: 'background-task-completed';
      /** Task result, invocation identity and completion timing. */
      payload: BackgroundTaskResultPayload;
    })
  | (BaseChunkType & {
      /** Identifies a failed background task. */
      type: 'background-task-failed';
      /** Failure details, task identity and completion timing. */
      payload: BackgroundTaskFailedPayload;
    })
  | (BaseChunkType & {
      /** Identifies an aggregate background-task progress update. */
      type: 'background-task-progress';
      /** Active task identifiers, running count and elapsed time. */
      payload: BackgroundTaskProgressPayload;
    })
  | (BaseChunkType & {
      /** Identifies a background task that is still running. */
      type: 'background-task-running';
      /** Task status, invocation arguments and start timing. */
      payload: BackgroundTaskRunningPayload;
    })
  | (BaseChunkType & {
      /** Identifies a cancelled background task. */
      type: 'background-task-cancelled';
      /** Cancelled task identity and execution timing. */
      payload: BackgroundTaskCancelledPayload;
    })
  | (BaseChunkType & {
      /** Identifies output streamed by a background task. */
      type: 'background-task-output';
      /** Background-task identity and the nested tool-output chunk. */
      payload: BackgroundTaskOutputPayload;
    })
  | (BaseChunkType & {
      /** Identifies a background task suspended for input. */
      type: 'background-task-suspended';
      /** Suspended task identity, invocation arguments and suspension data. */
      payload: BackgroundTaskSuspendedPayload;
    })
  | (BaseChunkType & {
      /** Identifies a resumed background task. */
      type: 'background-task-resumed';
      /** Task identity and resume timing. */
      payload: BackgroundTaskResumedPayload;
    });

/** Lifecycle, state and output events emitted by workflow execution. */
export type WorkflowStreamEvent =
  | (BaseChunkType & {
      /** Identifies the start of workflow execution. */
      type: 'workflow-start';
      /** Identity of the workflow being executed. */
      payload: {
        /** Identifier of the workflow definition. */
        workflowId: string;
      };
    })
  | (BaseChunkType & {
      /** Identifies the end of a workflow execution segment. */
      type: 'workflow-finish';
      /** Execution status, result and completion metadata. */
      payload: {
        /** Workflow status when this event was emitted, not necessarily success. */
        workflowStatus: WorkflowRunStatus;
        /** Final workflow output, when available. */
        finalWorkflowResult?: unknown;
        /** Usage information attached to the finish event. */
        output: {
          /** Token usage reported for workflow execution. */
          usage: {
            /** Number of input tokens reported. */
            inputTokens: number;
            /** Number of output tokens reported. */
            outputTokens: number;
            /** Total number of tokens reported. */
            totalTokens: number;
          };
        };
        /** Additional workflow completion metadata. */
        metadata: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      /** Identifies cancellation of workflow execution. */
      type: 'workflow-canceled';
      /** Cancellation payload with no declared fields. */
      payload: {};
    })
  | (BaseChunkType & {
      /** Identifies a paused workflow execution. */
      type: 'workflow-paused';
      /** Pause payload with no declared fields. */
      payload: {};
    })
  | (BaseChunkType & {
      /** Identifies the start of a workflow step. */
      type: 'workflow-step-start';
      /** Identifier attached to the step-start event. */
      id: string;
      /** Step identity and execution state. */
      payload: {
        /** Identifier of the workflow step. */
        id: string;
        /** Identifier of this particular step invocation. */
        stepCallId: string;
        /** Execution status associated with the step. */
        status: WorkflowStepStatus;
        /** Step output, if included in the event. */
        output?: Record<string, any>;
        /** Input data supplied to the step. */
        payload?: Record<string, any>;
        /** Data supplied when resuming the step. */
        resumePayload?: Record<string, any>;
        /** Data recorded when the step suspended. */
        suspendPayload?: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      /** Identifies a step-completion metadata event. */
      type: 'workflow-step-finish';
      /** Step identity and completion metadata. */
      payload: {
        /** Identifier of the workflow step. */
        id: string;
        /** Additional step completion metadata. */
        metadata: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      /** Identifies a suspended workflow step. */
      type: 'workflow-step-suspended';
      /** Step state and data needed to describe the suspension. */
      payload: {
        /** Identifier of the suspended workflow step. */
        id: string;
        /** Execution status associated with the step. */
        status: WorkflowStepStatus;
        /** Step output, if included in the event. */
        output?: Record<string, any>;
        /** Input data supplied to the step. */
        payload?: Record<string, any>;
        /** Data supplied when resuming the step. */
        resumePayload?: Record<string, any>;
        /** Data recorded when the step suspended. */
        suspendPayload?: Record<string, any>;
      };
    })
  | (BaseChunkType & {
      /** Identifies a workflow step waiting before execution continues. */
      type: 'workflow-step-waiting';
      /** Waiting step's identity, input and timing. */
      payload: {
        /** Identifier of the waiting workflow step. */
        id: string;
        /** Input data associated with the waiting step. */
        payload: Record<string, any>;
        /** Time the wait began, in milliseconds since the Unix epoch. */
        startedAt: number;
        /** Execution status associated with the waiting step. */
        status: WorkflowStepStatus;
      };
    })
  | (BaseChunkType & {
      /** Identifies data streamed by a workflow step. */
      type: 'workflow-step-output';
      /** Step output chunk, including nested workflow output. */
      payload: StepOutputPayload;
    })
  | (BaseChunkType & {
      /** Identifies progress through a workflow step's iterations. */
      type: 'workflow-step-progress';
      /** Iteration counts and the result of the latest completed iteration. */
      payload: {
        /** Identifier of the iterating workflow step. */
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
      /** Identifies an execution result for a workflow step. */
      type: 'workflow-step-result';
      /** Step identity, status, output and suspension information. */
      payload: {
        /** Identifier of the workflow step. */
        id: string;
        /** Identifier of this particular step invocation. */
        stepCallId: string;
        /** Execution status associated with the result. */
        status: WorkflowStepStatus;
        /** Output produced by the step, when available. */
        output?: Record<string, any>;
        /** Input data supplied to the step. */
        payload?: Record<string, any>;
        /** Data supplied when resuming the step. */
        resumePayload?: Record<string, any>;
        /** Data recorded when the step suspended. */
        suspendPayload?: Record<string, any>;
        /** Tripwire data when step failed due to processor rejection */
        tripwire?: StepTripwireData;
      };
    });

/** Agent, workflow, network and data chunks with typed structured output and dynamic tool data. */
export type TypedChunkType<OUTPUT = undefined> =
  | AgentChunkType<OUTPUT>
  | WorkflowStreamEvent
  | NetworkChunkType<OUTPUT>
  | (DataChunkType & {
      /** Excludes the stream-origin field from this data-part branch. */
      from: never;
      /** Excludes the stream run identifier from this data-part branch. */
      runId: never;
      /** Optional metadata associated with the data part. */
      metadata?: BaseChunkType['metadata'];
      /** Excludes payload because a data part carries its value in data. */
      payload: never;
    });

/** Default stream-chunk alias with typed structured output and dynamic tool data. */
export type ChunkType<OUTPUT = undefined> = TypedChunkType<OUTPUT>;
export type StreamChunkType<OUTPUT = undefined> = ChunkType<OUTPUT> | DataChunkType;

export interface LanguageModelV2StreamResult {
  stream: ReadableStream<LanguageModelV2StreamPart>;
  request: LLMStepResult['request'];
  response?: LLMStepResult['response'];
  rawResponse: LLMStepResult['response'] | Record<string, never>;
  warnings?: LLMStepResult['warnings'];
}

export type OnResult = (result: Omit<LanguageModelV2StreamResult, 'stream'>) => void | ChunkType | ChunkType[];
export type CreateStream = () => Promise<LanguageModelV2StreamResult>;

/** A source reference with stream origin and run metadata. */
export type SourceChunk = BaseChunkType & {
  /** Identifies a source-reference chunk. */
  type: 'source';
  /** Source location and descriptive metadata. */
  payload: SourcePayload;
};
/** A generated file with stream origin and run metadata. */
export type FileChunk = BaseChunkType & {
  /** Identifies a generated-file chunk. */
  type: 'file';
  /** Generated file data and media type. */
  payload: FilePayload;
};
export type ReasoningFileChunk = BaseChunkType & { type: 'reasoning-file'; payload: ReasoningFilePayload };
export type CustomChunk = BaseChunkType & { type: 'custom'; payload: CustomPayload };
/** A tool invocation with stream origin and run metadata. */
export type ToolCallChunk = BaseChunkType & {
  /** Identifies a tool-call chunk. */
  type: 'tool-call';
  /** Tool identity, arguments and execution metadata. */
  payload: ToolCallPayload;
};
/** A completed tool invocation's result with stream metadata. */
export type ToolResultChunk = BaseChunkType & {
  /** Identifies a tool-result chunk. */
  type: 'tool-result';
  /** Tool result and the associated invocation identity. */
  payload: ToolResultPayload;
};
export type ToolOutputDeniedChunk = BaseChunkType & { type: 'tool-output-denied'; payload: ToolOutputDeniedPayload };
/** A collected reasoning block associated with a model step. */
export type ReasoningChunk = BaseChunkType & {
  /** Identifies a collected reasoning block rather than a reasoning-delta event. */
  type: 'reasoning';
  /** Reasoning text, block identifier and provider metadata. */
  payload: ReasoningDeltaPayload;
};

/** Tool-call input retained while the invocation is still pending. */
export type PendingToolCall = {
  /** Identifier of the pending tool invocation. */
  toolCallId: string;
  /** Name of the tool being invoked. */
  toolName: string;
  /** Argument text accumulated for the invocation. */
  argsText: string;
  /** Whether arguments are still streaming or the complete input is available. */
  state: 'input-streaming' | 'input-available';
  /** Whether execution is handled by the model provider rather than application code. */
  providerExecuted?: boolean;
  /** Provider-specific metadata associated with the invocation. */
  providerMetadata?: ProviderMetadata;
  /** Whether the invocation is explicitly marked as dynamic. */
  dynamic?: boolean;
};

export type ExecuteStreamModelManager<T> = (
  callback: (modelConfig: ModelManagerModelConfig, isLastModel: boolean) => Promise<T>,
) => Promise<T>;

export type ModelManagerModelConfig = {
  model: MastraLanguageModel;
  maxRetries: number;
  maxRetriesConfigured?: boolean;
  id: string;
  headers?: Record<string, string>;
  modelSettings?: ModelConfigModelSettings;
  providerOptions?: SharedProviderOptions;
};

/**
 * Extended usage type that includes raw provider data.
 * Extends LanguageModelV2Usage with additional fields for V3 compatibility.
 */
export type LanguageModelUsage = LanguageModelV2Usage & {
  /** Tokens attributed to model reasoning, when reported. */
  reasoningTokens?: number;
  /** Input tokens read from the prompt cache, when reported. */
  cachedInputTokens?: number;
  /** Input tokens written to the prompt cache, when reported. */
  cacheCreationInputTokens?: number;
  /** Cache-creation input tokens attributed to five-minute caching, when reported. */
  cacheCreationInputTokens5m?: number;
  /** Cache-creation input tokens attributed to one-hour caching, when reported. */
  cacheCreationInputTokens1h?: number;
  /**
   * Raw usage data from the provider, preserved for advanced use cases.
   * For V3 models, contains the full nested structure:
   * { inputTokens: { total, noCache, cacheRead, cacheWrite }, outputTokens: { total, text, reasoning } }
   */
  raw?: unknown;
};

/** Model identity and adapter version included in execution callbacks when available. */
export type partialModel = {
  /** Identifier of the model used for execution. */
  modelId?: string;
  /** Provider identifier reported by the model adapter. */
  provider?: string;
  /** Model adapter specification version. */
  version?: string;
};

/**
 * Callback receiving a completed model step and optional execution identity.
 * @param event - Completed model step and available execution identity.
 */
export type MastraOnStepFinishCallback<OUTPUT = undefined> = (
  event: LLMStepResult<OUTPUT> & {
    /** Model identity associated with the step, when available. */
    model?: partialModel;
    /** Execution run identifier, when supplied. */
    runId?: string;
  },
) => Promise<void> | void;

/** Step-result fields and aggregate data supplied to the execution finish callback. */
export type MastraOnFinishCallbackArgs<OUTPUT = undefined> = LLMStepResult<OUTPUT> & {
  /** Execution error, when the callback reports one. */
  error?:
    | Error
    | string
    | {
        /** Error description. */
        message: string;
        /** Captured error stack. */
        stack: string;
      };
  /** Structured output available when execution finishes. */
  object?: OUTPUT;
  /** Model steps collected during execution. */
  steps: LLMStepResult<OUTPUT>[];
  /** Aggregated token usage across execution steps. */
  totalUsage: LanguageModelUsage;
  /** Model identity associated with execution, when available. */
  model?: partialModel;
  /** Execution run identifier, when supplied. */
  runId?: string;
};

/**
 * Callback receiving execution results, including results reported on suspension or cancellation.
 * @param event - Execution result and aggregate usage, including interrupted execution results.
 */
export type MastraOnFinishCallback<OUTPUT = undefined> = (
  event: MastraOnFinishCallbackArgs<OUTPUT>,
) => Promise<void> | void;

/**
 * Creates a fresh transform for a Mastra model output stream.
 *
 * @experimental This API may change in a future release.
 */
export type MastraStreamTransform<OUTPUT = undefined> = () => TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>;

/** @experimental This API may change in a future release. */
export type MastraStreamTransformOptions<OUTPUT = undefined> =
  | MastraStreamTransform<OUTPUT>
  | readonly MastraStreamTransform<OUTPUT>[];

export type MastraModelOutputOptions<OUTPUT = undefined> = {
  runId: string;
  toolCallStreaming?: boolean;
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  onStepFinish?: MastraOnStepFinishCallback<OUTPUT>;
  includeRawChunks?: boolean;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  outputProcessors?: OutputProcessorOrWorkflow[];
  isLLMExecutionStep?: boolean;
  /**
   * When true, force text/finishReason promise resolution at step-finish even
   * when `isLLMExecutionStep` is set.  Durable agents have a single
   * MastraModelOutput for the entire run that needs both per-chunk output
   * processor processing (isLLMExecutionStep) AND final promise resolution.
   */
  resolveFinalPromises?: boolean;
  /**
   * When true, `error` chunks and `finish` chunks with stepResult.reason
   * 'error' bypass the per-chunk output processor pass. These chunks describe a
   * single model call that the caller may still recover from via an error
   * processor retry or a fallback model, so the caller becomes responsible for
   * running output processors on the error once recovery has been ruled out.
   */
  deferErrorChunks?: boolean;
  returnScorerData?: boolean;
  processorStates?: Map<string, any>;
  requestContext?: RequestContext;
  transportRef?: StreamTransportRef;
  /** Experimental transforms applied whenever `fullStream` is consumed. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
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

/** Generated content, tool activity and metadata collected for one model step. */
export type LLMStepResult<OUTPUT = undefined> = {
  /** Whether this is the initial model step or a subsequent tool-result step. */
  stepType?: 'initial' | 'tool-result';
  /** Tool-call chunks collected during this step. */
  toolCalls: ToolCallChunk[];
  /** Tool invocations whose inputs or results are still pending, when included. */
  pendingToolCalls?: PendingToolCall[];
  /** Tool-result chunks collected during this step. */
  toolResults: ToolResultChunk[];
  /** Tool-call chunks explicitly marked with dynamic set to true. */
  dynamicToolCalls: ToolCallChunk[];
  /** Tool-result chunks explicitly marked with dynamic set to true. */
  dynamicToolResults: ToolResultChunk[];
  /** Tool-call chunks explicitly marked with dynamic set to false. */
  staticToolCalls: ToolCallChunk[];
  /** Tool-result chunks explicitly marked with dynamic set to false. */
  staticToolResults: ToolResultChunk[];
  /** Generated file chunks collected during this step. */
  files: FileChunk[];
  /** Source-reference chunks collected during this step. */
  sources: SourceChunk[];
  /** Text generated by this step, or an empty string when a tripwire rejects it. */
  text: string;
  /** Reasoning blocks collected during this step. */
  reasoning: ReasoningChunk[];
  /** Response content parts in the AI SDK step-result format. */
  content: AIV5Type.StepResult<ToolSet>['content'];
  /** Reason the model stopped generating for this step, when available. */
  finishReason?: FinishReason | string;
  /** Token usage reported for this step. */
  usage: LanguageModelUsage;
  /** Warnings reported for this model call. */
  warnings: LanguageModelV2CallWarning[];
  /** Request metadata associated with the step. */
  request: {
    /** Request body, when supplied by the provider adapter. */
    body?: unknown;
  };
  /** Response metadata and response messages associated with the step. */
  response: {
    /** Response headers, when supplied by the model adapter. */
    headers?: Record<string, string>;
    /** Assistant and tool messages included in the model response. */
    messages?: StepResult<ToolSet>['response']['messages'];
    /** Response messages in Mastra's database-message format. */
    dbMessages?: MastraDBMessage[];
    /** Response messages in the AI SDK UI-message format. */
    uiMessages?: UIMessage<
      [OUTPUT] extends [undefined]
        ? undefined
        : {
            /** Structured output associated with the response UI message. */
            structuredOutput?: OUTPUT;
          } & Record<string, unknown>
    >[];
    /** Response identifier supplied by the adapter, or an empty string when unavailable. */
    id?: string;
    /** Response timestamp from the adapter, with step-completion time as a fallback. */
    timestamp?: Date;
    /** Model identifier reported in response metadata, or an empty string when unavailable. */
    modelId?: string;
    /**
     * Additional response metadata supplied by the adapter.
     * @param key - Additional response metadata field name.
     */
    [key: string]: unknown;
  };
  /** Concatenated reasoning text for this step, when available. */
  reasoningText: string | undefined;
  /** Provider-specific metadata associated with this step, when available. */
  providerMetadata: ProviderMetadata | undefined;
  /** Tripwire data if this step was rejected by a processor */
  tripwire?: StepTripwireData;
};
