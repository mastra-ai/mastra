import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { CallSettings, IdGenerator, StopCondition, ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import z from 'zod';
import type { MessageInput, MessageList } from '../agent/message-list';
import type { SaveQueueManager } from '../agent/save-queue';
import type { StructuredOutputOptions } from '../agent/types';
import type { ModelRouterModelId } from '../llm/model';
import type { ModelMethodType } from '../llm/model/model.loop.types';
import type { MastraLanguageModelV2, OpenAICompatibleConfig } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory, MemoryConfig } from '../memory';
import type { IModelSpanTracker } from '../observability';
import type {
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessorState,
} from '../processors';
import type { RequestContext } from '../request-context';
import type { OutputSchema } from '../stream/base/schema';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraOnStepFinishCallback,
  ModelManagerModelConfig,
} from '../stream/types';
import type { MastraIdGenerator } from '../types';
import type { OutputWriter } from '../workflows/types';

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
};

export type PrepareStepResult<TOOLS extends ToolSet = ToolSet> = {
  model?: LanguageModelV2 | ModelRouterModelId | OpenAICompatibleConfig | MastraLanguageModelV2;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  messages?: Array<MessageInput>;
};

/**
 * Function called before each step of multi-step execution.
 */
export type PrepareStepFunction = (
  args: ProcessInputStepArgs,
) => Promise<ProcessInputStepResult | undefined | void> | ProcessInputStepResult | undefined | void;

export type LoopConfig<OUTPUT extends OutputSchema = undefined> = {
  onChunk?: (chunk: ChunkType<OUTPUT>) => Promise<void> | void;
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  onFinish?: MastraOnFinishCallback;
  onStepFinish?: MastraOnStepFinishCallback;
  onAbort?: (event: any) => Promise<void> | void;
  abortSignal?: AbortSignal;
  returnScorerData?: boolean;
  prepareStep?: PrepareStepFunction;
};

export type LoopOptions<TOOLS extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> = {
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
  headers?: Record<string, string>;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  options?: LoopConfig<OUTPUT>;
  providerOptions?: SharedV2ProviderOptions;
  outputProcessors?: OutputProcessorOrWorkflow[];
  inputProcessors?: InputProcessorOrWorkflow[];
  tools?: TOOLS;
  experimental_generateMessageId?: () => string;
  stopWhen?: StopCondition<NoInfer<TOOLS>> | Array<StopCondition<NoInfer<TOOLS>>>;
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
};

export type LoopRun<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> = LoopOptions<
  Tools,
  OUTPUT
> & {
  messageId: string;
  runId: string;
  startTimestamp: number;
  _internal: StreamInternal;
  streamState: {
    serialize: () => any;
    deserialize: (state: any) => void;
  };
  methodType: ModelMethodType;
  processorStates?: Map<string, ProcessorState<OUTPUT>>;
};

export type OuterLLMRun<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> = {
  messageId: string;
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
} & LoopRun<Tools, OUTPUT>;

export const PRIMITIVE_TYPES = z.enum(['agent', 'workflow', 'none', 'tool']);
