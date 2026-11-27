import type {
  LanguageModelV2FinishReason,
  LanguageModelV2CallWarning,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import type { LanguageModelRequestMetadata, LogProbs as LanguageModelV1LogProbs } from '@internal/ai-sdk-v4';
import type { LanguageModelUsage, ModelMessage } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod';
import type { MastraFGAPermissionInput } from '../../auth/ee';

import type { ActorSignal } from '../../auth/ee/fga-check';
import type { BackgroundTaskManager } from '../../background-tasks/manager';
import type { AgentBackgroundConfig } from '../../background-tasks/types';
import type { ScoringFilter } from '../../evals/predicate';
import type { SystemMessage } from '../../llm';
import type { MastraLanguageModel, MastraModelConfig, SharedProviderOptions } from '../../llm/model/shared.types';
import type { ToolResultCommitOutcome } from '../../loop/shared/steps/tool-result-commit-core';
import type { ToolCallConcurrency } from '../../loop/types';
import type { Mastra } from '../../mastra';
import type { RunScope } from '../../mastra/run-scope';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig } from '../../memory/types';
import type {
  AIModelGenerationSpan,
  Span,
  SpanTermination,
  SpanType,
  TracingContext,
  TracingOptions,
} from '../../observability';
import type {
  InputProcessorOrWorkflow,
  LLMRequestProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ErrorProcessorOrWorkflow,
} from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import type { RequestContext } from '../../request-context';
import type { MastraModelOutput } from '../../stream/base/output';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraStreamTransformOptions,
  StepTripwireData,
} from '../../stream/types';
import type { ToolPayloadTransformMetadata } from '../../tools/payload-transform';
import type {
  CoreTool,
  MCPToolExecutionContext,
  RequireToolApproval,
  ToolPayloadTransformPolicy,
  ToolPayloadTransformTarget,
} from '../../tools/types';
import type { DynamicArgument } from '../../types';
import type { ShouldPersistSnapshotFn, WorkflowRunStatus } from '../../workflows/types';
import type { Workspace } from '../../workspace';
import type { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { AIV5ResponseMessage, MessageList } from '../message-list';
import type { SerializedMessageListState } from '../message-list/state';
import type { SaveQueueManager } from '../save-queue';
import type { PendingSignalListener, AgentSignalInput, CreatedAgentSignal } from '../signals';
import type { AgentStreamsConfig } from '../streams/types';
import type { TripwireData } from '../trip-wire';
import type { AgentMethodType, GoalConfig, StructuredOutputOptions, ToolsInput } from '../types';
import type { ExecutionFence } from './execution-fence';
import type { ResponseRecord } from './workflows/shared/schemas';

/**
 * Metadata about a tool that can be serialized (without the execute function)
 */
export interface SerializableToolMetadata {
  /** Tool's unique identifier */
  id: string;
  /** Tool's name (key in the tools record) */
  name: string;
  /** Tool's description */
  description?: string;
  /** JSON Schema for the tool's input parameters */
  inputSchema: JSONSchema7;
  /** Whether the tool requires human approval before execution */
  requireApproval?: boolean;
  /** Whether the tool has a suspend schema for custom suspension */
  hasSuspendSchema?: boolean;
}

/**
 * Configuration for model resolution (serializable)
 */
export interface SerializableModelConfig {
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  modelId: string;
  /** Model specification version */
  specificationVersion?: string;
  /** Original model string/config for resolution at runtime (e.g., 'openai/gpt-4o') */
  originalConfig?: string | Record<string, unknown>;
  /**
   * Per-entry call settings from a model list entry's `modelSettings`, merged
   * over call-time `modelSettings` on each attempt. Headers are excluded.
   */
  settings?: SerializableModelSettings;
  /** Provider-specific options for the model call */
  providerOptions?: SharedProviderOptions;
}

/**
 * Entry in the model list for fallback support (serializable)
 */
export interface SerializableModelListEntry {
  /** Unique identifier for this model entry */
  id: string;
  /** Model configuration */
  config: SerializableModelConfig;
  /** Maximum retries before moving to next model */
  maxRetries: number;
  /** Whether this model is enabled */
  enabled: boolean;
}

/**
 * Sampling configuration for scorers (serializable)
 */
export type SerializableScoringSamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

/**
 * Entry for a single scorer in the configuration (serializable)
 */
export interface SerializableScorerEntry {
  /** Scorer name (for resolution from Mastra at runtime) */
  scorerName: string;
  /** Optional sampling configuration */
  sampling?: SerializableScoringSamplingConfig;
  /** Optional eligibility filter (JSON-safe predicate, survives round-trips as-is) */
  filter?: ScoringFilter;
}

/**
 * Scorers configuration (serializable)
 */
export type SerializableScorersConfig = Record<string, SerializableScorerEntry>;

/**
 * Serializable subset of _internal (StreamInternal) that flows through workflow state
 */
export interface SerializableDurableState {
  /** Memory configuration options */
  memoryConfig?: MemoryConfig;
  /** Thread identifier for memory persistence */
  threadId?: string;
  /** Resource/user identifier */
  resourceId?: string;
  /** Whether the thread already exists in storage */
  threadExists?: boolean;
  /** Whether to save messages after each step (incremental persistence) */
  savePerStep?: boolean;
  /** Whether observational memory is enabled (suppresses savePerStep) */
  observationalMemory?: boolean;
  /**
   * Whether the agent's memory is a fixed instance. Only then may the stored
   * transcript reference recalled messages instead of copying them: function or
   * inherited memory can resolve to another store when the run resumes.
   */
  fixedMemory?: boolean;
}

/**
 * Serializable structured output configuration
 */
export interface SerializableStructuredOutput {
  /** JSON Schema representation of the output schema */
  schema?: JSONSchema7;
  /** Whether to use JSON prompt injection instead of native response format */
  jsonPromptInjection?: boolean | 'system' | 'inline' | 'auto';
  /** Caller-supplied instructions (see `StructuredOutputOptionsBase.instructions`) */
  instructions?: string;
  /** Whether to use the parent agent's model for structuring */
  useAgent?: boolean;
  /** Model config for a dedicated structuring model (if different from the main model) */
  structuringModelConfig?: SerializableModelConfig;
  /**
   * Whether the caller set `structuredOutput.model`. The main model then answers in plain
   * text and the finish step runs a separate structuring pass, like Agent.
   */
  hasStructuringModel?: boolean;
  /** The model answers omitted optional fields with `null` (OpenAI strict mode); validate with null → undefined. */
  nullToUndefined?: boolean;
  /** How validation failures are handled (see `StructuredOutputOptionsBase.errorStrategy`) */
  errorStrategy?: 'strict' | 'warn' | 'fallback';
  /** Value used when `errorStrategy` is `'fallback'`. Omitted when it is not JSON-safe. */
  fallbackValue?: unknown;
}

/**
 * Serializable subset of the AI SDK `CallSettings` passed to the model on each
 * step of a durable agentic loop. Mirrors `LoopOptions['modelSettings']` minus
 * `abortSignal` (non-serializable; handled separately via the run registry).
 *
 * `headers` are intentionally excluded — they are stored on the in-process
 * `RunRegistryEntry` so they never reach durable storage. The durable
 * `llm-execution` step merges them back from the registry at call time.
 */
export interface SerializableModelSettings {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  /**
   * Execution time budgets (#21724). Persisted so a cold resume / recovery can
   * re-arm the run-level budget the run was started with; `stepMs` and
   * `firstChunkMs` are consumed by the shared per-call execute wrapper, which
   * receives these serialized settings on the durable path.
   */
  timeout?: { stepMs?: number; totalMs?: number; firstChunkMs?: number };
}

/**
 * JSON-safe snapshot of a call-time client tool. Client tools never execute on
 * the server, so only the schema/metadata the model needs is persisted; the
 * worker rebuilds the client tool from this when it runs in another process.
 */
export interface SerializableClientTool {
  id?: string;
  description?: string;
  inputSchema: JSONSchema7;
  requireApproval?: boolean;
}

/**
 * Options for durable agent execution (serializable subset)
 */
export interface SerializableDurableOptions {
  /** Call-time client tools, keyed by tool name, for cross-process rebuilds */
  clientTools?: Record<string, SerializableClientTool>;
  /**
   * Names of call-time `toolsets` tools. Their `execute` closures cannot cross
   * a process boundary, so a worker rebuilding tools uses these names to fail
   * loudly instead of silently dropping them.
   */
  toolsetToolNames?: string[];
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
  /** Tool selection strategy */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Tool names enabled for this execution */
  activeTools?: string[];
  /** Serializable LLM call settings (temperature, maxOutputTokens, topP, topK, presencePenalty, frequencyPenalty, stopSequences, seed, maxRetries, timeout). Headers are excluded — see RunRegistryEntry. */
  modelSettings?: SerializableModelSettings;
  /**
   * Agent-level maxRetries (folded, defaults to 0). Single-model agents have
   * no modelList entry to carry retry config, so it rides on options; the
   * llm-execution step's retry ladder reads it to apply the same
   * agent-vs-call-time precedence as the in-process loop.
   */
  agentMaxRetries?: number;
  /**
   * Whether `maxRetries` was explicitly configured on the agent. An explicit
   * value (including 0) overrides call-time `modelSettings.maxRetries`;
   * otherwise the call-time value wins — matching `llm-execution-step.ts`.
   */
  agentMaxRetriesConfigured?: boolean;
  /** Whether to require tool approval globally */
  requireToolApproval?: boolean;
  /** Concurrency limit / strategy for parallel tool calls (JSON-safe union) */
  toolCallConcurrency?: ToolCallConcurrency;
  /** Whether to auto-resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum processor retries per generation */
  maxProcessorRetries?: number;
  /** Whether to include raw chunks in the stream */
  includeRawChunks?: boolean;
  /** Whether to return scorer data in the result */
  returnScorerData?: boolean;
  /** Whether error processors are configured (flag only, instances are non-serializable) */
  hasErrorProcessors?: boolean;
  /**
   * The call passed `errorProcessors: []`, replacing the agent's resolved list (defaults included)
   * with none. Processor instances aren't serializable, so this marker is what lets a worker that
   * rebuilds the pipeline honor that override.
   */
  emptyErrorProcessorOverride?: boolean;
  /** Provider-specific options passed to the language model */
  providerOptions?: SharedProviderOptions;
  /** Structured output configuration */
  structuredOutput?: SerializableStructuredOutput;
  /** When true, the background task check step skips its in-loop wait (external driver handles continuation) */
  skipBgTaskWait?: boolean;
  /** When true, background tasks are disabled for this run (the registry will not receive a BackgroundTaskManager). */
  disableBackgroundTasks?: boolean;
  /** Execution-scoped background dispatch policy for delegated agents. */
  backgroundTaskPolicy?: {
    allowToolDispatch: boolean;
    allowDelegationDispatch: boolean;
  };
  /** Tracing options forwarded to the agent/model spans (metadata, tags, requestContextKeys, parentSpanId, hideInput/hideOutput, traceId). */
  tracingOptions?: TracingOptions;
  /**
   * Per-call actor signal (e.g. `true` for system, or `{ actorKind: 'system', sourceWorkflow }`).
   * Used by FGA checks and propagated to tool execution.
   */
  actor?: ActorSignal;
  /** Per-call instructions override (replaces the agent's default instructions for this run). */
  instructionsOverride?: SystemMessage;
  /** Per-call extra system message appended after context but before user messages. */
  systemMessage?: SystemMessage;
  /**
   * Serializable shadow of the per-call `transform` policy. Only the
   * JSON-safe `targets` array is carried here; the actual
   * `transformToolPayload` closure lives on the run registry and is only
   * applied for in-process durable runs.
   */
  transform?: {
    targets?: ToolPayloadTransformTarget[];
  };
  /**
   * Serializable shadow of the per-call `isTaskComplete` policy. The
   * `MastraScorer` instances and `onComplete` closure live on the run
   * registry and are only applied for in-process durable runs; the
   * JSON-safe primitives below are carried in workflow input for
   * observability and cross-process engines.
   */
  isTaskComplete?: {
    fromAgentDefaults?: boolean;
    scorerIds?: string[];
    scorerNames?: string[];
    strategy?: 'all' | 'any';
    timeout?: number;
    parallel?: boolean;
    suppressFeedback?: boolean;
  };
}

/**
 * Main input schema for the durable agentic workflow
 * This is fully serializable and flows through workflow state
 */
export interface DurableAgenticWorkflowInput {
  /** Discriminator field to identify durable agent workflows */
  __workflowKind: 'durable-agent';
  /** Unique identifier for this execution run */
  runId: string;
  /** Agent identifier */
  agentId: string;
  /** Agent name for logging/tracing */
  agentName?: string;
  /**
   * Exact stored version id the run resolved to at start time. A run that
   * suspends while executing a stored version must resume on *that* version —
   * a status selector would re-resolve to whatever is published at resume
   * time and silently change instructions/tools underneath a human approver.
   * `DurableAgent.resume()` reads this on cold rehydration to pin the
   * version. Absent for purely code-defined agents.
   */
  agentVersionId?: string;
  /** Serialized MessageList state */
  messageListState: SerializedMessageListState;
  /** Tool metadata (without execute functions) */
  toolsMetadata: SerializableToolMetadata[];
  /** Model configuration for resolution (primary model) */
  modelConfig: SerializableModelConfig;
  /** Model list for fallback support (when agent configured with array of models) */
  modelList?: SerializableModelListEntry[];
  /** Scorers configuration for evaluation */
  scorers?: SerializableScorersConfig;
  /** Serializable execution options */
  options: SerializableDurableOptions;
  /** Serializable internal state */
  state: SerializableDurableState;
  /** Message ID for the current generation */
  messageId: string;
  /** Exported agent span data for observability (created before workflow starts) */
  agentSpanData?: unknown;
  /** Exported model_generation span data for observability (created before workflow starts) */
  modelSpanData?: unknown;
  /** Starting step index for continuation across iterations */
  stepIndex?: number;
  /**
   * JSON-safe snapshot of `requestContext.entries()` from the call site.
   * Threaded through workflow input so durable steps (e.g. `is-task-complete`
   * scorers) can pass it as `customContext`, matching the non-durable path.
   * Only plain JSON-safe entries should appear here.
   */
  requestContextEntries?: Record<string, unknown>;
  /** Initial processor rejection, with metadata snapshotted for cross-process execution. */
  inputTripwire?: TripwireData;
}

/**
 * Output from a single LLM execution step
 */
export interface DurableLLMStepOutput {
  /**
   * Updated MessageList state after LLM execution. Absent when the run keeps
   * the transcript in workflow state (the durable loop does).
   */
  messageListState?: SerializedMessageListState;
  /** Text generated by this LLM step */
  text?: string;
  /** Tool calls generated by the LLM */
  toolCalls: DurableToolCallInput[];
  /** Step result metadata */
  stepResult: {
    reason: LanguageModelV2FinishReason | 'abort' | 'tripwire' | 'retry';
    warnings: LanguageModelV2CallWarning[];
    isContinued: boolean;
    signalPreempted?: boolean;
    logprobs?: LanguageModelV1LogProbs;
    totalUsage?: LanguageModelUsage;
    headers?: Record<string, string>;
    messageId?: string;
    request?: LanguageModelRequestMetadata;
    /** Set when a processOutputStep processor rejected this step */
    tripwire?: StepTripwireData;
  };
  /** Response metadata from the model */
  metadata: {
    id?: string;
    modelId?: string;
    timestamp?: string; // ISO string for serialization
    providerMetadata?: SharedV2ProviderMetadata;
    headers?: Record<string, string>;
    request?: LanguageModelRequestMetadata;
  };
  /** Provider id and serving model of this step's response; absent when the provider sent none */
  response?: ResponseRecord;
  /** Processor retry count */
  processorRetryCount?: number;
  /** Processor retry feedback message */
  processorRetryFeedback?: string;
  /** Tool results of earlier steps that an output processor held until this step's stream ended */
  releasedToolResultIds?: string[];
  /** Updated serializable state */
  state: SerializableDurableState;
  /** Exported model_generation span data (only set when there are tool calls) */
  modelSpanData?: unknown;
  /** Exported model_step span data (only set when there are tool calls) */
  stepSpanData?: unknown;
  /** Step finish payload data for closing step span later */
  stepFinishPayload?: unknown;
  /** Deferred step-finish chunk carried until continuation policy resolves. */
  deferredStepFinishChunk?: unknown;
  /** When this step's inference streamed its first chunk (the first one is kept for the generation) */
  completionStartTime?: Date;
  /** Time to first token of the inference that streamed this step's first chunk (kept with that chunk's clock) */
  timeToFirstTokenMs?: number;
  /** Outcome of a step that ended the run itself (fatal model failure or a tripwire), for the root spans */
  tracingTermination?: SpanTermination;
}

/**
 * Input for a single tool call step
 */
export interface DurableToolCallInput {
  /** Tool call identifier from the LLM */
  toolCallId: string;
  /** Name of the tool to execute */
  toolName: string;
  /** Arguments for the tool; absent when the model's JSON could not be parsed. */
  args?: Record<string, unknown>;
  /** Provider-specific metadata */
  providerMetadata?: SharedV2ProviderMetadata;
  /** Whether the tool was already executed by the provider */
  providerExecuted?: boolean;
  /** Output if provider-executed */
  output?: unknown;
  /** Tool names enabled for the step that produced this call, or null if a processor cleared the restriction */
  activeTools?: string[] | null;
  /** First-chunk clock of the step that produced this call, applied when spans end on suspend */
  completionStartTime?: Date;
  /** Time to first token of the same step, applied the same way */
  timeToFirstTokenMs?: number;
  /**
   * Serialized from the step's *effective* tool set at emission time (processors may add
   * tools that never appear in the run-start `toolsMetadata`). Persisted with the call so
   * `resolveDurableToolCallConcurrency` can enforce sequential execution for
   * approval/suspend-capable tools even on a cold resume.
   */
  requireApproval?: boolean;
  /** @see requireApproval */
  hasSuspendSchema?: boolean;
  /** Exported model_step span data so the TOOL_CALL span nests under the LLM call */
  stepSpanData?: unknown;
  /** Model usage of the step that produced this call, reported on its suspension chunk */
  stepUsage?: LanguageModelUsage;
  /** Response of that step: the model that answered and the cost its provider reported */
  response?: ResponseRecord;
  /** Other tool calls of the step run at the same time, so a suspension of this one reports no model usage */
  sideBySide?: boolean;
}

/**
 * Output from a single tool call step
 */
export interface DurableToolCallOutput extends DurableToolCallInput {
  /** Result from tool execution */
  result?: unknown;
  /** Whether toModelOutput was evaluated before the result crossed the durable boundary */
  modelOutputComputed?: boolean;
  /** A toModelOutput failure serialized for propagation across the durable boundary. */
  mappingError?: {
    name: string;
    message: string;
    stack?: string;
  };
  /**
   * Set when execution was interrupted by request abort (not a tool error).
   * The call carries no result/error so the mapping step leaves it incomplete.
   */
  aborted?: boolean;
  /**
   * Set when a processToolResult processor blocked the result via tripwire.
   * A tripwire chunk was emitted instead of the tool-result; the call carries
   * no result so the mapping step leaves it incomplete (mirrors the main
   * loop's tripwire handling, where commit and emission are both skipped).
   */
  resultBlocked?: boolean;
  tripwire?: StepTripwireData;
  /**
   * Set when an output processor dropped the tool-result chunk without a
   * tripwire. The model still gets the result, but callbacks leave it out of
   * `toolResults`, as the stream never emitted it.
   */
  resultHidden?: boolean;
  /**
   * Non-transient data-* chunks emitted by output processors via
   * writer.custom() during this tool call. The tool-call step's messageList
   * is a local copy whose mutations don't cross the step boundary, so parts
   * are carried here and persisted into the authoritative messageList by the
   * mapping step (#19375 parity port).
   */
  processorDataParts?: Array<{
    type: string;
    data?: unknown;
    id?: string;
    messageId?: string;
  }>;
  /**
   * Chunk-level `mastra.toolPayloadTransform` metadata computed when the
   * tool-result/tool-error chunk was emitted (L18b). The tool-call step's
   * messageList is a local copy, so the metadata travels here across the
   * serialization boundary and is layered into the persisted providerMetadata
   * by the mapping step — matching the main loop's llm-mapping, which reads it
   * off the live chunk. Without it, transcript-target transforms would not
   * apply to the persisted args/result on recall.
   */
  transformMetadata?: { mastra?: { toolPayloadTransform?: ToolPayloadTransformMetadata } };
  /**
   * Set when a delegation `onDelegationComplete` hook called `ctx.bail()`
   * during this tool call. The bail signal is written by-reference to the
   * RequestContext the sub-agent tool was built with, which on the evented
   * engine is a different instance from the one later steps rehydrate from
   * their event payloads — so the tool-call step reads it in-process and
   * carries it here across the serialization boundary. The mapping step ORs
   * it into the iteration output so the dountil predicate stops the loop in
   * the same iteration on every engine (G3).
   */
  delegationBailed?: boolean;
  /** Why the delegation that bailed failed, carried beside `delegationBailed` for the root spans */
  tracingDelegationFailure?: SpanTermination;
  /** Set when the total deadline aborted this tool call; carried so any worker ends the run as the deadline */
  deadlineTimeout?: { timeoutType: 'total'; timeoutMs: number };
  /** Set when abort() stopped this tool call; carried so any worker ends the run as aborted */
  runAborted?: boolean;
  /** Error if tool execution failed */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /**
   * Approval decision for a `requireApproval` tool, present once the user has approved or declined.
   * A declined call carries `approved: false` and no `result`, so it persists as `output-denied`.
   * An approved call carries `approved: true` alongside the `result`.
   */
  approval?: {
    id: string;
    approved: boolean;
    reason?: string;
  };
}

/**
 * Output from the full agentic execution workflow (one iteration)
 */
export interface DurableAgenticExecutionOutput {
  /**
   * Updated MessageList state. Absent when the run keeps the transcript in
   * workflow state (the durable loop does).
   */
  messageListState?: SerializedMessageListState;
  /** Message ID */
  messageId: string;
  /** Step result with continuation info */
  stepResult: DurableLLMStepOutput['stepResult'];
  /** Tool call results */
  toolResults: DurableToolCallOutput[];
  /** Accumulated output */
  output: {
    text?: string;
    toolCalls?: DurableToolCallInput[];
    usage: LanguageModelUsage;
    steps: unknown[]; // StepResult is complex, we'll serialize what we need
    /** Model content of this step, as reported on the step-finish chunk */
    content?: unknown[];
  };
  /** Updated state */
  state: SerializableDurableState;
  /** Processor retry tracking */
  processorRetryCount?: number;
  processorRetryFeedback?: string;
  /** Tool results of earlier steps emitted at the end of this iteration's stream */
  releasedToolResultIds?: string[];
  /** Whether background tasks are still running after this iteration */
  backgroundTaskPending?: boolean;
  /** Whether a delegation hook called ctx.bail() during this iteration */
  delegationBailed?: boolean;
  /** Set when the total deadline aborted a tool call this iteration */
  deadlineTimeout?: { timeoutType: 'total'; timeoutMs: number };
  /** Set when abort() stopped a tool call this iteration */
  runAborted?: boolean;
  /** Step-finish chunk awaiting the loop's final continuation decision */
  deferredStepFinishChunk?: unknown;
  /** When this iteration's inference streamed its first chunk */
  completionStartTime?: Date;
  /** Time to first token of the inference that streamed this iteration's first chunk */
  timeToFirstTokenMs?: number;
  /** Provider id and model of this iteration's response */
  response?: ResponseRecord;
  /** Outcome of a step that ended the run itself, see DurableLLMStepOutput */
  tracingTermination?: SpanTermination;
  /** Failure behind this iteration's delegation bail, see DurableToolCallOutput */
  tracingDelegationFailure?: SpanTermination;
  /** An earlier segment's suspension ended this iteration's MODEL_STEP and reported the run's usage so far */
  suspensionReportedUsage?: boolean;
}

/**
 * Final output from the durable agentic loop workflow
 */
export interface DurableAgenticLoopOutput {
  /** Final MessageList state */
  messageListState: SerializedMessageListState;
  /** Message ID */
  messageId: string;
  /** Final step result */
  stepResult: DurableLLMStepOutput['stepResult'];
  /** Accumulated output from all iterations */
  output: {
    text?: string;
    usage: LanguageModelUsage;
    steps: unknown[];
  };
  /** Final state */
  state: SerializableDurableState;
  /** The outcome the run's spans ended with; a recovery of the saved run ends its own spans with it. */
  tracingTermination?: SpanTermination;
  /** Why the loop stopped, as on the FINISH this step published; a recovery that republishes FINISH reads it. */
  stopCause?: import('../../loop/shared/continuation-core').ContinuationStopCause;
}

export type { AgentStreamEvent, AgentStreamEventType } from '../streams/types';

/**
 * Chunk event data
 */
export type AgentChunkEventData = ChunkType<unknown>;

/**
 * Step finish event data
 */
export interface AgentStepFinishEventData {
  stepResult: DurableLLMStepOutput['stepResult'];
  toolResults?: DurableToolCallOutput[];
}

/**
 * Payload passed to a durable agent's `onStepFinish` callback: the step-finish event data plus the run it belongs to.
 */
export type DurableAgentStepFinishResult = AgentStepFinishEventData & { runId: string };

/**
 * Finish event data
 */
export interface AgentFinishEventData {
  output: DurableAgenticLoopOutput['output'];
  stepResult: DurableLLMStepOutput['stepResult'];
  /** The run's conversation, as on the default loop's finish chunk. */
  messages?: {
    all: ModelMessage[];
    user: ModelMessage[];
    nonUser: AIV5ResponseMessage[];
  };
  /**
   * Set when processOutputResult changed the reply after the last step-finish was streamed.
   * The last entry of `output.steps` then holds the processed text, and callers must use it
   * instead of the text they buffered from the stream.
   */
  textRewritten?: boolean;
  /** Why the loop stopped calling the model, as on the default loop's finish chunk. */
  stopCause?: import('../../loop/shared/continuation-core').ContinuationStopCause;
}

/**
 * Error event data
 */
export interface AgentErrorEventData {
  error: {
    /** Stable error id (e.g. `AGENT_RESUME_ALREADY_CLAIMED`) when the source was a `MastraError`. */
    id?: string;
    name: string;
    message: string;
    stack?: string;
  };
  delivery?: 'reject';
}

/**
 * Suspended event data (for tool approval/custom suspension)
 */
export interface AgentSuspendedEventData {
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  suspendPayload?: unknown;
  resumeSchema?: string;
  type: 'approval' | 'suspension';
}

/**
 * Abort event data (emitted when execution is cancelled via abortSignal)
 */
export interface AgentAbortEventData {
  /** Steps accumulated up to the point of abort */
  steps: unknown[];
  /** Assistant text streamed before the abort */
  text?: string;
}

/**
 * Iteration-complete event data (emitted after each agentic loop iteration)
 */
export interface AgentIterationCompleteEventData {
  iteration: number;
  maxIterations?: number;
  text?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    id: string;
    name: string;
    result: unknown;
    error?: { name: string; message: string };
  }>;
  isFinal: boolean;
  finishReason?: string;
  runId: string;
  threadId?: string;
  resourceId?: string;
  agentId: string;
  agentName?: string;
}

