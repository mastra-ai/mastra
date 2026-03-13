import type { MastraDBMessage } from '@mastra/core/agent';
import type { BufferedObservationChunk, ObservationalMemoryRecord } from '@mastra/core/storage';

import { calculateProjectedMessageRemoval, resolveRetentionFloor } from './thresholds';

export function resolveObservationBackpressureWaitMs(currentTokens: number, threshold: number): number {
  if (threshold <= 0) return 0;

  const ratio = currentTokens / threshold;
  if (ratio >= 1.3) return 4000;
  if (ratio >= 1.2) return 3000;
  if (ratio >= 1.0) return 2000;
  if (ratio >= 0.8) return 1000;
  return 0;
}

export function isMessageSealedForBuffering(message: MastraDBMessage): boolean {
  const metadata = message.content?.metadata as { mastra?: { sealed?: boolean } } | undefined;
  return metadata?.mastra?.sealed === true;
}

export function getObservationBackpressureState(params: {
  currentTokens: number;
  threshold: number;
  record: ObservationalMemoryRecord;
  messageTokensThreshold: number;
  bufferActivation: number;
  bufferTokens: number;
  blockAfter?: number;
  getBufferedChunks: (record: ObservationalMemoryRecord) => BufferedObservationChunk[];
}): {
  ratio: number;
  waitMs: number;
  projectedMessageRemoval: number;
  projectedRemaining: number;
  maxRemaining: number;
  bufferedActivationLooksReady: boolean;
  hasBufferedChunks: boolean;
} {
  const ratio = params.threshold > 0 ? params.currentTokens / params.threshold : 0;
  const waitMs = resolveObservationBackpressureWaitMs(params.currentTokens, params.threshold);
  const bufferedChunks = params.getBufferedChunks(params.record);
  const projectedMessageRemoval = calculateProjectedMessageRemoval(
    bufferedChunks,
    params.bufferActivation,
    params.messageTokensThreshold,
    params.currentTokens,
  );
  const projectedRemaining = Math.max(0, params.currentTokens - projectedMessageRemoval);
  const retentionFloor = resolveRetentionFloor(params.bufferActivation, params.messageTokensThreshold);
  const maxRemaining = retentionFloor + params.bufferTokens;
  const forceMaxActivation = !!(params.blockAfter && params.currentTokens >= params.blockAfter);
  const bufferedActivationLooksReady =
    projectedMessageRemoval > 0 &&
    (forceMaxActivation || params.bufferTokens <= 0 || projectedRemaining <= maxRemaining);

  return {
    ratio,
    waitMs,
    projectedMessageRemoval,
    projectedRemaining,
    maxRemaining,
    bufferedActivationLooksReady,
    hasBufferedChunks: bufferedChunks.length > 0,
  };
}
