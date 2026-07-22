import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV4CallOptions } from '@ai-sdk/provider-v7';
import type {
  CallSettings,
  IdGenerator,
  StopCondition as StopConditionV5,
  ToolChoice,
  ToolSet,
} from '@internal/ai-sdk-v5';
import type { StopCondition as StopConditionV6 } from '@internal/ai-v6';
import { z } from 'zod/v4';
import type { IsTaskCompleteConfig, OnIterationCompleteHandler } from '../agent/agent.types';
import type { MessageInput, MessageList } from '../agent/message-list';
import type { SaveQueueManager } from '../agent/save-queue';
import type { CreatedAgentSignal } from '../agent/signals';
import type { GoalConfig, StructuredOutputOptions } from '../agent/types';
import type { ActorSignal } from '../auth/ee';
import type { AgentBackgroundConfig, BackgroundTaskManager, BackgroundTaskManagerConfig } from '../background-tasks';
import type { ModelRouterModelId } from '../llm/model';
import type { ModelMethodType } from '../llm/model/model.loop.types';
import type { MastraLanguageModelV2, OpenAICompatibleConfig, SharedProviderOptions } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory, MemoryConfigInternal } from '../memory';
import type { IModelSpanTracker, ObservabilityContext } from '../observability';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessorState,
} from '../processors';
import type { RequestContext } from '../request-context';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraOnStepFinishCallback,
  ModelManagerModelConfig,
  StreamChunkType,
  StreamTransportRef,
} from '../stream/types';
import type { RequireToolApproval, ToolPayloadTransformPolicy } from '../tools';
import type { MastraIdGenerator } from '../types';
import type { OutputWriter } from '../workflows/types';
import type { Workspace } from '../workspace/workspace';

type StopCondition = StopConditionV5<any> | StopConditionV6<any>;

/**
 * Goal configuration threaded into the loop, resolved from the agent's `goal`
 * config. Structurally the agent {@link GoalConfig}; the goal step resolves the
 * effective per-thread settings (overriding these with the objective record).
 */
export type GoalLoopConfig = GoalConfig;

/**
 * Reasoning effort level for the model. Controls how much reasoning
 * the model performs before generating a response.
 *
 * Only effective with LanguageModelV4 (AI SDK v7) model providers that support reasoning.
 * When used with older model providers (V2/V3), this option is a no-op.
 */
export type ReasoningLevel = NonNullable<LanguageModelV4CallOptions['reasoning']>;

/**
 * Bootstrap bag for run-scoped runtime state passed into `loop()`.
 *
 * Historically every agentic-execution and agentic-loop step closed over this
 * object directly. The evented engine routes step I/O through `JSON.stringify`
 * (storage snapshots, `UnixSocketPubSub` frames), so non-serializable values
 * here cannot ride on step inputs/outputs.
 *
 * The agentic engine now reads these values from the per-run RunScope
 * (`mastra.__getRunScope(runId)`); `loop()` hydrates the scope from this bag at
 * the single bootstrap point. Direct access to `_internal.*` from new agentic
 * step code is deprecated — read via `RunScope` instead.
 */
