import type { GenerateTextOnStepFinishCallback } from '@internal/ai-sdk-v4';
import type { CallSettings } from '@internal/ai-sdk-v5';
import type { ProviderDefinedTool } from '@internal/external-types';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodTypev4 } from 'zod/v4';
import type { AgentBackgroundConfig } from '../background-tasks';
import type { MastraBrowser } from '../browser';
import type { AgentChannels, ChannelConfig } from '../channels/agent-channels';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../evals';
import type { PubSub } from '../events/pubsub';
import type {
  CoreMessage,
  DefaultLLMStreamOptions,
  DefaultLLMStreamObjectOptions,
  DefaultLLMTextObjectOptions,
  DefaultLLMTextOptions,
  OutputType,
  SystemMessage,
  MastraModelConfig,
  OpenAICompatibleConfig,
} from '../llm';
import type { ModelRouterModelId } from '../llm/model';
import type {
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  StreamObjectOnFinishCallback,
} from '../llm/model/base.types';
import type { ProviderOptions } from '../llm/model/provider-options';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { VersionOverrides } from '../mastra/types';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfigInternal, StorageThreadType } from '../memory/types';
import type { Span, SpanType, TracingOptions, TracingPolicy, ObservabilityContext } from '../observability';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '../processors/index';
import type { RequestContext } from '../request-context';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { MastraModelOutput } from '../stream/base/output';
import type { AgentChunkType, MastraOnFinishCallbackArgs, ModelManagerModelConfig } from '../stream/types';
import type { ToolAction, VercelTool, VercelToolV5 } from '../tools';
import type { DynamicArgument } from '../types';
import type { MastraVoice } from '../voice';
import type { Workflow } from '../workflows';
import type { AnyWorkspace } from '../workspace';
import type { SkillFormat } from '../workspace/skills';
import type { Agent } from './agent';
import type { AgentExecutionOptions, NetworkOptions } from './agent.types';
import type { MessageList } from './message-list/index';
export type {
  MastraDBMessage,
  MastraMessageContentV2,
  MastraMessagePart,
  UIMessageWithMetadata,
  MessageList,
} from './message-list/index';
export type { Message as AiMessageType } from '@internal/ai-sdk-v4';
export type { LLMStepResult } from '../stream/types';
export type { MastraBrowser } from '../browser/browser';
// Screencast types now on MastraBrowser directly
export type { ScreencastOptions, ScreencastStream } from '../browser/browser';

export type ZodSchema = ZodSchemaV3 | ZodTypev4;

/**
 * Accepts Mastra tools, Vercel AI SDK tools, and provider-defined tools
 * (e.g., google.tools.googleSearch()).
 */
export type ToolsInput = Record<
  string,
  ToolAction<any, any, any, any, any> | VercelTool | VercelToolV5 | ProviderDefinedTool
>;

export type AgentInstructions = SystemMessage;

export type { AgentSignalInput as AgentSignal, AgentSignalType, AgentSignalDataPart } from './signals';

export type SendAgentSignalOptions<OUTPUT = unknown> =
  | {
      runId: string;
      resourceId?: string;
      threadId?: string;
      ifIdle?: { streamOptions: AgentExecutionOptions<OUTPUT> };
    }
  | {
      runId?: string;
      resourceId: string;
      threadId: string;
      ifIdle?: { streamOptions: AgentExecutionOptions<OUTPUT> };
    };

export interface AgentThreadRun<OUTPUT = unknown> {
  output: MastraModelOutput<OUTPUT>;
  readonly fullStream: ReadableStream<any>;
  runId: string;
  threadId: string;
  resourceId?: string;
  cleanup: () => void;
}

export interface AgentSubscribeToThreadOptions {
  resourceId?: string;
  threadId: string;
}

export interface AgentThreadSubscription<OUTPUT = unknown> {
  stream: AsyncIterable<AgentChunkType<OUTPUT>>;
  activeRunId: () => string | null;
  abort: () => boolean;
  unsubscribe: () => void;
}

export type ToolsetsInput = Record<string, ToolsInput>;

type FallbackFields<OUTPUT = undefined> =
  | { errorStrategy?: 'strict' | 'warn'; fallbackValue?: never }
  | { errorStrategy: 'fallback'; fallbackValue: OUTPUT };

