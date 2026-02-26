import type {
  LanguageModelV2FinishReason,
  LanguageModelV2CallWarning,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import type { LanguageModelRequestMetadata, LogProbs as LanguageModelV1LogProbs } from '@internal/ai-sdk-v4';
import type { LanguageModelUsage } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod';

import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfig } from '../../memory/types';
import type { RequestContext } from '../../request-context';
import type { ChunkType } from '../../stream/types';
import type { CoreTool } from '../../tools/types';
import type { Workspace } from '../../workspace';
import type { SerializedMessageListState } from '../message-list/state';
import type { SaveQueueManager } from '../save-queue';

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
}

/**
 * Options for durable agent execution (serializable subset)
 */
export interface SerializableDurableOptions {
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
  /** Tool selection strategy */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Temperature for LLM sampling */
  temperature?: number;
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
}

/**
 * Output from a single LLM execution step
 */
export interface DurableLLMStepOutput {
  /** Updated MessageList state after LLM execution */
  messageListState: SerializedMessageListState;
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
export type AgentStreamEventType = 'chunk' | 'step-start' | 'step-finish' | 'finish' | 'error' | 'suspended';

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
 * Model list entry stored in registry (actual model instances, not serialized config)
 */
export interface RegistryModelListEntry {
  id: string;
  model: MastraLanguageModel;
  maxRetries: number;
  enabled: boolean;
}

/**
 * Registry entry for a single run's non-serializable state
 */
export interface RunRegistryEntry {
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