/**
 * Model list entry stored in registry (actual model instances, not serialized config)
 */
export interface RegistryModelListEntry {
  id: string;
  model: MastraLanguageModel;
  maxRetries: number;
  enabled: boolean;
  /** Model-config-level headers (from `AgentModelManagerConfig.headers`). */
  headers?: Record<string, string>;
}

/**
 * Registry entry for a single run's non-serializable state
 */
export interface RunRegistryEntry {
  /** MODEL_STEP a tool-calling iteration leaves open until its mapping step, so a failed run can end it. */
  openStepSpan?: Span<SpanType.MODEL_STEP>;
  /** In-process copy of a tracing fact the iteration state carries across workers; not in the finish payload. */
  tracingTermination?: SpanTermination;
  tracingDelegationFailure?: SpanTermination;
  tracingStopCause?: import('../../loop/shared/continuation-core').ContinuationStopCause;
  /** Effective public ID of the owning agent; absent on legacy or manually seeded entries. */
  agentId?: string;
  /**
   * Marks a minimal cross-process placeholder entry (e.g. seeded by
   * @mastra/inngest resume() to carry an abort controller). Placeholder
   * entries hold no usable tools/model/processors, so
   * `resolveRuntimeDependencies` must rebuild runtime state from the agent
   * registered on the Mastra instance instead of trusting the entry.
   */
  isPlaceholder?: boolean;
  /**
   * Resolved tools with execute functions.
   *
   * After a durable LLM step runs input processors this holds the per-step
   * snapshot the model was shown (e.g. only `search_tools` when a
   * ToolSearchProcessor withholds searchable tools), so the durable tool-call
   * step resolves exactly what the model could call. Steps seed from
   * `baseTools` instead, so a narrowed snapshot never shrinks the toolset
   * later steps (and their processors) start from.
   */
  tools: Record<string, CoreTool>;
  /**
   * The complete resolved toolset for the run, before any per-step processor
   * narrowing. Set by the durable LLM step the first time it overwrites `tools`
   * with a per-step snapshot; `resolveRuntimeDependencies` prefers it over
   * `tools` when seeding a step (issue #22933).
   */
  baseTools?: Record<string, CoreTool>;
  /**
   * The tools built for the request that started (or last resumed) the run.
   * A warm resume rebuilds these with the resuming call's request context and
   * swaps out only entries that still hold one of them, so processor-added or
   * replaced tools are kept (#25960).
   */
  requestTools?: Record<string, CoreTool>;
  /**
   * The method that started the run (`stream` or `generate`). A warm resume
   * rebuilds `requestTools` for this method, so a streamed run's sub-agents keep
   * streaming whatever the resume's `closeOnSuspend` is (#29436).
   */
  methodType?: AgentMethodType;
  /** SaveQueueManager for message persistence (undefined when memory is not configured) */
  saveQueueManager?: SaveQueueManager;
  /** Memory instance for thread creation and message persistence */
  memory?: MastraMemory;
  /** Successful in-flight memory authorization checks shared across this run. */
  memoryAuthorizationChecks?: Map<MastraFGAPermissionInput, Promise<void>>;
  /** The language model instance (non-serializable, has doStream method) */
  model: MastraLanguageModel;
  /** Model list for fallback support (stores actual model instances) */
  modelList?: RegistryModelListEntry[];
  /** Workspace for file/sandbox operations (non-serializable) */
  workspace?: Workspace;
  /** Request context for forwarding auth data, feature flags, etc. to tools */
  requestContext?: RequestContext;
  /** The stored context was rebuilt from a workflow snapshot, not supplied by the active caller. */
  requestContextRebuilt?: boolean;
  /** Segment identity for engines that do not carry a Core execution claim. */
  requestContextSegment?: string;
  /** MCP protocol context for in-process tool execution (non-serializable). */
  mcp?: MCPToolExecutionContext;
  /** Cleanup function to call when run completes */
  cleanup?: () => void;
  /** Per-run state shared by durable steps, released with the registry entry. */
  runScope?: RunScope;
  /** MessageList for tracking conversation messages (non-serializable) */
  messageList?: MessageList;
  /** Message list as of the last completed step; memory saves this when a total deadline ends the run */
  completedStepsState?: SerializedMessageListState;
  /**
   * Text the step in flight has streamed (as published) before a total deadline cut it off; cleared once the
   * step completes. Only kept for runs with a total deadline.
   */
  streamedStepText?: string[];
  /**
   * Tool calls of the step in flight that settled, kept for runs with a total deadline: when the deadline ends
   * the run before the step merges its results, the deadline save records them.
   */
  settledToolResults?: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    outcome: ToolResultCommitOutcome;
    /** The approval decision of an approved approval-gated tool, so it round-trips on recall. */
    approval?: { id: string; approved: boolean; reason?: string };
    /** Includes the tool payload transform metadata, so transcript transforms apply on recall. */
    providerMetadata?: Record<string, any>;
  }>;
  /** Resolved input processors (non-serializable, combined into workflow) */
  inputProcessors?: InputProcessorOrWorkflow[];
  /**
   * Uncombined input processors for `processLLMRequest`.
   * Combined (workflow-wrapped) processors skip `processLLMRequest` in the
   * `ProcessorRunner`; this field stores individual processors so the runner
   * can invoke each processor's `processLLMRequest` method. When absent the
   * durable `llm-execution` step falls back to `inputProcessors`.
   */
  llmRequestInputProcessors?: LLMRequestProcessorOrWorkflow[];
  /** Resolved output processors (non-serializable) */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /** Resolved error processors (non-serializable) */
  errorProcessors?: ErrorProcessorOrWorkflow[];
  /** Processor state map (carried across steps) */
  processorStates?: Map<string, ProcessorState>;
  /** The agent running this run, passed to every processor hook as `agent`. */
  agent?: Agent<any, any, any, any>;
  /** Background task manager instance (non-serializable) */
  backgroundTaskManager?: BackgroundTaskManager;
  /** Agent background tasks configuration */
  backgroundTasksConfig?: AgentBackgroundConfig;
  /** Live AGENT_RUN span for this run (non-serializable; used to parent the workflow run) */
  agentSpan?: Span<SpanType.AGENT_RUN>;
  /** Live MODEL_GENERATION span for this run (non-serializable) */
  modelSpan?: AIModelGenerationSpan;
  /**
   * The live spans of the segment a resume or recovery opened in this process. Steps read the
   * segment's pair from the request context and end these in place when they match it.
   */
  resumeAgentSpan?: Span<SpanType.AGENT_RUN>;
  resumeModelSpan?: AIModelGenerationSpan;
  /** First-chunk clock of the resumed segment's spans; the originals' clock lives in the loop state. */
  resumeCompletionStartTime?: Date;
  /** Time to first token of the resumed segment's spans, kept the same way. */
  resumeTimeToFirstTokenMs?: number;
  /**
   * Loop stop-condition predicate(s). Non-serializable (a closure), so the
   * durable workflow reads this from the in-process registry rather than from
   * the serialized workflow input. In cross-process engines (e.g. Inngest after
   * a worker restart) this slot is unavailable and the loop falls back to
   * `maxSteps` only — document this limitation at the call site.
   */
  stopWhen?: AgentExecutionOptions['stopWhen'];
  /**
   * Iteration-complete handler. Non-serializable (a closure). The durable
   * workflow reads this from the in-process registry inside the dowhile
   * predicate and may halt the loop early when the handler returns
   * `{ continue: false }`. In cross-process engines the slot is unavailable
   * and the handler simply does not fire.
   */
  onIterationComplete?: AgentExecutionOptions['onIterationComplete'];
  /**
   * Tool payload transform policy. The `transformToolPayload` function is a
   * closure (non-serializable) and only fires for in-process durable runs;
   * the JSON-safe `targets` shadow is also serialized into
   * `SerializableDurableOptions.transform` for observability and cross-process
   * engines.
   */
  toolPayloadTransform?: ToolPayloadTransformPolicy;
  /**
   * Per-step preparation hook (mirrors `Agent.stream({ prepareStep })`). The
   * function is a closure, so it lives only on the in-process registry. Each
   * iteration of the durable agentic loop wraps it in a `PrepareStepProcessor`
   * and appends it to the per-step input-processor chain, so its returned
   * fields (`model`, `tools`, `toolChoice`, `activeTools`, `providerOptions`,
   * `modelSettings`, `messageId`) flow into the LLM call the same way they do
   * in the non-durable agent. Cross-process engines do not honour it.
   */
  prepareStep?: AgentExecutionOptions['prepareStep'];
  /**
   * Per-call `isTaskComplete` policy. Holds the `MastraScorer` instances and
   * the `onComplete` closure that cannot survive the wire; the JSON-safe
   * primitives (`strategy`, `timeout`, `parallel`, `suppressFeedback`,
   * `scorerNames`) are also serialized into `SerializableDurableOptions`.
   * Cross-process engines without this slot fall back to maxSteps only.
   */
  isTaskComplete?: AgentExecutionOptions['isTaskComplete'];
  /**
   * Agent-level goal configuration. Contains closures (judge resolver,
   * tools resolver, scorer) that cannot survive the wire; the durable goal
   * step reads this from the in-process registry. Cross-process engines
   * without this slot simply skip goal evaluation.
   */
  goal?: GoalConfig;
  /**
   * Per-call global tool-approval policy. When `RequireToolApproval` is a
   * function it cannot be serialized into the workflow input, so the closure
   * lives on the in-process registry. The durable tool-call step prefers this
   * slot over the JSON-safe boolean shadow (`SerializableDurableOptions.requireToolApproval`).
   * Cross-process engines (e.g. Inngest after a worker restart) lose the
   * closure and fall back to the boolean shadow — function policies degrade
   * safely to "require approval for every tool call" rather than silently
   * allowing them.
   */
  requireToolApproval?: RequireToolApproval;
  /**
   * Per-call delegation config (`onDelegationStart`, `onDelegationComplete`,
   * `messageFilter`, ...). Closures, so in-process only. A warm resume that
   * rebuilds tools reuses it when the resume call supplies no `delegation`.
   */
  delegation?: AgentExecutionOptions['delegation'];
  /**
   * Signal drain closure. When the durable agent inherits `sendSignal()` from
   * its wrapped `Agent`, signals are queued in `AgentThreadStreamRuntime`. This
   * closure retrieves and clears those queues, keyed by scope:
   * - `'pending'` — signals sent while the run is active (between iterations)
   * - `'pre-run'` — signals sent before the first model request
   *
   * Non-serializable (a closure); cross-process engines cannot recover it and
   * signals sent to a restarted worker will not be drained.
   */
  drainPendingSignals?: (scope?: 'pending' | 'pre-run') => CreatedAgentSignal[];
  /**
   * Queues a signal on `AgentThreadStreamRuntime` for this run, where the
   * drain closure picks it up. Processors that keep a step's `sendSignal`
   * and call it after that step returned are routed here, because the step's
   * MessageList has already been serialized. In-process only like the drain.
   */
  enqueuePendingSignal?: (signalInput: AgentSignalInput) => Promise<CreatedAgentSignal>;
  /** Process-local reminders for runs without a memory thread. Drained by the next LLM step. */
  pendingProcessorSignals?: CreatedAgentSignal[];
  /** Owner-queue notifications, in-process only like the drain closure. */
  subscribePendingSignals?: (listener: PendingSignalListener) => () => void;
  /** Releases the latest LLM step's pending-signal listener, whichever way that step exited. */
  stopStepSignalListener?: () => void;
  /**
   * Thread title generation closure — mirrors the non-durable `#executeOnFinish`
   * title-generation branch, which was never ported to the durable finish step
   * (so `memory.options.generateTitle` never fired for durable/evented agents).
   * Parked here during preparation, where the agent instance is in scope; the
   * durable finish step invokes it after the run completes. When the merged
   * memory config has no `generateTitle`, or the thread already has a title, it
   * is a no-op. Non-serializable (a closure) — cross-process engines lose it and
   * skip title generation, matching the other registry closures.
   */
  generateThreadTitle?: (args: {
    threadId: string;
    resourceId: string;
    memoryConfig?: MemoryConfig;
    messageListState: SerializedMessageListState;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
  }) => Promise<string | undefined>;
  /**
   * True for a stream() run whose merged `generateTitle` config sets `emitEvent`. The finish
   * step then waits for the title and streams it as a transient `data-thread-title` chunk
   * before FINISH, as the in-process loop does. Cross-process engines lose it and skip the chunk.
   */
  streamThreadTitle?: boolean;
  /** `memory.onTitleGenerated` from the call options. Non-serializable, like generateThreadTitle. */
  onTitleGenerated?: (title: string) => void | Promise<void>;
  /**
   * Signal messages already present in the `messageList` at run start (from
   * persisted history). These are echoed as `data-signal` stream data parts
   * so the client sees them without re-fetching history. The array is spliced
   * once on the first LLM step, so it is only echoed once per run.
   *
   * Non-serializable (contains `CreatedAgentSignal` instances with methods);
   * populated during `prepareForDurableExecution`.
   */
  initialSignalEchoes?: CreatedAgentSignal[];
  /**
   * Abort signal for the run. Non-serializable, so it lives only on the
   * in-process registry; cross-process resumes cannot recover it.
   *
   * `DurableAgent.stream()` always installs an internal `AbortController`
   * here so the result's `abort()` method has something to flip. If the
   * caller also passed an external `abortSignal`, its `abort` event is
   * forwarded to the internal controller and both signals end up aborted
   * together.
   *
   * The durable LLM-execution step reads this slot to thread the signal
   * into `model.doStream({ abortSignal })`, into input-processor runs, and
   * into the abort short-circuits in the inner and outer catch blocks.
   */
  abortSignal?: AbortSignal;
  /**
   * Internal `AbortController` backing `abortSignal`. Owned by the
   * `DurableAgent` instance — callers should not flip it directly; they
   * should call `result.abort()` instead, which routes through here.
   */
  abortController?: AbortController;
  /**
   * Run-level execution budget from `modelSettings.timeout.totalMs` (#21724
   * parity port). Parked here so warm resumes re-arm the original budget
   * without re-reading the snapshot; cold resumes restore it from the
   * persisted workflow input. The budget is armed per execution session
   * (stream/resume/recover) — matching the main loop, where each session
   * gets a fresh timer — by composing `abortSignal` through
   * `createTimeoutAbortSignal` at install time.
   */
  timeoutTotalMs?: number;
  /** A late subscriber re-publishes the winning deadline error at most once per segment. */
  deadlineErrorRedelivered?: boolean;
  /**
   * This process's subscription to cross-process abort requests for the run.
   * Set by `ensureRemoteAbortListener`, which every durable step calls on
   * entry; its presence keeps a run's many steps from installing duplicate
   * subscriptions. `releaseRemoteAbortListener` detaches and clears it once
   * the run reaches a final status.
   */
  remoteAbortListener?: { detach(): Promise<void> };
  /**
   * Promise tracking the in-flight workflow execution (or resume) for this
   * run. Resolves once the workflow has fully settled (finished, errored,
   * suspended-and-persisted, or aborted). Used by `generate()` /
   * `resumeGenerate()` to make sure a SUSPENDED snapshot is persisted
   * before they hand control back to the caller. Not part of the public
   * surface — purely an internal coordination primitive.
   */
  workflowExecution?: Promise<unknown>;
  /**
   * Execution lease claimed by the `stream()` / `generate()` / `resume()` /
   * `recover()` call currently driving this run in this process. Settled when
   * that execution segment ends.
   */
  executionFence?: ExecutionFence;
  /** The evented engine may dispatch this execution to another process. */
  eventedExecution?: boolean;
  /**
   * Tool call resumed by the `resume()` currently driving this run in this
   * process. Its in-flight marker is cleared when the segment suspends again.
   * @internal
   */
  resumeToolCallId?: string;
  /**
   * Set while an engine that persists the suspended snapshot before returning
   * is executing. The tool-call step queues suspension chunks/events here so
   * they are published only after the snapshot is saved; otherwise a crash in
   * between leaves a client holding a question that `resume()` rejects (#26435).
   * @internal
   */
  pendingSuspensionEvents?: Array<() => Promise<void>>;
  /**
   * Mastra instance that owns this in-process run. Used during shutdown to
   * wait only for executions that may still need this instance's storage.
   */
  mastra?: Mastra;
  /**
   * Tripwire data from `processInput` (initial input processing). When an
   * input processor calls `abort()` during `runInputProcessors` in
   * `preparation.ts`, the TripWire is caught and stored here instead of
   * swallowed. The first durable `llm-execution` step checks this slot and
   * immediately emits a `tripwire` chunk + bail response, preventing the
   * model from ever being called.
   *
   * Non-serializable (contains metadata of unknown shape); populated during
   * `prepareForDurableExecution`.
   */
  tripwire?: {
    reason: string;
    retry?: boolean;
    metadata?: unknown;
    processorId?: string;
  };
  /**
   * Call-time headers from `modelSettings.headers`. These are intentionally
   * excluded from the serialized `workflowInput` so they never reach durable
   * storage. The durable `llm-execution` step reads them from this in-process
   * registry slot and passes them as `callTimeHeaders` to `mergeLlmCallHeaders`.
   *
   * Cross-process engines (e.g. Inngest after a worker restart) lose this
   * slot; callers that need credentials on the LLM HTTP call should configure
   * them on the model factory (e.g. `openai({ apiKey })`) or via environment
   * variables.
   */
  callTimeHeaders?: Record<string, string>;
  /**
   * Call-time structured output configuration (with live schema). The schema
   * is non-serializable (Zod/standard schema instance), so it lives only on
   * the in-process registry. The durable stream adapter reads it to configure
   * `MastraModelOutput`'s `createObjectStreamTransformer`, which parses LLM
   * text into `object-result` chunks. Cross-process engines lose this slot
   * and structured output degrades to raw text.
   */
  structuredOutput?: StructuredOutputOptions;
  /**
   * Call-time `returnScorerData` flag. Also serialized into
   * `SerializableDurableOptions`, but parked here too so warm resume() and
   * observe() can rebuild `scoringData` on their client-side
   * `MastraModelOutput` without re-reading the snapshot. Cross-process
   * engines lose this slot; cold resume restores it from the persisted
   * workflow input instead.
   */
  returnScorerData?: boolean;
}

