import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { CallSettings, TelemetrySettings } from 'ai-v5';
import type { MessageList } from '../agent';
import type { IMastraLogger } from '../logger';
import type { MastraIdGenerator } from '../types';

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
};

export type LoopRun = LoopOptions & {
  startTimestamp: number;
};
