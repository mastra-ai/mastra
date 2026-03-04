import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type {
  CallSettings,
  IdGenerator,
  StopCondition as StopConditionV5,
  ToolChoice,
  ToolSet,
} from '@internal/ai-sdk-v5';
import type { StopCondition as StopConditionV6 } from '@internal/ai-v6';
import z from 'zod';
import type { IsTaskCompleteConfig, OnIterationCompleteHandler } from '../agent/agent.types';
import type { MessageInput, MessageList } from '../agent/message-list';
import type { SaveQueueManager } from '../agent/save-queue';
import type { StructuredOutputOptions } from '../agent/types';
import type { ModelRouterModelId } from '../llm/model';
import type { ModelMethodType } from '../llm/model/model.loop.types';
import type { MastraLanguageModelV2, OpenAICompatibleConfig, SharedProviderOptions } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory, MemoryConfig } from '../memory';
import type { IModelSpanTracker, ObservabilityContext } from '../observability';
import type {
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
  StreamTransportRef,
} from '../stream/types';
import type { MastraIdGenerator } from '../types';
import type { OutputWriter } from '../workflows/types';
import type { Workspace } from '../workspace/workspace';

type StopCondition = StopConditionV5<any> | StopConditionV6<any>;

export type StreamInternal = {
  now?: () => number;
  generateId?: IdGenerator;
  currentDate?: () => Date;
  saveQueueManager?: SaveQueueManager; // SaveQueueManager from agent/save-queue
  memoryConfig?: MemoryConfig; // MemoryConfig from memory/types
  threadId?: string;
  resourceId?: string;
  memory?: MastraMemory; // MastraMemory from memory/memory
  threadExists?: boolean;
  // Tools modified by prepareStep/processInputStep - stored here to avoid workflow serialization
  stepTools?: ToolSet;
  // Workspace from prepareStep/processInputStep - stored here to avoid workflow serialization
  stepWorkspace?: Workspace;
  // Set to true when a delegation hook calls ctx.bail() to signal the loop should stop
  _delegationBailed?: boolean;
  // Stream transport reference (e.g., WebSocket) for stream lifecycle management
  transportRef?: StreamTransportRef;
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
  onAbort?: (event: any) => Promise<void> | void;
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
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  options?: LoopConfig<OUTPUT>;
  providerOptions?: SharedProviderOptions;
  outputProcessors?: OutputProcessorOrWorkflow[];
  inputProcessors?: InputProcessorOrWorkflow[];
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
  requireToolApproval?: boolean;
  autoResumeSuspendedTools?: boolean;
  agentId: string;
  toolCallConcurrency?: number;
  agentName?: string;
  requestContext?: RequestContext;
  methodType: ModelMethodType;
  /**
   * Maximum number of times processors can trigger a retry per generation.
   * When a processor calls abort({ retry: true }), the agent will retry with feedback.
   * If not set, no retries are performed.
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
  streamState: {
    serialize: () => any;
    deserialize: (state: any) => void;
  };
  methodType: ModelMethodType;
};

export type OuterLLMRun<Tools extends ToolSet = ToolSet, OUTPUT = undefined> = {
  messageId: string;
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
} & LoopRun<Tools, OUTPUT>;

export const PRIMITIVE_TYPES = z.enum(['agent', 'workflow', 'none', 'tool']);
