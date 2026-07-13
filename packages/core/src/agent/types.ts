import type { GenerateTextOnStepFinishCallback } from '@internal/ai-sdk-v4';
import type { CallSettings } from '@internal/ai-sdk-v5';
import type { ProviderDefinedTool } from '@internal/external-types';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodTypev4 } from 'zod/v4';
import type { ActorSignal } from '../auth/ee';
import type { AgentBackgroundConfig } from '../background-tasks';
import type { MastraBrowser } from '../browser';
import type { AgentChannels } from '../channels/agent-channels';
import type { ChannelConfig } from '../channels/types';
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
import type { ReasoningLevel } from '../loop/types';
import type { Mastra } from '../mastra';
import type { VersionOverrides } from '../mastra/types';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfigInternal, StorageThreadType } from '../memory/types';
import type { NotificationDeliveryPolicyConfig } from '../notifications/delivery-policy';
import type {
  NotificationDeliveryDecision,
  NotificationRecord,
  SendNotificationSignalInput,
} from '../notifications/types';
import type { Span, SpanType, TracingOptions, TracingPolicy, ObservabilityContext } from '../observability';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '../processors/index';
import type { RequestContext } from '../request-context';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import type { SignalProvider } from '../signals/signal-provider';
import type { AgentSkillsInput } from '../skills/types';
import type { MastraModelOutput } from '../stream/base/output';
import type { AgentChunkType, MastraOnFinishCallbackArgs, ModelManagerModelConfig } from '../stream/types';
import type { ToolAction, ToolHooks, VercelTool, VercelToolV5 } from '../tools';
import type { ToolPayloadTransformPolicy } from '../tools/types';
import type { DynamicArgument } from '../types';
import type { MastraVoice } from '../voice';
import type { Workflow } from '../workflows';
import type { AnyWorkspace } from '../workspace';
import type { SkillFormat } from '../workspace/skills';
import type { Agent } from './agent';
import type { AgentExecutionOptions, NetworkOptions } from './agent.types';
import type { MessageList } from './message-list/index';
import type { AgentSignalAttributes, CreatedAgentSignal } from './signals';
import type { SubAgent } from './subagent';
export type {
  MastraDBMessage,
  MastraMessageContentV2,
  MastraMessagePart,
  UIMessageWithMetadata,
  MessageList,
} from './message-list/index';
export type { ReasoningLevel } from '../loop/types';
export type { Message as AiMessageType } from '@internal/ai-sdk-v4';
export type {
  NotificationDeliveryPolicyConfig,
  NotificationDeliveryPolicyDecider,
  NotificationDeliveryPolicyDecision,
  NotificationDeliveryPolicyInput,
} from '../notifications/delivery-policy';
export type {
  NotificationDeliveryAction,
  NotificationDeliveryDecision,
  NotificationDeliveryThreadState,
  NotificationPriority,
  NotificationRecord,
  NotificationSignalAttributes,
  NotificationStatus,
  NotificationSummary,
  SendNotificationSignalInput,
} from '../notifications/types';
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

export type {
  AgentMessageInput,
  AgentSignalAttributes,
  AgentSignalInput as AgentSignal,
  AgentSignalType,
  AgentSignalDataPart,
  AgentStateSignalInput,
  AgentStateSignalMode,
  CreatedAgentSignal,
} from './signals';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalActiveBehavior = 'deliver' | 'persist' | 'discard';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalIdleBehavior = 'wake' | 'persist' | 'discard';

