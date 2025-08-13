import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type { CallSettings, IdGenerator, TelemetrySettings, ToolChoice, ToolSet } from 'ai-v5';
import type { MessageList } from '../agent/message-list';
import type { IMastraLogger } from '../logger';
import type { ChunkType } from '../stream/types';
import type { MastraIdGenerator } from '../types';

export type StreamInternal = {
  now?: () => number;
  generateId?: IdGenerator;
  currentDate?: () => Date;
};

export type LoopOptions = {
  model: LanguageModelV2;
  logger?: IMastraLogger;
  runId?: string;
  idGenerator?: MastraIdGenerator;
  telemetry_settings?: TelemetrySettings;
  messageList: MessageList;
  includeRawChunks?: boolean;
  modelSettings?: CallSettings;
  headers?: Record<string, string>;
  toolChoice?: ToolChoice<any>;
  options?: {
    abortSignal?: AbortSignal;
    activeTools?: string[];
  };
  providerOptions?: SharedV2ProviderOptions;
  tools: ToolSet;
};

export type LoopRun = LoopOptions & {
  runId: string;
  startTimestamp: number;
  _internal: StreamInternal;
};

export type OuterLLMRun = {
  messageId: string;
  modelStreamSpan: Span;
  controller: ReadableStreamDefaultController<ChunkType>;
} & LoopRun;
