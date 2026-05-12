import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorAgent, ProcessorStreamWriter } from '@mastra/core/processors';
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
  agent?: ProcessorAgent;
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
}

/** Output from calling the observer agent. */
export interface ObserverOutput {
  observations: string;
  currentTask?: string;
  suggestedContinuation?: string;
  threadTitle?: string;
  /** User-defined extracted values, keyed by extractor slug. */
  extractedValues?: Record<string, unknown>;
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
    extractedValues?: Record<string, unknown>;
    observedMessages?: MastraDBMessage[];
    activeObservations?: string;
    newObservations?: string;
  }>;
  observedMessages?: MastraDBMessage[];
  activeObservations?: string;
  newObservations?: string;
  suggestedContinuation?: string;
  currentTask?: string;
  threadTitle?: string;
  /** User-defined extracted values (non-built-in slugs), keyed by slug. */
  extractedValues?: Record<string, unknown>;
}
