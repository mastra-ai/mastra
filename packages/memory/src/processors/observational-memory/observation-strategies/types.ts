import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorContext, ProcessorStreamWriter } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

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
  sendSignal?: ProcessorContext['sendSignal'];
  requestContext?: RequestContext;
  currentModel?: ObservationModelContext;
  observabilityContext?: ObservabilityContext;
  /**
   * Live MessageList passed by callers that hold one (e.g. ObservationStep).
   * When present, lifecycle markers are appended to the in-memory assistant
   * message (incl. the step-0 seeded marker message) via
   * persistMarkerToMessage instead of the DB-lookup persistMarkerToStorage
   * path. This is required so the seed — which has empty parts until markers
   * land on it — is persisted with marker parts (an empty-parts assistant
   * message is dropped by filterMessagesForPersistence).
   */
  messageList?: MessageList;
}

/** Output from calling the observer agent. */
export interface ObserverOutput {
  observations: string;
  currentTask?: string;
  suggestedContinuation?: string;
  threadTitle?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

/** Result returned from ObservationStrategy.run(). */
export interface ObservationRunResult {
  observed: boolean;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
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
    lastObservedMessageCursor?: { createdAt: string; id: string };
  }>;
  suggestedContinuation?: string;
  currentTask?: string;
  threadTitle?: string;
}
