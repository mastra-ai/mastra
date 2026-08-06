import type {
  LanguageModelV2FinishReason,
  LanguageModelV2CallWarning,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import type { LanguageModelRequestMetadata, LogProbs as LanguageModelV1LogProbs } from '@internal/ai-sdk-v4';
import type { LanguageModelUsage } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod';

import type { ActorSignal } from '../../auth/ee/fga-check';
import type { BackgroundTaskManager } from '../../background-tasks/manager';
import type { AgentBackgroundConfig } from '../../background-tasks/types';
import type { SystemMessage } from '../../llm';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig } from '../../memory/types';
import type { AIModelGenerationSpan, Span, SpanType, TracingContext, TracingOptions } from '../../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, ErrorProcessorOrWorkflow } from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import type { RequestContext } from '../../request-context';
import type { ChunkType } from '../../stream/types';
import type {
  CoreTool,
  RequireToolApproval,
  ToolPayloadTransformPolicy,
  ToolPayloadTransformTarget,
} from '../../tools/types';
import type { Workspace } from '../../workspace';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageList } from '../message-list';
import type { SerializedMessageListState } from '../message-list/state';
import type { SaveQueueManager } from '../save-queue';
import type { CreatedAgentSignal } from '../signals';
import type { GoalConfig, StructuredOutputOptions } from '../types';

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
  /** Additional model settings */
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    [key: string]: unknown;
  };
  /** Provider-specific options for the model call */
  providerOptions?: ProviderOptions;
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
}

/**
 * Serializable structured output configuration
 */
export interface SerializableStructuredOutput {
  /** JSON Schema representation of the output schema */
  schema?: JSONSchema7;
  /** Whether to use JSON prompt injection instead of native response format */
  jsonPromptInjection?: boolean | 'system' | 'inline' | 'auto';
  /** Whether to use the parent agent's model for structuring */
  useAgent?: boolean;
  /** Model config for a dedicated structuring model (if different from the main model) */
  structuringModelConfig?: SerializableModelConfig;
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
}

/**
 * Options for durable agent execution (serializable subset)
 */
export interface SerializableDurableOptions {
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
  /** Tool selection strategy */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Tool names enabled for this execution */
  activeTools?: string[];
  /** Serializable LLM call settings (temperature, maxOutputTokens, topP, topK, presencePenalty, frequencyPenalty, stopSequences, seed). Headers are excluded — see RunRegistryEntry. */
  modelSettings?: SerializableModelSettings;
  /** Whether to require tool approval globally */
  requireToolApproval?: boolean;
  /** Concurrency limit for parallel tool calls */
  toolCallConcurrency?: number;
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
  /** Provider-specific options passed to the language model */
  providerOptions?: ProviderOptions;
  /** Structured output configuration */
  structuredOutput?: SerializableStructuredOutput;
  /** When true, the background task check step skips its in-loop wait (external driver handles continuation) */
  skipBgTaskWait?: boolean;
  /** When true, background tasks are disabled for this run (the registry will not receive a BackgroundTaskManager). */
  disableBackgroundTasks?: boolean;
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
}

/**
 * Output from a single LLM execution step
 */
export interface DurableLLMStepOutput {
  /** Updated MessageList state after LLM execution */
  messageListState: SerializedMessageListState;
  /** Text generated by this LLM step */
  text?: string;
  /** Tool calls generated by the LLM */
  toolCalls: DurableToolCallInput[];
  /** Step result metadata */
  stepResult: {
    reason: LanguageModelV2FinishReason | 'tripwire' | 'retry';
    warnings: LanguageModelV2CallWarning[];
    isContinued: boolean;
    logprobs?: LanguageModelV1LogProbs;
    totalUsage?: LanguageModelUsage;
    headers?: Record<string, string>;
    messageId?: string;
    request?: LanguageModelRequestMetadata;
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
  /** Processor retry count */
  processorRetryCount?: number;
  /** Processor retry feedback message */
  processorRetryFeedback?: string;
  /** Updated serializable state */
  state: SerializableDurableState;
  /** Exported model_generation span data (only set when there are tool calls) */
  modelSpanData?: unknown;
  /** Exported model_step span data (only set when there are tool calls) */
  stepSpanData?: unknown;
  /** Step finish payload data for closing step span later */
  stepFinishPayload?: unknown;
  /** Deferred step-finish chunk for intermediate steps.
   *  llm-execution defers emission so llm-mapping can emit it AFTER tool-result
   *  chunks, matching the regular agent's chunk ordering. */
  deferredStepFinishChunk?: unknown;
}

/**
 * Input for a single tool call step
 */
export interface DurableToolCallInput {
  /** Tool call identifier from the LLM */
  toolCallId: string;
  /** Name of the tool to execute */
  toolName: string;
  /** Arguments for the tool */
  args: Record<string, unknown>;
  /** Provider-specific metadata */
  providerMetadata?: Record<string, unknown>;
  /** Whether the tool was already executed by the provider */
  providerExecuted?: boolean;
  /** Output if provider-executed */
  output?: unknown;
  /** Tool names enabled for the step that produced this call, or null if a processor cleared the restriction */
  activeTools?: string[] | null;
  /** Exported model_step span data so the TOOL_CALL span nests under the LLM call */
  stepSpanData?: unknown;
}

/**
 * Output from a single tool call step
 */
export interface DurableToolCallOutput extends DurableToolCallInput {
  /** Result from tool execution */
  result?: unknown;
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
  /** Updated MessageList state */
  messageListState: SerializedMessageListState;
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
  };
  /** Updated state */
  state: SerializableDurableState;
  /** Processor retry tracking */
  processorRetryCount?: number;
  processorRetryFeedback?: string;
  /** Whether background tasks are still running after this iteration */
  backgroundTaskPending?: boolean;
  /** Whether a delegation hook called ctx.bail() during this iteration */
  delegationBailed?: boolean;
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
}

