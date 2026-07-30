import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorContext, ProcessorStreamWriter } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import type { ProviderMetadata } from '@mastra/core/stream';

import type { Extractor } from '../extractor';
import type { ObservationModelContext, ObserveHooks } from '../types';

/** Parameters for running an observation via a strategy. */
export interface ObservationRunOpts {
  record: ObservationalMemoryRecord;
  threadId: string;
  resourceId?: string;
  messages: MastraDBMessage[];

  /** Pre-generated cycle ID (async buffer only — sync/resource auto-generate). */
  cycleId?: string;
  /** Pre-captured start timestamp (async buffer only). */
  startedAt?: string;

  writer?: ProcessorStreamWriter;
  abortSignal?: AbortSignal;
  reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
  agent?: ProcessorContext['agent'];
  sendSignal?: ProcessorContext['sendSignal'];
  requestContext?: RequestContext;
  currentModel?: ObservationModelContext;
  observabilityContext?: ObservabilityContext;
}

/** Output from calling the observer agent. */
export interface ObserverOutput {
  observations: string;
  currentTask?: string;
  suggestedContinuation?: string;
  threadTitle?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  extractors?: readonly Extractor<any>[];
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  providerMetadata?: ProviderMetadata;
}

/** Result returned from ObservationStrategy.run(). */
export interface ObservationRunResult {
  observed: boolean;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  providerMetadata?: ProviderMetadata;
}

/** Processed observation ready for persistence. */
export interface ProcessedObservation {
  observations: string;
  observationTokens: number;
  cycleObservationTokens: number;
  observedMessageIds: string[];
  lastObservedAt: Date;
  threadMetadataUpdates?: Array<{
    threadId: string;
    lastObservedAt: string;
    suggestedResponse?: string;
    currentTask?: string;
    threadTitle?: string;
    extracted?: Record<string, unknown>;
    extractionFailures?: Array<{ slug: string; error: string }>;
    extractors?: readonly Extractor<any>[];
    lastObservedMessageCursor?: { createdAt: string; id: string };
  }>;
  suggestedContinuation?: string;
  currentTask?: string;
  threadTitle?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  extractors?: readonly Extractor<any>[];
}