export type StreamInternal = {
  /** @deprecated Use `runScope.get(NOW_KEY)` from `loop/run-scope-keys`. */
  now?: () => number;
  /** @deprecated Use `runScope.get(GENERATE_ID_KEY)` from `loop/run-scope-keys`. */
  generateId?: IdGenerator;
  /** @deprecated Use `runScope.get(CURRENT_DATE_KEY)` from `loop/run-scope-keys`. */
  currentDate?: () => Date;
  /** @deprecated Use `runScope.get(SAVE_QUEUE_MANAGER_KEY)` from `loop/run-scope-keys`. */
  saveQueueManager?: SaveQueueManager; // SaveQueueManager from agent/save-queue
  /** @deprecated Use `runScope.get(MEMORY_CONFIG_KEY)` from `loop/run-scope-keys`. */
  memoryConfig?: MemoryConfigInternal; // MemoryConfig from memory/types
  /** @deprecated Use `runScope.get(THREAD_ID_KEY)` from `loop/run-scope-keys`. */
  threadId?: string;
  /** @deprecated Use `runScope.get(RESOURCE_ID_KEY)` from `loop/run-scope-keys`. */
  resourceId?: string;
  /** @deprecated Use `runScope.get(MEMORY_KEY)` from `loop/run-scope-keys`. */
  memory?: MastraMemory; // MastraMemory from memory/memory
  /** @deprecated Use `runScope.get(THREAD_EXISTS_KEY)` from `loop/run-scope-keys`. */
  threadExists?: boolean;
  // Tools modified by prepareStep/processInputStep - stored here to avoid workflow serialization
  /** @deprecated Use `runScope.get(STEP_TOOLS_KEY)` from `loop/run-scope-keys`. */
  stepTools?: ToolSet;
  // Active tools from prepareStep - used by toolCallStep to reject calls to hidden tools
  /** @deprecated Use `runScope.get(STEP_ACTIVE_TOOLS_KEY)` from `loop/run-scope-keys`. */
  stepActiveTools?: string[];
  // Workspace from prepareStep/processInputStep - stored here to avoid workflow serialization
  /** @deprecated Use `runScope.get(STEP_WORKSPACE_KEY)` from `loop/run-scope-keys`. */
  stepWorkspace?: Workspace;
  // Set to true when a delegation hook calls ctx.bail() to signal the loop should stop
  /** @deprecated Use `runScope.get(DELEGATION_BAILED_KEY)` from `loop/run-scope-keys`. */
  _delegationBailed?: boolean;
  // Stream transport reference (e.g., WebSocket) for stream lifecycle management
  /** @deprecated Use `runScope.get(TRANSPORT_REF_KEY)` from `loop/run-scope-keys`. */
  transportRef?: StreamTransportRef;
  // Background task manager for dispatching tools to run asynchronously
  /** @deprecated Use `runScope.get(BACKGROUND_TASK_MANAGER_KEY)` from `loop/run-scope-keys`. */
  backgroundTaskManager?: BackgroundTaskManager;
  // Agent-level background task config
  /** @deprecated Use `runScope.get(AGENT_BACKGROUND_CONFIG_KEY)` from `loop/run-scope-keys`. */
  agentBackgroundConfig?: AgentBackgroundConfig;
  // Transform policy for display/transcript tool payloads.
  /** @deprecated Use `runScope.get(TOOL_PAYLOAD_TRANSFORM_KEY)` from `loop/run-scope-keys`. */
  toolPayloadTransform?: ToolPayloadTransformPolicy;
  // Manager-level background task config
  /** @deprecated Use `runScope.get(BACKGROUND_TASK_MANAGER_CONFIG_KEY)` from `loop/run-scope-keys`. */
  backgroundTaskManagerConfig?: BackgroundTaskManagerConfig;
  // When true, backgroundTaskCheckStep returns immediately without waiting for
  // running tasks to complete. Used by `agent.streamUntilIdle`, which handles
  // continuation from the outside — the inner loop shouldn't also wait.
  /** @deprecated Use `runScope.get(SKIP_BG_TASK_WAIT_KEY)` from `loop/run-scope-keys`. */
  skipBgTaskWait?: boolean;
  /** @deprecated Use `runScope.get(DRAIN_PENDING_SIGNALS_KEY)` from `loop/run-scope-keys`. */
  drainPendingSignals?: (runId: string, scope?: 'pending' | 'pre-run') => CreatedAgentSignal[];
  // Signal inputs already stored in the initial message list that still need
  // stream data-part echoes before the first model step.
  /** @deprecated Use `runScope.get(INITIAL_SIGNAL_ECHOES_KEY)` from `loop/run-scope-keys`. */
  initialSignalEchoes?: CreatedAgentSignal[];
};

export type PrepareStepResult<TOOLS extends ToolSet = ToolSet> = {
  model?: LanguageModelV2 | ModelRouterModelId | OpenAICompatibleConfig | MastraLanguageModelV2;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  messages?: Array<MessageInput>;
  /**
   * Workspace to use for this step. When provided, this workspace will be passed to tool
   * execution context, allowing tools to access workspace.filesystem and workspace.sandbox.
   * This enables dynamic workspace configuration per-step via prepareStep.
   */
  workspace?: Workspace;
};

/**
 * Function called before each step of multi-step execution.
 */
export type PrepareStepFunction = (
  args: ProcessInputStepArgs,
) => Promise<ProcessInputStepResult | undefined | void> | ProcessInputStepResult | undefined | void;