/**
 * Options applied when a signal targets an idle thread.
 *
 * Controls whether the thread should be woken, the signal persisted without
 * waking, or the signal discarded. Also carries optional stream options
 * (e.g. request context) and attributes for the delivery message.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalIfIdleOptions<OUTPUT = unknown> = {
  behavior?: AgentSignalIdleBehavior;
  streamOptions?: AgentExecutionOptions<OUTPUT>;
  attributes?: AgentSignalAttributes;
};

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type SendAgentSignalOptions<OUTPUT = unknown> =
  | {
      runId: string;
      resourceId?: string;
      threadId?: string;
      ifActive?: { behavior?: AgentSignalActiveBehavior; attributes?: AgentSignalAttributes };
      ifIdle?: never;
    }
  | {
      runId?: string;
      resourceId: string;
      threadId: string;
      ifActive?: { behavior?: AgentSignalActiveBehavior; attributes?: AgentSignalAttributes };
      ifIdle?: AgentSignalIfIdleOptions<OUTPUT>;
    };

/**
 * What `sendSignal` decided to do with a signal once active/idle policy was
 * applied. This is the value the {@link SendAgentSignalResult.accepted} promise
 * resolves to.
 *
 * `action` mirrors the winning `behavior` from `ifActive`/`ifIdle` — the value
 * is whichever behavior the runtime actually applied, not the request.
 *
 * `runId` is present only on the members where a run exists (`wake`, `deliver`)
 * and is the authoritative, correlatable id (matching the stream, trace spans,
 * and persisted messages). `persist`/`discard` carry no `runId` because nothing
 * ran; for those, correlate the stored signal via {@link SendAgentSignalResult.signal}'s `id`.
 *
 * - `wake`    — this process started a new run for an idle thread and owns it.
 *               `output` is the run's `MastraModelOutput` for in-process
 *               consumption. Only the runtime that actually runs the agent
 *               resolves to `wake`.
 * - `deliver` — the signal was handed off rather than started here. This covers
 *               a follow-up signal joining an already-active run and the loser
 *               of a cross-process wake race (whose signal is forwarded to the
 *               winning run). No new run was started locally and no stream is
 *               owned; `runId` is the run the signal joined.
 * - `persist` — the signal was written to memory by a `persist` behavior. To
 *               await the storage write, use the top-level `persisted` promise.
 * - `discard` — policy dropped the signal; nothing ran and nothing was stored.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type SendAgentSignalAccepted<OUTPUT = unknown> =
  | { action: 'wake'; runId: string; output: MastraModelOutput<OUTPUT> }
  | { action: 'deliver'; runId: string }
  | { action: 'persist' }
  | { action: 'discard' }
  | { action: 'blocked'; reason: 'thread-blocked'; runId: string };

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export interface SendAgentSignalResult<OUTPUT = unknown> {
  /**
   * Resolves once the runtime has decided what to do with the signal
   * (`wake`/`deliver`/`persist`/`discard`/`blocked`). This settles at decision-time — it
   * never waits for a woken run to finish or for a `persist` write to land.
   *
   * Rejects only when the signal cannot be routed/started at all — for example
   * a misconfigured agent that throws during stream setup (no model, an
   * unsupported model, an FGA denial). A run that fails *after* starting does
   * not reject here; that error surfaces on the `wake` member's `output`.
   *
   * `wake` means this process ran the agent and `output` is its
   * `MastraModelOutput`. A signal queued onto an existing run, or one whose
   * cross-process wake race was lost (and forwarded to the winning run),
   * resolves to `deliver`. `blocked` means the signal targeted a suspended
   * thread that cannot accept a new idle wake. `runId` is present on
   * `wake`/`deliver`/`blocked` only; for `persist`/`discard`, correlate via
   * {@link signal}'s `id`. To await a `persist` write, use {@link persisted}.
   */
  accepted: Promise<SendAgentSignalAccepted<OUTPUT>>;
  signal: CreatedAgentSignal;
  /** Resolves when a `persist` behavior finishes writing the signal to memory. */
  persisted?: Promise<void>;
}

/**
 * @experimental Agent message APIs are experimental and may change in a future release.
 */
export type SendAgentMessageOptions<OUTPUT = unknown> = SendAgentSignalOptions<OUTPUT>;

/**
 * @experimental Agent message APIs are experimental and may change in a future release.
 */
export type SendAgentMessageResult<OUTPUT = unknown> = SendAgentSignalResult<OUTPUT>;

/**
 * @experimental Agent message APIs are experimental and may change in a future release.
 */
export type QueueAgentMessageOptions<OUTPUT = unknown> = SendAgentSignalOptions<OUTPUT>;

/**
 * @experimental Agent message APIs are experimental and may change in a future release.
 */
export type QueueAgentMessageResult<OUTPUT = unknown> = SendAgentSignalResult<OUTPUT>;

/**
 * @experimental Agent stream resume APIs are experimental and may change in a future release.
 */
export type SendAgentStreamResumeOptions<OUTPUT = unknown> = {
  threadId: string;
  resourceId: string;
  runId: string;
  toolCallId?: string;
  resumeData: unknown;
  streamOptions?: AgentExecutionOptions<OUTPUT>;
};