export type StructuredOutputOptionsBase<OUTPUT = {}> = {
  /** Model to use for the internal structuring agent. If not provided, falls back to the agent's model */
  model?: MastraModelConfig;
  /**
   * Custom instructions for the structuring agent.
   * If not provided, will generate instructions based on the schema.
   */
  instructions?: string;

  /**
   * When true and `model` is also provided, reuse the parent agent for the separate
   * structuring pass. If a thread is available, Mastra attaches read-only memory so
   * the structuring model has full conversation context.
   */
  useAgent?: boolean;

  /**
   * Whether to use system prompt injection instead of native response format to coerce the LLM to respond with json text if the LLM does not natively support structured outputs.
   */
  jsonPromptInjection?: boolean;

  /**
   * Optional logger instance for structured logging
   */
  logger?: IMastraLogger;

  /**
   * Provider-specific options passed to the internal structuring agent.
   * Use this to control model behavior like reasoning effort for thinking models.
   *
   * @example
   * ```ts
   * providerOptions: {
   *   openai: { reasoningEffort: 'low' }
   * }
   * ```
   */
  providerOptions?: ProviderOptions;
} & FallbackFields<OUTPUT>;

export type StructuredOutputOptions<OUTPUT = {}> = StructuredOutputOptionsBase<OUTPUT> & {
  /** Zod schema to validate the output against */
  schema: StandardSchemaWithJSON<OUTPUT>;
};

export type PublicStructuredOutputOptions<OUTPUT = {}> = StructuredOutputOptionsBase<OUTPUT> & {
  schema: PublicSchema<OUTPUT>;
};

export type SerializableStructuredOutputOptions<OUTPUT = {}> = Omit<StructuredOutputOptionsBase<OUTPUT>, 'model'> & {
  model?: ModelRouterModelId | OpenAICompatibleConfig;
  /** JSON Schema to validate the output against */
  schema: JSONSchema7;
};

/**
 * Provide options while creating an agent.
 */
export interface AgentCreateOptions {
  tracingPolicy?: TracingPolicy;
}

export type ModelFallbackSettings = Omit<CallSettings, 'abortSignal' | 'maxRetries' | 'headers'>;

export type ModelWithRetries = {
  id?: string;
  model: DynamicArgument<MastraModelConfig>;
  maxRetries?: number; // defaults to agent-level maxRetries
  enabled?: boolean; // defaults to true
  modelSettings?: DynamicArgument<ModelFallbackSettings>;
  providerOptions?: DynamicArgument<ProviderOptions>;
  headers?: DynamicArgument<Record<string, string>>;
};

export interface AgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
  TRequestContext extends Record<string, any> | unknown = unknown,
