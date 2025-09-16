import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
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
import type { AISpan, AISpanType } from '../ai-tracing';
import type { IMastraLogger } from '../logger';
import type { OutputProcessor } from '../processors';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType, ModelManagerModelConfig } from '../stream/types';
import type { MastraIdGenerator } from '../types';

export type StreamInternal = {
  now?: () => number;
  generateId?: IdGenerator;
  currentDate?: () => Date;
};

export type PrepareStepResult<TOOLS extends ToolSet = ToolSet> = {
  model?: LanguageModelV2;
  toolChoice?: ToolChoice<TOOLS>;
  activeTools?: Array<keyof TOOLS>;
  system?: string;
  messages?: Array<ModelMessage>;
};

export type PrepareStepFunction<TOOLS extends ToolSet = ToolSet> = (options: {
  steps: Array<StepResult<TOOLS>>;
  stepNumber: number;
  model: LanguageModelV2;
  messages: Array<ModelMessage>;
}) => PromiseLike<PrepareStepResult<TOOLS> | undefined> | PrepareStepResult<TOOLS> | undefined;

export type LoopConfig = {
  onChunk?: (chunk: ChunkType) => Promise<void> | void;
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  onFinish?: (event: any) => Promise<void> | void;
  onStepFinish?: (event: any) => Promise<void> | void;
  onAbort?: (event: any) => Promise<void> | void;
  activeTools?: Array<keyof ToolSet> | undefined;
  abortSignal?: AbortSignal;
  returnScorerData?: boolean;
  prepareStep?: PrepareStepFunction<any>;
};

export type LoopOptions<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> = {
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
  options?: LoopConfig;
  providerOptions?: SharedV2ProviderOptions;
  tools?: Tools;
  outputProcessors?: OutputProcessor[];
  experimental_generateMessageId?: () => string;
  stopWhen?: StopCondition<NoInfer<Tools>> | Array<StopCondition<NoInfer<Tools>>>;
  maxSteps?: number;
  _internal?: StreamInternal;
  output?: OUTPUT;
  returnScorerData?: boolean;
  downloadRetries?: number;
  downloadConcurrency?: number;
  llmAISpan?: AISpan<AISpanType.LLM_GENERATION>;
};

export type LoopRun<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> = LoopOptions<
  Tools,
  OUTPUT
> & {
  messageId: string;
  runId: string;
  startTimestamp: number;
  modelStreamSpan: Span;
  _internal: StreamInternal;
};

export type OuterLLMRun<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> = {
  messageId: string;
  controller: ReadableStreamDefaultController<ChunkType>;
  writer: WritableStream<ChunkType>;
} & LoopRun<Tools, OUTPUT>;

export const RESOURCE_TYPES = z.enum(['agent', 'workflow', 'none', 'tool']);