/**
 * Event types emitted via pubsub for agent streaming
 */
export type AgentStreamEventType =
  | 'chunk'
  | 'step-start'
  | 'step-finish'
  | 'finish'
  | 'error'
  | 'suspended'
  | 'abort'
  | 'iteration-complete';

/**
 * Event emitted via pubsub for agent streaming
 */
export interface AgentStreamEvent<T = unknown> {
  /** Event type */
  type: AgentStreamEventType;
  /** Run identifier */
  runId: string;
  /** Event payload */
  data: T;
}

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
 * Finish event data
 */
export interface AgentFinishEventData {
  output: DurableAgenticLoopOutput['output'];
  stepResult: DurableLLMStepOutput['stepResult'];
}

/**
 * Error event data
 */
export interface AgentErrorEventData {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
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
  /**
   * Marks a minimal cross-process placeholder entry (e.g. seeded by
   * @mastra/inngest resume() to carry an abort controller). Placeholder
   * entries hold no usable tools/model/processors, so
   * `resolveRuntimeDependencies` must rebuild runtime state from the agent
   * registered on the Mastra instance instead of trusting the entry.
   */
  isPlaceholder?: boolean;
  /** Resolved tools with execute functions */
  tools: Record<string, CoreTool>;
  /** SaveQueueManager for message persistence (undefined when memory is not configured) */
  saveQueueManager?: SaveQueueManager;
  /** Memory instance for thread creation and message persistence */
  memory?: MastraMemory;
  /** The language model instance (non-serializable, has doStream method) */
  model: MastraLanguageModel;
  /** Model list for fallback support (stores actual model instances) */
  modelList?: RegistryModelListEntry[];
  /** Workspace for file/sandbox operations (non-serializable) */
  workspace?: Workspace;
  /** Request context for forwarding auth data, feature flags, etc. to tools */
  requestContext?: RequestContext;
  /** Cleanup function to call when run completes */
  cleanup?: () => void;
  /** MessageList for tracking conversation messages (non-serializable) */
  messageList?: MessageList;
  /** Resolved input processors (non-serializable, combined into workflow) */
  inputProcessors?: InputProcessorOrWorkflow[];
  /**
   * Uncombined input processors for `processLLMRequest`.
   * Combined (workflow-wrapped) processors skip `processLLMRequest` in the
   * `ProcessorRunner`; this field stores individual processors so the runner
   * can invoke each processor's `processLLMRequest` method. When absent the
   * durable `llm-execution` step falls back to `inputProcessors`.
   */
  llmRequestInputProcessors?: InputProcessorOrWorkflow[];
  /** Resolved output processors (non-serializable) */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /** Resolved error processors (non-serializable) */
  errorProcessors?: ErrorProcessorOrWorkflow[];
  /** Processor state map (carried across steps) */
  processorStates?: Map<string, ProcessorState>;
  /** Background task manager instance (non-serializable) */
  backgroundTaskManager?: BackgroundTaskManager;
  /** Agent background tasks configuration */
  backgroundTasksConfig?: AgentBackgroundConfig;
  /** Live AGENT_RUN span for this run (non-serializable; used to parent the workflow run) */
  agentSpan?: Span<SpanType.AGENT_RUN>;
  /** Live MODEL_GENERATION span for this run (non-serializable) */
  modelSpan?: AIModelGenerationSpan;
  /**
   * On resume, a fresh AGENT_RUN span is opened for the resumed segment (the
   * original was ended as `suspended`). These override the frozen span IDs so
   * post-resume steps nest under the resumed root and end it on completion.
   */
  resumeAgentSpan?: Span<SpanType.AGENT_RUN>;
  resumeModelSpan?: AIModelGenerationSpan;
  /** Exported forms of the resume spans, read by the workflow steps (same process). */
  resumeAgentSpanData?: unknown;
  resumeModelSpanData?: unknown;
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
  }) => Promise<void>;
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
   * Promise tracking the in-flight workflow execution (or resume) for this
   * run. Resolves once the workflow has fully settled (finished, errored,
   * suspended-and-persisted, or aborted). Used by `generate()` /
   * `resumeGenerate()` to make sure a SUSPENDED snapshot is persisted
   * before they hand control back to the caller. Not part of the public
   * surface — purely an internal coordination primitive.
   */
  workflowExecution?: Promise<unknown>;
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