> {
  /**
   * Identifier for the agent.
   */
  id: TAgentId;
  /**
   * Unique identifier for the agent.
   */
  name: string;
  /**
   * Description of the agent's purpose and capabilities.
   */
  description?: string;
  /**
   * Instructions that guide the agent's behavior. Can be a string, array of strings, system message object,
   * array of system messages, or a function that returns any of these types dynamically.
   */
  instructions: DynamicArgument<AgentInstructions, TRequestContext>;
  /**
   * The language model used by the agent. Can be provided statically or resolved at runtime.
   * Supports DynamicArgument for both single models and model fallback arrays.
   *
   * @example Static single model (magic string)
   * ```typescript
   * model: 'openai/gpt-4'
   * ```
   *
   * @example Static single model (config object)
   * ```typescript
   * model: {
   *   id: 'openai/gpt-4',
   *   apiKey: process.env.OPENAI_API_KEY
   * }
   * ```
   *
   * @example Static fallback array
   * ```typescript
   * model: [
   *   { model: 'openai/gpt-4', maxRetries: 2 },
   *   { model: 'anthropic/claude-3-opus', maxRetries: 1 }
   * ]
   * ```
   *
   * @example Static fallback array with per-entry settings
   * ```typescript
   * model: [
   *   {
   *     model: 'google/gemini-2.5-flash',
   *     maxRetries: 2,
   *     modelSettings: { temperature: 0.3 },
   *     providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
   *   },
   *   {
   *     model: 'openai/gpt-5-mini',
   *     maxRetries: 2,
   *     modelSettings: { temperature: 0.7 },
   *     providerOptions: { openai: { reasoningEffort: 'low' } },
   *   },
   * ]
   * ```
   *
   * @example Dynamic single model (tier-based selection)
   * ```typescript
   * model: ({ requestContext }) => {
   *   const tier = requestContext.get('tier');
   *   return tier === 'premium' ? 'openai/gpt-4' : 'openai/gpt-3.5-turbo';
   * }
   * ```
   *
   * @example Dynamic fallback array (tier-based fallback configuration)
   * ```typescript
   * model: ({ requestContext }) => {
   *   const tier = requestContext.get('tier');
   *   if (tier === 'premium') {
   *     return [
   *       { model: 'openai/gpt-4', maxRetries: 2 },
   *       { model: 'anthropic/claude-3-opus', maxRetries: 1 }
   *     ];
   *   }
   *   return [{ model: 'openai/gpt-3.5-turbo', maxRetries: 1 }];
   * }
   * ```
   *
   * @example Dynamic fallback array with nested dynamic models
   * ```typescript
   * model: ({ requestContext }) => {
   *   const region = requestContext.get('region');
   *   return [
   *     {
   *       // Each model can also be dynamic
   *       model: ({ requestContext }) => {
   *         return region === 'eu' ? 'openai/gpt-4-eu' : 'openai/gpt-4';
   *       },
   *       maxRetries: 2
   *     },
   *     { model: 'openai/gpt-3.5-turbo', maxRetries: 1 }
   *   ];
   * }
   * ```
   */
  model: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext>;
  /**
   * Maximum number of retries for model calls in case of failure.
   * @defaultValue 0
   */
  maxRetries?: number;
  /**
   * Tools that the agent can access. Can be provided statically or resolved dynamically.
   */
  tools?: DynamicArgument<TTools, TRequestContext>;
  /**
   * Workflows that the agent can execute. Can be static or dynamically resolved.
   */
  workflows?: DynamicArgument<Record<string, Workflow<any, any, any, any, any, any, any, any>>, TRequestContext>;
  /**
   * Default options used when calling `generate()`.
   */
  defaultGenerateOptionsLegacy?: DynamicArgument<AgentGenerateOptions, TRequestContext>;
  /**
   * Default options used when calling `stream()`.
   */
  defaultStreamOptionsLegacy?: DynamicArgument<AgentStreamOptions, TRequestContext>;
  /**
   * Default options used when calling `stream()` in vNext mode.
   */
  defaultOptions?: DynamicArgument<AgentExecutionOptions<TOutput>, TRequestContext>;
  /**
   * Default options used when calling `network()`.
   * These are merged with options passed to each network() call.
   *
   * @example
   * ```typescript
   * const agent = new Agent({
   *   // ...
   *   defaultNetworkOptions: {
   *     maxSteps: 20,
   *     routing: {
   *       verboseIntrospection: true,
   *     },
   *     completion: {
   *       scorers: [testsScorer, buildScorer],
   *       strategy: 'all',
   *     },
   *     onIterationComplete: ({ iteration, isComplete }) => {
   *       console.log(`Iteration ${iteration} complete: ${isComplete}`);
   *     },
   *   },
   * });
   * ```
   */
  defaultNetworkOptions?: DynamicArgument<NetworkOptions, TRequestContext>;
  /**
   * Reference to the Mastra runtime instance (injected automatically).
   */
  mastra?: Mastra;
  /**
   * Sub-Agents that the agent can access. Can be provided statically or resolved dynamically.
   */
  agents?: DynamicArgument<Record<string, Agent>, TRequestContext>;
  /**
   * Scoring configuration for runtime evaluation and observability. Can be static or dynamically provided.
   */
  scorers?: DynamicArgument<MastraScorers, TRequestContext>;

  /**
   * Memory module used for storing and retrieving stateful context.
   */
  memory?: DynamicArgument<MastraMemory, TRequestContext>;
  /**
   * Format for skill information injection when workspace has skills.
   * @default 'xml'
   */
  skillsFormat?: SkillFormat;
  /**
   * Browser for web automation capabilities.
   * When configured, browser tools are automatically injected into the agent.
   * Accessible via agent.browser for server-side features like screencast.
   */
  browser?: MastraBrowser;
  /**
   * Voice settings for speech input and output.
   */
  voice?: MastraVoice;
  /**
   * Messaging channels the agent communicates over (e.g. Slack, Discord).
   *
   * @example
   * ```ts
   * channels: {
   *   adapters: {
   *     discord: createDiscordAdapter(),
   *     slack: { adapter: createSlackAdapter(), cards: false },
   *   },
   *   handlers: {
   *     // Wrap default DM handler with logging
   *     onDirectMessage: async (thread, msg, defaultHandler) => {
   *       console.log('Received DM:', msg.text);
   *       await defaultHandler(thread, msg);
   *     },
   *     // Disable mention handling
   *     onMention: false,
   *   },
   * }
   * ```
   *
   * For full control, pass an `AgentChannels` instance directly.
   */
  channels?: ChannelConfig | AgentChannels;
  /**
   * Workspace for file storage and code execution.
   * When configured, workspace tools are automatically injected into the agent.
   */
  workspace?: DynamicArgument<AnyWorkspace | undefined, TRequestContext>;
  /**
   * Input processors that can modify or validate messages before they are processed by the agent.
   * These can be individual processors (implementing `processInput` or `processInputStep`) or
   * processor workflows (created with `createWorkflow` using `ProcessorStepSchema`).
   */
  inputProcessors?: DynamicArgument<InputProcessorOrWorkflow[], TRequestContext>;
  /**
   * Output processors that can modify or validate messages from the agent, before it is sent to the client.
   * These can be individual processors (implementing `processOutputResult`, `processOutputStream`, or `processOutputStep`) or
   * processor workflows (created with `createWorkflow` using `ProcessorStepSchema`).
   */
  outputProcessors?: DynamicArgument<OutputProcessorOrWorkflow[], TRequestContext>;
  /**
   * Maximum number of times processors can trigger a retry per generation.
   * When a processor calls abort({ retry: true }), the agent will retry with feedback.
   * This limit prevents infinite retry loops.
   * If not set, no retries are performed.
   */
  maxProcessorRetries?: number;
  /**
   * Error processors that handle LLM API rejections.
   * These implement `processAPIError` and can inspect the error, modify messages, and signal a retry.
   * Error processors can also be placed in `inputProcessors` or `outputProcessors`.
   */
  errorProcessors?: DynamicArgument<ErrorProcessorOrWorkflow[], TRequestContext>;
  /**
   * Options to pass to the agent upon creation.
   */
  options?: AgentCreateOptions;
  /**
   * Raw storage configuration this agent was created from.
   * Set when the agent is hydrated from a stored config.
   */
  rawConfig?: Record<string, unknown>;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema at the start of generate() and stream() calls.
   * If validation fails, an error is thrown.
   */
  requestContextSchema?: PublicSchema<TRequestContext>;
  /**
   * Background task configuration for this agent.
   * Controls which tools can run in the background and their behavior.
   */
  backgroundTasks?: AgentBackgroundConfig;
}