/**
 * Context available during durable step execution for resolving runtime dependencies
 */
export interface DurableStepContext {
  /** Mastra instance for accessing memory, tools, etc. */
  mastra: unknown; // Will be properly typed as Mastra
  /** Run identifier */
  runId: string;
  /** Agent identifier */
  agentId: string;
  /** Function to get tools for this run */
  getToolsForRun: (runId: string) => Record<string, CoreTool>;
}

/**
 * Zod schema types for runtime validation (will be defined in separate file)
 */
export type DurableAgenticWorkflowInputSchema = z.ZodType<DurableAgenticWorkflowInput>;
export type DurableLLMStepOutputSchema = z.ZodType<DurableLLMStepOutput>;
export type DurableToolCallInputSchema = z.ZodType<DurableToolCallInput>;
export type DurableToolCallOutputSchema = z.ZodType<DurableToolCallOutput>;

/**
 * Options for DurableAgent.stream()
 */
export interface DurableAgentStreamOptions<OUTPUT = undefined> {
  /** Signal chunks to hide from this caller's stream. Does not affect generated results. */
  hideSignals?: AgentExecutionOptions<OUTPUT>['hideSignals'];
  /** Custom instructions that override the agent's default instructions for this execution */
  instructions?: AgentExecutionOptions<OUTPUT>['instructions'];
  /** Additional context messages to provide to the agent */
  context?: AgentExecutionOptions<OUTPUT>['context'];
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentExecutionOptions<OUTPUT>['memory'];
  /** Scopes this run acts with. See `AgentExecutionOptions.scopes`. */
  scopes?: string[];
  /** Unique identifier for this execution run */
  runId?: string;
  /** Request Context containing dynamic configuration and state */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /** Maximum number of steps to run */
  maxSteps?: number;
  /**
   * Model to run for this call instead of the agent's model.
   *
   * A model instance can't be persisted, so `recover()` in another process falls back to the
   * agent's own model and logs a warning.
   */
  model?: DynamicArgument<MastraModelConfig>;
  /**
   * Conditions for stopping execution (e.g., step count, token limit).
   *
   * The predicate is non-serializable, so it's parked on the in-process run
   * registry and evaluated by the durable loop on every iteration. Cross-process
   * durable engines (e.g. Inngest after a worker restart) cannot recover the
   * closure and degrade to `maxSteps` only.
   */
  stopWhen?: AgentExecutionOptions<OUTPUT>['stopWhen'];
  /** Additional tool sets that can be used for this execution */
  toolsets?: AgentExecutionOptions<OUTPUT>['toolsets'];
  /** Client-side tools available during execution */
  clientTools?: AgentExecutionOptions<OUTPUT>['clientTools'];
  /** Tool selection strategy */
  toolChoice?: AgentExecutionOptions<OUTPUT>['toolChoice'];
  /** Tool names enabled for this execution */
  activeTools?: AgentExecutionOptions<OUTPUT>['activeTools'];
  /** Model-specific settings like temperature */
  modelSettings?: AgentExecutionOptions<OUTPUT>['modelSettings'];
  /** Provider-specific options forwarded to the model (serialized into the durable workflow input) */
  providerOptions?: AgentExecutionOptions<OUTPUT>['providerOptions'];
  /** Require approval for tool calls. Boolean (gate all / none) or a per-call function policy. */
  requireToolApproval?: AgentExecutionOptions<OUTPUT>['requireToolApproval'];
  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum number of tool calls to execute concurrently, or an object with `limit`/`strategy` */
  toolCallConcurrency?: AgentExecutionOptions<OUTPUT>['toolCallConcurrency'];
  /** Whether to include raw chunks in the stream output */
  includeRawChunks?: boolean;
  /** Experimental transforms applied whenever `fullStream` is consumed. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  /** Maximum processor retries */
  maxProcessorRetries?: number;
  /** Structured output configuration */
  structuredOutput?: AgentExecutionOptions<OUTPUT>['structuredOutput'];
  /** Whether to return detailed scoring data in the response */
  returnScorerData?: boolean;
  /** Version overrides for sub-agent delegation */
  versions?: AgentExecutionOptions<OUTPUT>['versions'];
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when step finishes */
  onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
  /** Callback when execution finishes — receives rich step data (text, steps, toolResults) */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback on error */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when workflow suspends (e.g., for tool approval) */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /** Callback when execution is aborted via abortSignal */
  onAbort?: AgentExecutionOptions<OUTPUT>['onAbort'];
  /** Callback fired after each agentic-loop iteration */
  onIterationComplete?: AgentExecutionOptions<OUTPUT>['onIterationComplete'];
  /** Additional system message appended after context but before user messages. */
  system?: AgentExecutionOptions<OUTPUT>['system'];
  /** When true, background tasks are disabled for this run. */
  disableBackgroundTasks?: AgentExecutionOptions<OUTPUT>['disableBackgroundTasks'];
  /** Execution-scoped background dispatch policy for delegated agents. */
  backgroundTaskPolicy?: AgentExecutionOptions<OUTPUT>['backgroundTaskPolicy'];
  /** Tracing options forwarded to the agent/model spans. */
  tracingOptions?: AgentExecutionOptions<OUTPUT>['tracingOptions'];
  /** Per-call actor signal forwarded to FGA checks and tool execution. */
  actor?: AgentExecutionOptions<OUTPUT>['actor'];
  /** MCP protocol context forwarded to tools for in-process durable runs. */
  mcp?: AgentExecutionOptions<OUTPUT>['mcp'];
  /**
   * Per-call tool lifecycle hooks. Applied when tools are prepared for this execution.
   * Function hooks are not serialized; a cross-process recovery cannot restore them.
   */
  hooks?: AgentExecutionOptions<OUTPUT>['hooks'];
  /**
   * Per-invocation tool payload transform policy. The closure rides on the
   * in-process run registry; only the JSON-safe `targets` shadow is serialized
   * for cross-process engines.
   */
  transform?: AgentExecutionOptions<OUTPUT>['transform'];
  /**
   * Per-step preparation hook. Closure-only: stored on the in-process run
   * registry and invoked as a `PrepareStepProcessor` at the start of every
   * iteration. Cross-process resumes lose the hook.
   */
  prepareStep?: AgentExecutionOptions<OUTPUT>['prepareStep'];
  /**
   * Per-call `isTaskComplete` policy. Scorer instances and `onComplete` are
   * closure-only and live on the in-process run registry; the JSON-safe
   * primitives (`strategy`, `timeout`, `parallel`, `suppressFeedback`,
   * `scorerNames`) are serialized for cross-process observability.
   */
  isTaskComplete?: AgentExecutionOptions<OUTPUT>['isTaskComplete'];
  /**
   * Sub-agent delegation hooks (`onDelegationStart`, `onDelegationComplete`,
   * `messageFilter`, etc.). The callbacks are forwarded into `convertTools`
   * at prepare time and burned into the sub-agent `CoreTool` wrappers on the
   * in-process run registry. Cross-process resumes lose the callbacks (only
   * `includeSubAgentToolResultsInModelContext` would be JSON-safe), so a
   * fresh worker degrades to default delegation behaviour.
   */
  delegation?: AgentExecutionOptions<OUTPUT>['delegation'];
  /**
   * When set, `stream()` delegates to the idle-loop wrapper that keeps the
   * outer stream open across background-task continuations — the same
   * behaviour as the now-deprecated `streamUntilIdle()`.
   *
   * Pass `true` for default idle timeout (5 min), or `{ maxIdleMs }` to
   * customise.
   *
   * @example
   * ```typescript
   * const { output, cleanup } = await durableAgent.stream('Research topic', {
   *   untilIdle: true,
   *   memory: { thread: 't1', resource: 'u1' },
   * });
   * ```
   */
  untilIdle?: boolean | { maxIdleMs?: number };
  /** When true, the in-loop background task check step skips waiting (streamUntilIdle sets this) */
  _skipBgTaskWait?: boolean;
  /**
   * @internal
   * Detach HTTP observers on reader cancellation instead of aborting execution.
   */
  _detachObserverOnCancel?: boolean;
  /**
   * External abort signal. The durable agent always installs its own internal
   * `AbortController` for the run; when this signal is provided, its `abort`
   * event is forwarded to the internal controller so either source can cancel
   * the run.
   *
   * Cross-process resumes (e.g. Inngest after a worker restart) cannot
   * recover the signal — call `resume(runId, ..., { abortSignal })` with a
   * fresh signal on each segment if you need abortability post-resume.
   */
  abortSignal?: AbortSignal;
  /**
   * Whether this caller's stream closes when the run suspends (e.g. for tool
   * approval). Defaults to `false`: the stream stays open across suspension so
   * a later resume can continue streaming on this same reader.
   *
   * Set to `true` so `fullStream`, `text`, and `getFullOutput()` resolve at the
   * suspension boundary (matching non-durable `Agent.stream()`), letting callers
   * such as AG-UI or A2A react instead of hanging. Resume the run with
   * `resumeStream()`/`resume()` — those always return a fresh stream.
   */
  closeOnSuspend?: boolean;
}

