import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type { asSchema, CallSettings, IdGenerator, StopCondition, TelemetrySettings, ToolChoice, ToolSet } from 'ai-v5';
import type { MessageList } from '../agent/message-list';
import type { IMastraLogger } from '../logger';
import type { ChunkType } from '../stream/types';
import type { MastraIdGenerator } from '../types';

export type StreamInternal = {
  now?: () => number;
  generateId?: IdGenerator;
  currentDate?: () => Date;
};

export type LoopConfig = {
  onChunk?: (chunk: ChunkType) => Promise<void> | void;
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  onFinish?: (event: any) => Promise<void> | void;
  onStepFinish?: (event: any) => Promise<void> | void;
  onAbort?: (event: any) => Promise<void> | void;
  activeTools?: Array<keyof ToolSet> | undefined;
  abortSignal?: AbortSignal;
};

export type LoopOptions<Tools extends ToolSet = ToolSet> = {
  model: LanguageModelV2;
  logger?: IMastraLogger;
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
  experimental_generateMessageId?: () => string;
  stopWhen?: StopCondition<NoInfer<Tools>> | Array<StopCondition<NoInfer<Tools>>>;
  _internal?: StreamInternal;
  objectOptions?: ObjectOptions;
};

export type ObjectOptions =
  | {
      /**
       * Defaults to 'object' output if 'schema' is provided without 'output'
       */
      output?: 'object' | 'array';
      schema: Parameters<typeof asSchema>[0];
      schemaName?: string;
      schemaDescription?: string;
    }
  | {
      output: 'no-schema';
      schema?: never;
      schemaName?: never;
      schemaDescription?: never;
    }
  | undefined;

export type LoopRun<Tools extends ToolSet = ToolSet> = LoopOptions<Tools> & {
  runId: string;
  startTimestamp: number;
  modelStreamSpan: Span;
  _internal: StreamInternal;
};

export type OuterLLMRun<Tools extends ToolSet = ToolSet> = {
  messageId: string;
  controller: ReadableStreamDefaultController<ChunkType>;
} & LoopRun<Tools>;
