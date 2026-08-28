import type { KnowledgeCurationLane, KnowledgeCurationOutcome, KnowledgeCurationState } from '@mastra/core/storage';

export const CURATION_BACKOFF_BASE_MS = 60_000;
export const CURATION_BACKOFF_CAP_MS = 60 * 60_000;

export function isBackingOff(state: KnowledgeCurationState | null | undefined, now: number): boolean {
  return Boolean(state && state.failures > 0 && now < state.nextEligibleAt.getTime());
}

export function nextBackoff(
  lane: KnowledgeCurationLane,
  state: KnowledgeCurationState | null | undefined,
  outcome: Exclude<KnowledgeCurationOutcome, 'skipped'>,
  now: number,
): KnowledgeCurationState {
  const failures = (state?.failures ?? 0) + 1;
  const delay = Math.min(CURATION_BACKOFF_BASE_MS * 2 ** (failures - 1), CURATION_BACKOFF_CAP_MS);
  const attemptedAt = new Date(now);
  return {
    ...lane,
    failures,
    lastOutcome: outcome,
    lastAttemptAt: attemptedAt,
    nextEligibleAt: new Date(now + delay),
    updatedAt: attemptedAt,
  };
}