/**
 * Result from DurableAgent.stream()
 */
export interface DurableAgentStreamResult<OUTPUT = undefined> {
  /** The streaming output */
  output: MastraModelOutput<OUTPUT>;
  /** The full stream - delegates to output.fullStream for server compatibility */
  readonly fullStream: ReadableStream<any>;
  /** The unique run ID for this execution */
  runId: string;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if using memory */
  resourceId?: string;
  /** Trace ID of the run, when the run is traced */
  traceId?: string;
  /** ID of the agent run span, when the run is traced */
  spanId?: string;
  /** Cleanup function to call when done (unsubscribes from pubsub) */
  cleanup: () => void;
  /**
   * Abort the run. Flips the internal `AbortController` for this run, which
   * surfaces as an `AbortError` inside the durable LLM-execution step and
   * is bridged to the user's `onAbort` callback via the run's pubsub topic.
   *
   * Safe to call after the run has already finished — it's a no-op in that
   * case.
   *
   * Also publishes an abort request over pubsub so the abort reaches the
   * process executing the run, which in a load-balanced deployment is usually
   * not this one. That process flips its own controller and unwinds normally;
   * the workflow run is never hard-cancelled, so the terminal `finish` event
   * still reaches stream consumers. Await the returned promise to know the
   * request has been dispatched; ignoring it keeps the previous
   * fire-and-forget behaviour.
   */
  abort: (reason?: unknown) => Promise<void>;
}

