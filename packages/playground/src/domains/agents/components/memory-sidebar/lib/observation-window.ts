import type { GetObservationalMemoryResponse } from '@mastra/client-js';
import type { OmProgressData } from '@/domains/agents/context';

type ThresholdValue = number | { min: number; max: number };
type ObservationalMemoryRecord = NonNullable<GetObservationalMemoryResponse['record']>;

/** Shape of the observational-memory block inside the agent memory config endpoint. */
export interface OmAgentConfig {
  messageTokens?: ThresholdValue;
  observationTokens?: ThresholdValue;
  observation?: { messageTokens?: ThresholdValue };
  reflection?: { observationTokens?: ThresholdValue };
}

/** Shape of the config stored on an OM record (set by the OM processor). */
interface OmRecordConfig {
  observation?: { messageTokens?: number };
  reflection?: { observationTokens?: number };
}

export interface ObservationWindowTokens {
  messageTokens: number;
  messageThreshold: number;
  observationTokens: number;
  observationThreshold: number;
}

export const getThresholdValue = (threshold: ThresholdValue | undefined, defaultValue: number): number => {
  if (!threshold) return defaultValue;
  if (typeof threshold === 'number') return threshold;
  return threshold.max;
};

/**
 * Source-of-truth derivation for the OM window's message/observation token counts
 * and thresholds. Priority order mirrors the OM sidebar section exactly:
 *   stream progress > record (counts) / record config (thresholds) > agent config > defaults.
 *
 * Shared so the OM section and the timeline panel cannot drift.
 */
export function getObservationWindowTokens({
  record,
  liveProgress,
  agentConfig,
}: {
  record: ObservationalMemoryRecord | null | undefined;
  liveProgress: OmProgressData | null | undefined;
  agentConfig: OmAgentConfig | undefined;
}): ObservationWindowTokens {
  const recordConfig = record?.config as OmRecordConfig | undefined;

  const messageThreshold =
    liveProgress?.windows?.active?.messages?.threshold ??
    recordConfig?.observation?.messageTokens ??
    getThresholdValue(agentConfig?.messageTokens, 30000);

  const observationThreshold =
    liveProgress?.windows?.active?.observations?.threshold ??
    recordConfig?.reflection?.observationTokens ??
    getThresholdValue(agentConfig?.observationTokens, 40000);

  const messageTokens = liveProgress?.windows?.active?.messages?.tokens ?? record?.pendingMessageTokens ?? 0;
  const observationTokens = liveProgress?.windows?.active?.observations?.tokens ?? record?.observationTokenCount ?? 0;

  return { messageTokens, messageThreshold, observationTokens, observationThreshold };
}