/**
 * @experimental Agent stream resume APIs are experimental and may change in a future release.
 */
export interface SendAgentStreamResumeResult {
  accepted: true;
  runId: string;
  toolCallId?: string;
}

/**
 * @experimental Agent state signal APIs are experimental and may change in a future release.
 */
export type SendAgentStateSignalOptions<OUTPUT = unknown> = SendAgentSignalOptions<OUTPUT>;

/**
 * @experimental Agent state signal APIs are experimental and may change in a future release.
 */
export type SendAgentStateSignalResult<OUTPUT = unknown> =
  | (SendAgentSignalResult<OUTPUT> & { skipped?: false })
  | { skipped: true; reason: 'unchanged'; signal?: undefined };

/**
 * @experimental Agent notification signal APIs are experimental and may change in a future release.
 */
export type AgentNotificationSignal = SendNotificationSignalInput;

/**
 * @experimental Agent notification signal APIs are experimental and may change in a future release.
 */
export type SendAgentNotificationSignalOptions<OUTPUT = unknown> = Extract<
  SendAgentSignalOptions<OUTPUT>,
  { resourceId: string; threadId: string }
>;

/**
 * @experimental Agent notification signal APIs are experimental and may change in a future release.
 */
export type AgentNotificationConfig = {
  deliveryPolicy?: NotificationDeliveryPolicyConfig;
};

/**
 * @experimental Agent notification signal APIs are experimental and may change in a future release.
 */
export type SendAgentNotificationSignalResult<OUTPUT = unknown> = {
  record: NotificationRecord;
  /**
   * The delivery-policy verdict for this notification (deliver, summarize,
   * persist, or discard). Use this to determine what the notification policy
   * decided to do with the record.
   */
  decision: NotificationDeliveryDecision;
  runId?: string;
  signal?: CreatedAgentSignal;
  persisted?: Promise<void>;
  /**
   * The underlying signal's routing outcome. Present only when the notification
   * actually emitted a signal (deliver/summarize paths); absent when the policy
   * dropped or deferred the notification without sending a signal. Resolves with
   * the routing decision and rejects if the underlying agent is misconfigured.
   * See {@link SendAgentSignalResult.accepted}.
   *
   * @experimental
   */
  accepted?: Promise<SendAgentSignalAccepted<OUTPUT>>;
};

export interface AgentThreadRun<OUTPUT = unknown> {
  output: MastraModelOutput<OUTPUT>;
  readonly fullStream: ReadableStream<any>;
  runId: string;
  threadId: string;
  resourceId?: string;
  cleanup: () => void;
}

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export interface AgentSubscribeToThreadOptions {
  resourceId?: string;
  threadId: string;
}

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
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
   * Whether to use prompt injection instead of native response format to coerce the LLM to respond with JSON text.
   * true and 'system' inject JSON instructions into the leading system message.
   * 'inline' appends JSON instructions to the latest user message.
   * false or omitted uses the provider's native response format.
   */
  jsonPromptInjection?: boolean | 'system' | 'inline';

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

export type ModelFallbackSettings = Omit<CallSettings, 'abortSignal' | 'maxRetries' | 'headers'> & {
  /**
   * Reasoning effort level for the model. Controls how much reasoning
   * the model performs before generating a response.
   *
   * Only effective with LanguageModelV4 (AI SDK v7) model providers that support reasoning.
   * When used with older model providers (V2/V3), this option is a no-op.
   *
   * @default undefined (provider default behavior)
   */
  reasoning?: ReasoningLevel;
};

export type ModelWithRetries = {
  id?: string;
  model: DynamicArgument<MastraModelConfig>;
  maxRetries?: number; // defaults to agent-level maxRetries
  enabled?: boolean; // defaults to true
  modelSettings?: DynamicArgument<ModelFallbackSettings>;
  providerOptions?: DynamicArgument<ProviderOptions>;
  headers?: DynamicArgument<Record<string, string>>;
};

export type AgentEditorConfig =
  | false
  | {
      instructions?: boolean;
      tools?: boolean | { description?: boolean };
    };