/**
 * Configuration for DurableAgent - wraps an existing Agent with durable execution
 */
export interface DurableAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends AgentStreamsConfig {
  /**
   * The Agent to wrap with durable execution capabilities.
   * All agent methods (getModel, listTools, etc.) delegate to this agent.
   */
  agent: Agent<TAgentId, TTools, TOutput>;

  /**
   * Optional ID override. Defaults to agent.id.
   */
  id?: TAgentId;

  /**
   * Optional name override. Defaults to agent.name.
   */
  name?: string;

  /**
   * Maximum steps for the agentic loop.
   * Defaults to the workflow default if not specified.
   */
  maxSteps?: number;

  /**
   * Overrides the snapshot-persistence policy for this agent's durable
   * workflows. Returning false for a status skips that snapshot write.
   *
   * The default policy always persists `pending | paused | suspended`
   * (required for human-in-the-loop `resume()`), and persists `running`
   * when the Mastra instance is configured with
   * `recovery: { durableAgents: 'auto' }`, or at each step boundary after
   * `mastra.shutdown()` starts (even with recovery off). `running`
   * checkpoints exist solely so `listActiveRuns()` / `recover()` /
   * `recoverActiveRuns()` can see in-flight runs after a crash or shutdown.
   *
   * Footguns when providing a custom predicate:
   * - Excluding `paused` / `suspended` breaks human-in-the-loop resume.
   * - Excluding `running` makes the agent invisible to crash recovery.
   * A guardrail warning is logged for both cases (detected by probing the
   * predicate with an empty `stepResults`, so predicates that read
   * `stepResults` may probe inaccurately — the warning is best-effort).
   *
   * EventedAgent and InngestAgent own their persistence policy and ignore
   * this option with a warning.
   */
  shouldPersistSnapshot?: ShouldPersistSnapshotFn;