export type LoopConfig<OUTPUT = undefined> = {
  onChunk?: (chunk: ChunkType<OUTPUT>) => Promise<void> | void;
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  onStepFinish?: MastraOnStepFinishCallback<OUTPUT>;
  onAbort?: (event: { steps: any[]; text?: string }) => Promise<void> | void;
  abortSignal?: AbortSignal;
  returnScorerData?: boolean;
  prepareStep?: PrepareStepFunction;
};

export type LoopOptions<TOOLS extends ToolSet = ToolSet, OUTPUT = undefined> = {
  mastra?: Mastra;
  resumeContext?: {
    resumeData: any;
    snapshot: any;
  };
  toolCallId?: string;
  models: ModelManagerModelConfig[];
  logger?: IMastraLogger;
  mode?: 'generate' | 'stream';
  runId?: string;
  idGenerator?: MastraIdGenerator;
  toolCallStreaming?: boolean;
  messageList: MessageList;
  includeRawChunks?: boolean;
  modelSettings?: Omit<CallSettings, 'abortSignal'> & {
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
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  options?: LoopConfig<OUTPUT>;
  providerOptions?: SharedProviderOptions;
  outputProcessors?: OutputProcessorOrWorkflow[];
  inputProcessors?: InputProcessorOrWorkflow[];
  llmRequestInputProcessors?: InputProcessorOrWorkflow[];
  errorProcessors?: ErrorProcessorOrWorkflow[];
  tools?: TOOLS;
  experimental_generateMessageId?: () => string;
  stopWhen?: StopCondition | Array<StopCondition>;
  maxSteps?: number;
  _internal?: StreamInternal;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  returnScorerData?: boolean;
  downloadRetries?: number;
  downloadConcurrency?: number;
  modelSpanTracker?: IModelSpanTracker;
  requireToolApproval?: RequireToolApproval;
  autoResumeSuspendedTools?: boolean;
  agentId: string;
  toolCallConcurrency?: number;
  agentName?: string;
  requestContext?: RequestContext;
  /** Trusted server-side signal for this loop's FGA checks. */
  actor?: ActorSignal;
  methodType: ModelMethodType;
  /**
   * Maximum number of processor-triggered retries allowed for this generation.
   * Input/output processor retries require this to be explicitly set.
   * Error processor retries from processAPIError default to 10 when errorProcessors are configured and this is not set.
   */
  maxProcessorRetries?: number;

  /**
   * isTaskComplete scoring configuration for supervisor patterns.
   * Scorers evaluate whether the task is complete after each iteration.
   *
   * When scorers fail, feedback is automatically added to the message list
   * so the LLM can see why the task isn't complete and adjust its approach.
   */
  isTaskComplete?: IsTaskCompleteConfig;

  /**
   * Native goal configuration, resolved from the agent's `goal` config. When
   * set, the in-loop goal step judges the thread's active objective each
   * qualifying iteration. See {@link GoalLoopConfig}.
   */
  goal?: GoalLoopConfig;

  /**
   * Callback fired after each iteration completes.
   * Allows monitoring and controlling iteration flow with feedback.
   */
  onIterationComplete?: OnIterationCompleteHandler;
  /**
   * Default workspace for the agent. This workspace will be passed to tool execution
   * context unless overridden by prepareStep or processInputStep.
   */
  workspace?: Workspace;
  /**
   * Shared processor state that persists across loop iterations.
   * Used by all processor methods (input and output) to share state.
   * Keyed by processor ID.
   */
  processorStates?: Map<string, ProcessorState>;
} & Partial<ObservabilityContext>;

export type LoopRun<Tools extends ToolSet = ToolSet, OUTPUT = undefined> = LoopOptions<Tools, OUTPUT> & {
  messageId: string;
  runId: string;
  startTimestamp: number;
  _internal: StreamInternal;
  rotateResponseMessageId: () => string;
  streamState: {
    serialize: () => any;
    deserialize: (state: any) => void;
  };
  methodType: ModelMethodType;
};

export type OuterLLMRun<Tools extends ToolSet = ToolSet, OUTPUT = undefined> = {
  messageId: string;
  controller: ReadableStreamDefaultController<StreamChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
} & LoopRun<Tools, OUTPUT>;

export const PRIMITIVE_TYPES = z.enum(['agent', 'workflow', 'none', 'tool']);
