/**
 * In-process scorer health counters: tracks how many scorer runs were
 * triggered, how many passed sampling, how many scores were persisted, and how
 * many failed. Surfaces "scores expected vs delivered" so missing/failed async
 * scores are detectable (GET /api/scores/scorers/:scorerId/health).
 *
 * Counters are per-process and reset on restart — they are a liveness signal,
 * not an audit log.
 */

export interface ScorerHealth {
  scorerId: string;
  /** Eligible scorer invocations before sampling was applied. */
  triggered: number;
  /** Invocations that passed sampling and were dispatched to the scorer. */
  sampled: number;
  /** Scores successfully persisted to the scores store. */
  saved: number;
  /** Scorer runs that threw or failed to persist. */
  failed: number;
  lastErrorMessage?: string;
  lastErrorAt?: number;
}

const registry = new Map<string, ScorerHealth>();

function entry(scorerId: string): ScorerHealth {
  let health = registry.get(scorerId);
  if (!health) {
    health = { scorerId, triggered: 0, sampled: 0, saved: 0, failed: 0 };
    registry.set(scorerId, health);
  }
  return health;
}

export function recordScorerTriggered(scorerId: string): void {
  entry(scorerId).triggered += 1;
}

export function recordScorerSampled(scorerId: string): void {
  entry(scorerId).sampled += 1;
}

export function recordScoreSaved(scorerId: string): void {
  entry(scorerId).saved += 1;
}

export function recordScorerFailure(scorerId: string, error?: unknown): void {
  const health = entry(scorerId);
  health.failed += 1;
  health.lastErrorMessage = error instanceof Error ? error.message : error !== undefined ? String(error) : undefined;
  health.lastErrorAt = Date.now();
}

export function getScorerHealth(scorerId: string): ScorerHealth {
  // Return a copy so callers cannot mutate the registry.
  return { ...entry(scorerId) };
}

export function listScorerHealth(): ScorerHealth[] {
  return [...registry.values()].map(health => ({ ...health }));
}

/** Test helper: clears all counters. */
export function resetScorerHealth(): void {
  registry.clear();
}