  /**
   * How this agent's new runs are stored. `1` rewrites one snapshot per run
   * on every write. `2` stores a run header plus per-step entries, and each
   * write sends only what changed.
   *
   * Where the storage adapter doesn't support version 2, new runs are stored
   * as version 1 and a warning is logged. Runs keep the version they were
   * created with: a run resumed after this option changes continues in its
   * stored version.
   *
   * @default 1
   * @experimental
   */
  storageVersion?: 1 | 2;
}

/**
 * DurableAgent wraps an existing Agent with durable execution capabilities.
 *
 * Key features:
 * 1. Resumable streams - clients can disconnect and reconnect without missing events
 * 2. Serializable workflow inputs - works with durable execution engines
 * 3. PubSub-based streaming - events flow through pubsub for distribution
 *
 * DurableAgent extends Agent, delegating most methods to the wrapped agent.
 * It overrides stream() to use durable execution with the agentic workflow.
 *
 * Subclasses (EventedAgent, InngestAgent) override executeWorkflow() to
 * customize how the workflow is executed.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { DurableAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = new DurableAgent({ agent });
 *
 * const { output, runId, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */

/**
 * Statuses of durable agent runs discoverable via {@link DurableAgent.listActiveRuns}.
 *
 * `running` is the status reported by the workflow engine while the durable
 * agent's agentic loop is actively executing (i.e. between suspend
 * boundaries). Persisted `running` snapshots are the recovery source for runs
 * orphaned by a process restart.
 */