/**
 * Agent-level goal configuration. When set, the agent gains a native goal
 * mechanism: an objective set via {@link Agent.setObjective} is judged in the
 * execution loop (like `isTaskComplete`) and the agent keeps working until the
 * objective is complete or the run budget is exhausted.
 *
 * These values are the defaults; the per-thread {@link GoalObjectiveRecord} in
 * thread state overrides them when it carries a value. A judge model is required
 * at runtime (resolved from the objective record or `judge` here) — without one
 * the goal step is a no-op.
 *
 * @experimental Agent goals are experimental and may change in a future release.
 */
export interface GoalConfig {
  /**
   * Judge model used to evaluate goal completion. Required (here or per
   * objective) for the goal to do anything. Defaults to `undefined` (no-op).
   *
   * May be a model id / model object, or a resolver function (so a consumer can
   * inject provider credentials and read the current judge selection at runtime);
   * the function may return `undefined` to keep the goal step a no-op.
   */
  judge?: DynamicArgument<MastraModelConfig | undefined>;
  /** Max goal evaluations before the goal stops. Defaults to 50. */
  maxRuns?: number;
  /** Extra judge guidance. Defaults to the built-in goal judge prompt. */
  prompt?: string;
  /**
   * Read-only verification tools the default goal judge may call before deciding
   * (e.g. file read / search tools), letting it independently confirm the work
   * was actually done rather than grading the assistant's text alone.
   *
   * May be a static toolset or a resolver function — use the function form when
   * the tools depend on per-request state (e.g. the active workspace), mirroring
   * `judge`. Ignored when a custom `scorer` is supplied (that scorer brings its
   * own judging). When omitted, the default judge is text-only.
   */
  tools?: DynamicArgument<ToolsInput | undefined>;
  /**
   * Max steps the judge agent may take per evaluation (its internal agentic-loop
   * budget). When omitted the judge uses the model loop's default (5).
   */
  maxSteps?: number;
  /**
   * Custom goal scorer (a {@link MastraScorer} or a registered scorer id). When
   * omitted, a default rubric scorer judges the objective with the judge model.
   */
  scorer?: MastraScorer | string;
}

interface AgentConfigBase<
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
   * Metadata for classifying or filtering the agent in clients. Can be a static
   * record or a function that resolves the metadata from the request context.
   */
  metadata?: DynamicArgument<Record<string, unknown>, TRequestContext>;
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
   * Hooks that run before and after any tool call made by this agent.
   * Per-execution hooks passed to `generate`, `stream`, `generateLegacy`, or `streamLegacy` override matching hooks here.
   * If a workspace also defines tool hooks, workspace hooks wrap the workspace tool first, then agent hooks wrap the exposed tool call.
   */
  hooks?: ToolHooks;
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
   * Pub/sub system for coordinating runtime services such as thread signals.
   * When omitted, the agent uses its Mastra instance pubsub or the default in-memory pubsub.
   */
  pubsub?: PubSub;
  /**
   * Sub-Agents that the agent can access. Can be provided statically or resolved dynamically.
   */
  agents?: DynamicArgument<Record<string, SubAgent<string, TRequestContext>>, TRequestContext>;
  /**
   * Scoring configuration for runtime evaluation and observability. Can be static or dynamically provided.
   */
  scorers?: DynamicArgument<MastraScorers, TRequestContext>;

  /**
   * Memory module used for storing and retrieving stateful context.
   */
  memory?: DynamicArgument<MastraMemory, TRequestContext>;
  /**
   * Skills that guide agent behavior — reusable instructions the model loads on demand.
   *
   * Accepts an array of path strings (pointing to SKILL.md directories on disk) and/or
   * inline skills created with `createSkill()`. Can also be a dynamic function that
   * resolves skills per request.
   *
   * Skills work without a Workspace. When both `skills` and `workspace.skills` are
   * configured, they are merged (agent-level skills win on name conflicts).
   *
   * @example Path-based skills
   * ```typescript
   * skills: ['./skills/review', './skills/testing']
   * ```
   *
   * @example Inline skills
   * ```typescript
   * import { createSkill } from '@mastra/core/skills';
   *
   * skills: [
   *   createSkill({
   *     name: 'code-review',
   *     description: 'Use when reviewing code.',
   *     instructions: 'When reviewing code...',
   *   }),
   * ]
   * ```
   *
   * @example Dynamic skills
   * ```typescript
   * skills: ({ requestContext }) => {
   *   const tier = requestContext.get('tier');
   *   return tier === 'premium'
   *     ? ['./skills/basic', './skills/premium']
   *     : ['./skills/basic'];
   * }
   * ```
   */
  skills?: AgentSkillsInput;
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
   * Voice settings for speech input and output. Can be provided statically or resolved dynamically per request.
   *
   * Provide a resolver (`({ requestContext }) => new SomeVoice(...)`) to give each request/session its own
   * voice instance. This is required for realtime / speech-to-speech providers, where concurrent live sessions
   * must not share a single mutable instance (ws, tools, instructions, request context). The caller owns the
   * lifecycle (e.g. `disconnect()`) of a resolver-produced instance.
   *
   * A static `MastraVoice` remains shared across requests, which is appropriate for one-shot TTS.
   */
  voice?: DynamicArgument<MastraVoice, TRequestContext>;
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
  /**
   * Notification delivery configuration for record-first notification signals.
   */
  notifications?: AgentNotificationConfig;
  /**
   * Signal providers that monitor external sources and push
   * notification signals into agent threads.
   *
   * Each provider is automatically registered as both an input and
   * output processor, and connected to this agent instance.
   *
   * @example
   * ```ts
   * const agent = new Agent({
   *   signals: [new GithubSignals({ cwd: project.rootPath })],
   * });
   * ```
   *
   * @experimental Agent signals are experimental and may change in a future release.
   */
  signals?: SignalProvider[];
  /**
   * Native goal configuration. When set, an objective set via
   * {@link Agent.setObjective} is judged in the execution loop and the agent
   * keeps working until the objective is complete or the budget is exhausted.
   *
   * @experimental Agent goals are experimental and may change in a future release.
   */
  goal?: GoalConfig;
  /**
   * Optional agent-level transform policy for tool payloads before they are
   * serialized into display streams or user-visible transcripts.
   */
  transform?: ToolPayloadTransformPolicy;
}

