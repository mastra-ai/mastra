import type {
  DataOmActivationPart,
  DataOmBufferingEndPart,
  DataOmBufferingFailedPart,
  DataOmBufferingStartPart,
  DataOmObservationEndPart,
  DataOmObservationFailedPart,
  DataOmObservationStartPart,
  DataOmThreadUpdatePart,
  ObservationMarkerConfig,
  OmOperationType,
} from './types';

/**
 * Create a start marker for when observation begins.
 */
export function createObservationStartMarker(params: {
  cycleId: string;
  operationType: 'observation' | 'reflection';
  tokensToObserve: number;
  recordId: string;
  threadId: string;
  threadIds: string[];
  config: ObservationMarkerConfig;
}): DataOmObservationStartPart {
  return {
    type: 'data-om-observation-start',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      startedAt: new Date().toISOString(),
      tokensToObserve: params.tokensToObserve,
      recordId: params.recordId,
      threadId: params.threadId,
      threadIds: params.threadIds,
      config: params.config,
    },
  };
}

/**
 * Create an end marker for when observation completes successfully.
 */
export function createObservationEndMarker(params: {
  cycleId: string;
  operationType: 'observation' | 'reflection';
  startedAt: string;
  tokensObserved: number;
  observationTokens: number;
  observations?: string;
  currentTask?: string;
  suggestedResponse?: string;
  recordId: string;
  threadId: string;
}): DataOmObservationEndPart {
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(params.startedAt).getTime();

  return {
    type: 'data-om-observation-end',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      completedAt,
      durationMs,
      tokensObserved: params.tokensObserved,
      observationTokens: params.observationTokens,
      observations: params.observations,
      currentTask: params.currentTask,
      suggestedResponse: params.suggestedResponse,
      recordId: params.recordId,
      threadId: params.threadId,
    },
  };
}

/**
 * Create a failed marker for when observation fails.
 */
export function createObservationFailedMarker(params: {
  cycleId: string;
  operationType: 'observation' | 'reflection';
  startedAt: string;
  tokensAttempted: number;
  error: string;
  recordId: string;
  threadId: string;
}): DataOmObservationFailedPart {
  const failedAt = new Date().toISOString();
  const durationMs = new Date(failedAt).getTime() - new Date(params.startedAt).getTime();

  return {
    type: 'data-om-observation-failed',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      failedAt,
      durationMs,
      tokensAttempted: params.tokensAttempted,
      error: params.error,
      recordId: params.recordId,
      threadId: params.threadId,
    },
  };
}

/**
 * Create a start marker for when async buffering begins.
 */
export function createBufferingStartMarker(params: {
  cycleId: string;
  operationType: OmOperationType;
  tokensToBuffer: number;
  recordId: string;
  threadId: string;
  threadIds: string[];
  config: ObservationMarkerConfig;
}): DataOmBufferingStartPart {
  return {
    type: 'data-om-buffering-start',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      startedAt: new Date().toISOString(),
      tokensToBuffer: params.tokensToBuffer,
      recordId: params.recordId,
      threadId: params.threadId,
      threadIds: params.threadIds,
      config: params.config,
    },
  };
}

/**
 * Create an end marker for when async buffering completes successfully.
 */
export function createBufferingEndMarker(params: {
  cycleId: string;
  operationType: OmOperationType;
  startedAt: string;
  tokensBuffered: number;
  bufferedTokens: number;
  recordId: string;
  threadId: string;
  observations?: string;
}): DataOmBufferingEndPart {
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(params.startedAt).getTime();

  return {
    type: 'data-om-buffering-end',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      completedAt,
      durationMs,
      tokensBuffered: params.tokensBuffered,
      bufferedTokens: params.bufferedTokens,
      recordId: params.recordId,
      threadId: params.threadId,
      observations: params.observations,
    },
  };
}

/**
 * Create a failed marker for when async buffering fails.
 */
export function createBufferingFailedMarker(params: {
  cycleId: string;
  operationType: OmOperationType;
  startedAt: string;
  tokensAttempted: number;
  error: string;
  recordId: string;
  threadId: string;
}): DataOmBufferingFailedPart {
  const failedAt = new Date().toISOString();
  const durationMs = new Date(failedAt).getTime() - new Date(params.startedAt).getTime();

  return {
    type: 'data-om-buffering-failed',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      failedAt,
      durationMs,
      tokensAttempted: params.tokensAttempted,
      error: params.error,
      recordId: params.recordId,
      threadId: params.threadId,
    },
  };
}

/**
 * Create an activation marker for when buffered observations are activated.
 */
export function createActivationMarker(params: {
  cycleId: string;
  operationType: OmOperationType;
  chunksActivated: number;
  tokensActivated: number;
  observationTokens: number;
  messagesActivated: number;
  recordId: string;
  threadId: string;
  generationCount: number;
  observations?: string;
  triggeredBy?: 'threshold' | 'ttl' | 'provider_change';
  lastActivityAt?: number;
  ttlExpiredMs?: number;
  previousModel?: string;
  currentModel?: string;
  config: ObservationMarkerConfig;
}): DataOmActivationPart {
  return {
    type: 'data-om-activation',
    data: {
      cycleId: params.cycleId,
      operationType: params.operationType,
      activatedAt: new Date().toISOString(),
      chunksActivated: params.chunksActivated,
      tokensActivated: params.tokensActivated,
      observationTokens: params.observationTokens,
      messagesActivated: params.messagesActivated,
      recordId: params.recordId,
      threadId: params.threadId,
      generationCount: params.generationCount,
      config: params.config,
      observations: params.observations,
      triggeredBy: params.triggeredBy,
      lastActivityAt: params.lastActivityAt,
      ttlExpiredMs: params.ttlExpiredMs,
      previousModel: params.previousModel,
      currentModel: params.currentModel,
    },
  };
}

/**
 * Create a thread update marker when the observer suggests a new thread title.
 */
export function createThreadUpdateMarker(params: {
  cycleId: string;
  threadId: string;
  oldTitle?: string;
  newTitle: string;
}): DataOmThreadUpdatePart {
  return {
    type: 'data-om-thread-update',
    data: {
      cycleId: params.cycleId,
      threadId: params.threadId,
      oldTitle: params.oldTitle,
      newTitle: params.newTitle,
      timestamp: new Date().toISOString(),
    },
  };
}