export type DurableAgentActiveRunStatus = Extract<WorkflowRunStatus, 'running'>;

/**
 * Filters for {@link DurableAgent.listActiveRuns}. Mirrors the
 * `listWorkflowRuns` filter contract, plus the agent-level `threadId` /
 * `resourceId` filters used by the base {@link Agent.listSuspendedRuns}.
 */
export interface DurableAgentListActiveRunsOptions {
  /** Only return runs that belong to this memory thread. */
  threadId?: string;
  /** Only return runs that belong to this memory resource. */
  resourceId?: string;
  /** Only return runs created at or after this date. */
  fromDate?: Date;
  /** Only return runs created at or before this date. */
  toDate?: Date;
  /**
   * Number of items per page. Pagination is applied when both `perPage` and
   * `page` are provided; otherwise all matching runs are returned.
   */
  perPage?: number;
  /** Zero-indexed page number. */
  page?: number;
}

/**
 * A durable agent run currently reported as `running` in workflow snapshot
 * storage. These are the runs that a boot-time or operator-initiated
 * recovery would re-drive after a process restart.
 */
export interface DurableAgentActiveRun {
  /** Run ID accepted by {@link DurableAgent.recoverActiveRuns} and workflow `restart`. */
  runId: string;
  status: DurableAgentActiveRunStatus;
  threadId?: string;
  resourceId?: string;
  /** When the run's snapshot was last persisted while running. */
  updatedAt: Date;
}