/**
 * Whether a given `editor` config hands a field to Studio (`true`) so that
 * field becomes owned by Studio and must NOT be provided in code.
 *
 * To add a new editable field, add an `Owns*` helper here and a corresponding
 * clause to {@link AgentEditableFieldConfig} — no combinatorial union needed.
 */
type EditorOwnsInstructions<TEditor> = TEditor extends { instructions: true } ? true : false;
type EditorOwnsToolMembership<TEditor> = TEditor extends { tools: true } ? true : false;

/**
 * Resolves the `instructions`/`tools` portion of an agent config from the
 * `editor` config inferred at `new Agent({...})`.
 *
 * `instructions` and `tools` are owned by *either* code or Studio, never both.
 * When `editor` hands a field to Studio (`instructions: true` / `tools: true`),
 * that field is forbidden in code (`?: never`); otherwise it keeps its normal
 * code-owned shape. Tool *descriptions* (`tools: { description: true }`) keep
 * tool membership in code, so they fall under the code-owned case.
 */
type AgentEditableFieldConfig<
  TTools extends ToolsInput,
  TRequestContext extends Record<string, any> | unknown,
  TEditor extends AgentEditorConfig | undefined,
> = (EditorOwnsInstructions<TEditor> extends true
  ? { instructions?: never }
  : { instructions: DynamicArgument<AgentInstructions, TRequestContext> }) &
  (EditorOwnsToolMembership<TEditor> extends true
    ? { tools?: never }
    : { tools?: DynamicArgument<TTools, TRequestContext> });

export type AgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
  TRequestContext extends Record<string, any> | unknown = unknown,
  TEditor extends AgentEditorConfig | undefined = AgentEditorConfig | undefined,
> = Omit<AgentConfigBase<TAgentId, TTools, TOutput, TRequestContext>, 'instructions' | 'tools' | 'editor'> & {
  editor?: TEditor;
} & AgentEditableFieldConfig<TTools, TRequestContext, TEditor>;

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
  /** Per-execution hooks that run before and after tool calls, overriding matching agent-level hooks. */
  hooks?: ToolHooks;
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
  /** Trusted server-side signal for this agent FGA check. */
  actor?: ActorSignal;
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
  /** Per-execution hooks that run before and after tool calls, overriding matching agent-level hooks. */
  hooks?: ToolHooks;
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
  /** Trusted server-side signal for this agent FGA check. */
  actor?: ActorSignal;
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