export type AgentMemoryOption = {
  thread: string | (Partial<StorageThreadType> & { id: string });
  resource?: string;
  options?: MemoryConfigInternal;
};

/**
 * Options for generating responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema or JSON schema)
 * @template EXPERIMENTAL_OUTPUT - The schema type for structured output generation alongside tool calls (Zod schema or JSON schema)
 */
export type AgentGenerateOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: SystemMessage;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired after each generation step completes */
  onStepFinish?: OUTPUT extends undefined ? GenerateTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output, does not work with tools, use experimental_output instead */
  output?: OutputType | OUTPUT;
  /** Schema for structured output generation alongside tool calls. */
  experimental_output?: EXPERIMENTAL_OUTPUT;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** RequestContext for dependency injection */
  requestContext?: RequestContext;
  /**
   * Per-invocation version overrides for sub-agents (and future primitives).
   * Merged on top of Mastra instance-level versions and propagated via requestContext.
   *
   * NOTE: This field is intentionally duplicated across AgentGenerateOptions,
   * AgentStreamOptions, and AgentExecutionOptionsBase because these types are
   * independent (generate/stream options do not extend the base). Do not remove.
   */
  versions?: VersionOverrides;
  /** Scorers to use for this generation */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
  /** Whether to return the input required to run scorers for agents, defaults to false */
  returnScorerData?: boolean;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
  /** Input processors to use for this generation call (overrides agent's default) */
  inputProcessors?: InputProcessorOrWorkflow[];
  /** Output processors to use for this generation call (overrides agent's default) */
  outputProcessors?: OutputProcessorOrWorkflow[];
  /**
   * Maximum number of times processors can trigger a retry for this generation.
   * Overrides agent's default maxProcessorRetries.
   * If not set, no retries are performed.
   */
  maxProcessorRetries?: number;
  /** Error processors to use for this generation call (overrides agent's default) */
  errorProcessors?: ErrorProcessorOrWorkflow[];
  /** tracing options for starting new traces */
  tracingOptions?: TracingOptions;
  /** Provider-specific options for supported AI SDK packages (Anthropic, Google, OpenAI, xAI) */
  providerOptions?: ProviderOptions;
} & Partial<ObservabilityContext> &
  (
    | {
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        resourceId?: undefined;
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        threadId?: undefined;
      }
    | {
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        resourceId: string;
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        threadId: string;
      }
  ) &
  (OUTPUT extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

/**
 * Options for streaming responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema or JSON schema)
 * @template EXPERIMENTAL_OUTPUT - The schema type for structured output generation alongside tool calls (Zod schema or JSON schema)
 */
export type AgentStreamOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: SystemMessage;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /**
   * @deprecated Use the `memory` property instead for all memory-related options.
   */
  memoryOptions?: MemoryConfigInternal;
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired when streaming completes */
  onFinish?: OUTPUT extends undefined ? StreamTextOnFinishCallback<any> : StreamObjectOnFinishCallback<OUTPUT>;
  /** Callback fired after each generation step completes */
  onStepFinish?: OUTPUT extends undefined ? StreamTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output */
  output?: OutputType | OUTPUT;
  /** Temperature parameter for controlling randomness */
  temperature?: number;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Experimental schema for structured output */
  experimental_output?: EXPERIMENTAL_OUTPUT;
  /** RequestContext for dependency injection */
  requestContext?: RequestContext;
  /**
   * Per-invocation version overrides for sub-agents (and future primitives).
   * Merged on top of Mastra instance-level versions and propagated via requestContext.
   *
   * NOTE: This field is intentionally duplicated across AgentGenerateOptions,
   * AgentStreamOptions, and AgentExecutionOptionsBase because these types are
   * independent (generate/stream options do not extend the base). Do not remove.
   */
  versions?: VersionOverrides;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
  /** Input processors to use for this generation call (overrides agent's default) */
  inputProcessors?: InputProcessorOrWorkflow[];
  /** tracing options for starting new traces */
  tracingOptions?: TracingOptions;
  /** Scorers to use for this generation */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
  /** Provider-specific options for supported AI SDK packages (Anthropic, Google, OpenAI, xAI) */
  providerOptions?: ProviderOptions;
} & Partial<ObservabilityContext> &
  (
    | {
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        resourceId?: undefined;
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        threadId?: undefined;
      }
    | {
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        resourceId: string;
        /**
         * @deprecated Use the `memory` property instead for all memory-related options.
         */
        threadId: string;
      }
  ) &
  (OUTPUT extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);

