import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
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

  /**
   * Live MessageList for the in-flight agent turn, when observation runs inside
   * an agent loop. Lets lifecycle markers land on the pending assistant response
   * message before it reaches storage (see `streamMarker`).
   */
  messageList?: MessageList;

  /** Pre-generated cycle ID (async buffer only — sync/resource auto-generate). */
  cycleId?: string;
  /** Pre-captured start timestamp (async buffer only). */
  startedAt?: string;
  /**
   * Durable observation-buffer claim token for this cycle (async buffer only).
   * When set, buffered output is persisted through the owner-conditioned
   * commit; a lost claim discards the output instead of overwriting a
   * successor's state.
   */
  claimOwnerToken?: string;
  /**
   * Token boundary to persist alongside the buffered chunk (async buffer
   * only). Rides the owner-conditioned commit so the end-of-cycle boundary
   * update is fenced too.
   */
  claimBoundaryTokens?: number;

  writer?: ProcessorStreamWriter;
  abortSignal?: AbortSignal;
  reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
  agent?: ProcessorContext['agent'];
  sendSignal?: ProcessorContext['sendSignal'];
  sendStateSignal?: ProcessorContext['sendStateSignal'];
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
  /**
   * The failure that ended the cycle, for strategies that swallow errors
   * instead of rethrowing (async buffering). Lets callers report the failure
   * (e.g. to ObserveHooks) even though the fire-and-forget path never throws.
   */
  error?: Error;
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
