import type { WritableStream } from 'stream/web';
import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type {
  CallSettings,
  IdGenerator,
  StopCondition,
  TelemetrySettings,
  ToolChoice,
  ToolSet,
  StepResult,
  ModelMessage,
} from 'ai-v5';
import z from 'zod';
import type { MessageList } from '../agent/message-list';
import type { SaveQueueManager } from '../agent/save-queue';
import type { StructuredOutputOptions } from '../agent/types';
import type { ModelSpanTracker } from '../ai-tracing';
import type { ModelMethodType } from '../llm/model/model.loop.types';
import type { MastraLanguageModelV2 } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory, MemoryConfig } from '../memory';
import type { OutputProcessor, ProcessorState } from '../processors';
import type { OutputSchema } from '../stream/base/schema';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraOnStepFinishCallback,
  ModelManagerModelConfig,
} from '../stream/types';
import type { MastraIdGenerator } from '../types';

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
};

export type PrepareStepResult<TOOLS extends ToolSet = ToolSet> = {
  model?: MastraLanguageModelV2;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  system?: string;
  messages?: Array<ModelMessage>;
};

export type PrepareStepFunction<TOOLS extends ToolSet = ToolSet> = (options: {
  steps: Array<StepResult<TOOLS>>;
  stepNumber: number;
  model: MastraLanguageModelV2;
  messages: Array<ModelMessage>;
}) => PromiseLike<PrepareStepResult<TOOLS> | undefined> | PrepareStepResult<TOOLS> | undefined;

export type LoopConfig<OUTPUT extends OutputSchema = undefined> = {
  onChunk?: (chunk: ChunkType<OUTPUT>) => Promise<void> | void;
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  onFinish?: MastraOnFinishCallback;
  onStepFinish?: MastraOnStepFinishCallback;
  onAbort?: (event: any) => Promise<void> | void;
  activeTools?: Array<keyof ToolSet> | undefined;
  abortSignal?: AbortSignal;
  returnScorerData?: boolean;
  prepareStep?: PrepareStepFunction<any>;
};

export type LoopOptions<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> = {
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
  telemetry_settings?: TelemetrySettings;
  messageList: MessageList;
  includeRawChunks?: boolean;
  modelSettings?: CallSettings;
  headers?: Record<string, string>;
  toolChoice?: ToolChoice<any>;
  options?: LoopConfig<OUTPUT>;
  providerOptions?: SharedV2ProviderOptions;
  tools?: Tools;
  outputProcessors?: OutputProcessor[];
  experimental_generateMessageId?: () => string;
  stopWhen?: StopCondition<NoInfer<Tools>> | Array<StopCondition<NoInfer<Tools>>>;
  maxSteps?: number;
  _internal?: StreamInternal;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  returnScorerData?: boolean;
  downloadRetries?: number;
  downloadConcurrency?: number;
  modelSpanTracker?: ModelSpanTracker;
  requireToolApproval?: boolean;
  agentId: string;
  methodType: ModelMethodType;
};

export type LoopRun<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined> = LoopOptions<
  Tools,
  OUTPUT
> & {
  messageId: string;
  runId: string;
  startTimestamp: number;
  modelStreamSpan: Span;
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
  writer: WritableStream<ChunkType<OUTPUT>>;
} & LoopRun<Tools, OUTPUT>;

export const PRIMITIVE_TYPES = z.enum(['agent', 'workflow', 'none', 'tool']);