export interface DurableAgentListActiveRunsResult {
  runs: DurableAgentActiveRun[];
  /** Total number of matching runs, before pagination. */
  total: number;
}

/**
 * Outcome of a single run restart attempted by
 * {@link DurableAgent.recoverActiveRuns}. `success` means `run.restart()`
 * returned; `failed` means it threw and the error was captured so recovery
 * of remaining runs could proceed; `skipped` means the run was not orphaned,
 * recovery hit a transient error, its recovery wait timed out, or recovery was interrupted by shutdown.
 */
export interface DurableAgentRecoveredRun {
  runId: string;
  status: 'success' | 'failed' | 'skipped';
  /** Set when `status` is `failed`. */
  error?: Error;
  /**
   * Set when `status` is `skipped`:
   * - `run-active`: another execution, possibly in another process, is live.
   *   Check again at `retryAt`.
   * - `run-active-locally`: this process is executing the run.
   * - `already-in-progress`: this process is already recovering the run.
   * - `transient-error`: recovery hit a transient infrastructure error. Check again at `retryAt`.
   * - `recovery-timeout`: the attempt is still pending or its 30-second wait expired. Check again at `retryAt`.
   */
  reason?: 'run-active' | 'run-active-locally' | 'already-in-progress' | 'transient-error' | 'recovery-timeout';
  /** Epoch ms to check again: claim expiry for `run-active`, or a retry delay for `transient-error` / `recovery-timeout`. */
  retryAt?: number;
}

/**
 * Filters for {@link DurableAgent.recoverActiveRuns}. Reuses the
 * {@link DurableAgentListActiveRunsOptions} discovery filters and adds an
 * escape hatch for targeting a specific run ID.
 */
export interface DurableAgentRecoverActiveRunsOptions extends DurableAgentListActiveRunsOptions {
  /**
   * Recover a specific run by ID. When set, the discovery filters and
   * pagination fields are ignored. Useful when the caller already knows the
   * run ID from another source (e.g. their own bookkeeping).
   */
  runId?: string;
}

export interface DurableAgentRecoverActiveRunsResult {
  recovered: DurableAgentRecoveredRun[];
  /** Number of runs that restarted successfully. */
  succeeded: number;
  /** Number of runs whose restart threw. */
  failed: number;
}

/**
 * Options for {@link DurableAgent.recover}, a single-run streamable recovery
 * counterpart to {@link DurableAgent.resume}.
 *
 * `recover()` rebuilds the run's non-serializable state from the persisted
 * workflow snapshot (message list, model, tools, memory, saveQueueManager,
 * request context, agent span) and returns a fresh {@link DurableAgentStreamResult}
 * whose `fullStream` observes the recovered run through pubsub. Callbacks
 * mirror `stream()` / `resume()`.
 */
export interface DurableAgentRecoverOptions<OUTPUT = undefined> {
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Experimental transforms applied whenever `fullStream` is consumed. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  /** Callback when a step finishes */
  onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
  /** Callback when the recovered run finishes */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback when the recovered run errors */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when the recovered run is aborted */
  onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
  /** Callback when the recovered run suspends again */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /**
   * Close the recovered stream once the run suspends (e.g. awaiting tool
   * approval) so callers can hand off to `resume()`. Defaults to `false`.
   */
  closeOnSuspend?: boolean;
  /**
   * Optional abort signal for the recovered segment. Forwarded onto a fresh
   * internal `AbortController` installed on the run's registry entry, so
   * `result.abort()` and the external signal can both cancel the recovered run.
   */
  abortSignal?: AbortSignal;
  /**
   * Take the run over even while another execution is live. The other
   * execution loses the run and stops; its writes are rejected when the
   * workflows store supports run fencing. Without `force`, `recover()` throws
   * `DURABLE_AGENT_RUN_ACTIVE` for a live run.
   */
  force?: boolean;
}