export type AgentModelManagerConfig = ModelManagerModelConfig & { enabled: boolean };

export type AgentExecuteOnFinishOptions = {
  runId: string;
  result: MastraOnFinishCallbackArgs & { object?: unknown };
  thread: StorageThreadType | null | undefined;
  readOnlyMemory?: boolean;
  threadId?: string;
  resourceId?: string;
  requestContext: RequestContext;
  agentSpan?: Span<SpanType.AGENT_RUN>;
  memoryConfig: MemoryConfigInternal | undefined;
  outputText: string;
  messageList: MessageList;
  threadExists: boolean;
  structuredOutput?: boolean;
  overrideScorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
};

export type AgentMethodType = 'generate' | 'stream' | 'generateLegacy' | 'streamLegacy';

// =============================================================================
// Durable Agent Types
// =============================================================================

/**
 * Interface for durable agent wrappers (e.g., InngestAgent).
 *
 * Durable agents wrap a regular Agent with execution engine-specific
 * capabilities (like Inngest's durable execution). They expose the
 * underlying agent and any workflows that need to be registered with Mastra.
 *
 * The `stream()` method must return a MastraModelOutput (same as Agent.stream())
 * to maintain compatibility with the server handlers.
 */
export interface DurableAgentLike {
  /** Agent ID */
  readonly id: string;
  /** Agent name */
  readonly name: string;
  /** The underlying Mastra Agent */
  readonly agent: Agent<any, any, any>;
  /**
   * Stream a response using durable execution.
   * Must return MastraModelOutput to be compatible with Agent.stream().
   */
  stream(messages: any, options?: any): Promise<any>;
  /**
   * The PubSub instance used by this durable agent for streaming events.
   * Used by server handlers to subscribe to the correct event bus when
   * observing/reconnecting to agent streams.
   */
  readonly pubsub?: PubSub;
  /**
   * Get workflows that need to be registered with Mastra.
   * Called during agent registration to auto-register durable execution workflows.
   */
  getDurableWorkflows?(): Workflow<any, any, any, any, any, any, any>[];
  /**
   * Set the Mastra instance for observability and other services.
   * Called by Mastra during agent registration.
   * @internal
   */
  __setMastra?(mastra: any): void;

  /**
   * Implementations may proxy all Agent methods to the underlying agent.
   * For example, InngestAgent uses a Proxy that forwards generate(), listTools(),
   * getMemory(), etc. to the wrapped Agent instance.
   */
  [key: string]: any;
}

/**
 * Type guard to check if an object is a DurableAgentLike wrapper.
 */
export function isDurableAgentLike(obj: any): obj is DurableAgentLike {
  if (!obj) return false;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    'agent' in obj &&
    obj.agent !== null &&
    typeof obj.agent === 'object' &&
    typeof obj.agent.id === 'string' &&
    typeof obj.stream === 'function'
  );
}
