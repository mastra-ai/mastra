import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import type { ObserveHooks } from '../types';

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
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
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
