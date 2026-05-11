import type { ObservabilityStorage } from '../storage/domains/observability';
import type { RolloutsStorage } from '../storage/domains/rollouts';
import type { RolloutAllocation, RolloutRecord, RolloutRule } from '../storage/types';

/**
 * Deterministically resolve which version a request should use based on the rollout allocations.
 *
 * Uses a simple hash of (routingKey value + agentId) to produce a stable bucket assignment.
 * This ensures the same user always gets the same version during a rollout (sticky routing)
 * without storing any state.
 *
 * @param rollout - The active rollout record
 * @param requestContext - Map-like object to extract the routing key from
 * @returns The resolved version ID
 */
export function resolveVersionFromRollout(
  rollout: RolloutRecord,
  requestContext?: { get(key: string): unknown },
): string {
  const routingKey = rollout.routingKey ?? 'resourceId';
  const routingValue = requestContext?.get(routingKey);

  // If no routing value, fall back to the stable version
  if (!routingValue || typeof routingValue !== 'string') {
    return rollout.stableVersionId;
  }

  const bucket = deterministicBucket(routingValue, rollout.agentId);
  return pickAllocation(rollout.allocations, bucket);
}

/**
 * Hash a string pair into a bucket in [0, 1).
 * Uses a fast non-cryptographic hash (FNV-1a inspired) for deterministic, stable results.
 * The 32-bit hash is normalized to a fraction so weights as small as ~2.3e-10 can be expressed.
 */
export function deterministicBucket(routingValue: string, agentId: string): number {
  const input = `${routingValue}:${agentId}`;
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Normalize unsigned 32-bit hash to [0, 1)
  return (hash >>> 0) / 0x100000000;
}

/**
 * Pick an allocation based on a bucket value in [0, 1).
 * Allocations are walked in order; their weights define consecutive ranges.
 */
export function pickAllocation(allocations: RolloutAllocation[], bucket: number): string {
  if (!allocations.length) {
    throw new Error('Cannot pick allocation from empty array');
  }
  let cumulative = 0;
  for (const alloc of allocations) {
    cumulative += alloc.weight;
    if (bucket < cumulative) {
      return alloc.versionId;
    }
  }
  // Fallback: return the last allocation (should never happen if weights sum to 1)
  return allocations[allocations.length - 1]!.versionId;
}

// ---------------------------------------------------------------------------
// Rule evaluation — backed by the observability score aggregate API
// ---------------------------------------------------------------------------

/**
 * Stats for a single (versionId, scorerId) pair within the rollout window.
 * Returned by {@link queryRolloutScoreStats}.
 */
export interface RolloutScoreStats {
  avg: number | null;
  count: number;
}

/**
 * Query average and count for scores attributed to a specific candidate version
 * within the active rollout window using the observability OLAP aggregate API.
 *
 * Filters used:
 *  - `entityName: agentId`
 *  - `entityVersionId: versionId`
 *  - `scorerId`
 *  - `timestamp.start: rollout.createdAt`
 */
export async function queryRolloutScoreStats(
  observability: ObservabilityStorage,
  agentId: string,
  versionId: string,
  scorerId: string,
  rolloutCreatedAt: Date,
): Promise<RolloutScoreStats> {
  const filters = {
    entityName: agentId,
    entityVersionId: versionId,
    timestamp: { start: rolloutCreatedAt },
  } as const;

  const [avgRes, countRes] = await Promise.all([
    observability.getScoreAggregate({ scorerId, aggregation: 'avg', filters }),
    observability.getScoreAggregate({ scorerId, aggregation: 'count', filters }),
  ]);

  const count = typeof countRes.value === 'number' ? countRes.value : 0;
  const avg = typeof avgRes.value === 'number' ? avgRes.value : null;
  return { avg, count };
}

/**
 * Evaluate rollout rules against persisted scores via the observability aggregate API.
 *
 * Returns the first breached rule, or null if all rules pass.
 *
 * A rule is breached when:
 * - We have at least `windowSize` scores for the candidate version since the rollout started
 * - The average score is below the threshold
 */
export async function evaluateRules(
  rollout: RolloutRecord,
  observability: ObservabilityStorage,
): Promise<RolloutRule | null> {
  if (!rollout.rules || rollout.rules.length === 0) return null;

  // Rules apply to the candidate version(s) — anything that isn't the stable.
  const candidateAllocations = rollout.allocations.filter(a => a.versionId !== rollout.stableVersionId);
  if (candidateAllocations.length === 0) return null;

  for (const rule of rollout.rules) {
    for (const alloc of candidateAllocations) {
      const stats = await queryRolloutScoreStats(
        observability,
        rollout.agentId,
        alloc.versionId,
        rule.scorerId,
        rollout.createdAt,
      );

      // Only evaluate when we have enough data
      if (stats.count < rule.windowSize) continue;
      if (stats.avg === null) continue;

      if (stats.avg < rule.threshold) {
        return rule;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// RolloutEvaluator — opportunistic per-request rollback evaluation
// ---------------------------------------------------------------------------

/**
 * Performs throttled rollback evaluation for active rollouts.
 *
 * Designed to be invoked from the request path (after a rollout version is
 * resolved): if enough time has elapsed since the last check for an agent,
 * the evaluator queries the observability store for aggregate scores and
 * triggers the rollback handler when a rule is breached.
 *
 * Stateless from a data perspective — no scores are buffered in memory.
 * The only in-memory state is a per-agent "last evaluated at" timestamp
 * used purely to throttle queries to the OLAP store.
 */
export class RolloutEvaluator {
  /** Default minimum interval between rollback evaluations for a given agent. */
  static readonly DEFAULT_MIN_INTERVAL_MS = 30_000;

  readonly #minIntervalMs: number;
  readonly #lastEvaluatedAt = new Map<string, number>();
  readonly #inFlight = new Map<string, Promise<void>>();
  readonly #rolloutsStorage: RolloutsStorage;
  readonly #observability: ObservabilityStorage;
  readonly #onRollback: (agentId: string, rolloutId: string) => Promise<void>;

  constructor(options: {
    rolloutsStorage: RolloutsStorage;
    observability: ObservabilityStorage;
    onRollback: (agentId: string, rolloutId: string) => Promise<void>;
    /** Minimum interval in ms between consecutive evaluations for the same agent. */
    minIntervalMs?: number;
  }) {
    this.#rolloutsStorage = options.rolloutsStorage;
    this.#observability = options.observability;
    this.#onRollback = options.onRollback;
    this.#minIntervalMs = options.minIntervalMs ?? RolloutEvaluator.DEFAULT_MIN_INTERVAL_MS;
  }

  /**
   * Schedule a best-effort evaluation for the given agent. Safe to call from
   * the hot request path — the actual work happens asynchronously and is
   * throttled per-agent and de-duplicated when already in flight.
   */
  scheduleEvaluation(agentId: string, rollout: RolloutRecord): void {
    if (!rollout.rules || rollout.rules.length === 0) return;

    const now = Date.now();
    const last = this.#lastEvaluatedAt.get(agentId) ?? 0;
    if (now - last < this.#minIntervalMs) return;
    if (this.#inFlight.has(agentId)) return;

    this.#lastEvaluatedAt.set(agentId, now);
    const work = this.#evaluate(agentId, rollout).finally(() => {
      this.#inFlight.delete(agentId);
    });
    this.#inFlight.set(agentId, work);
  }

  async #evaluate(agentId: string, rollout: RolloutRecord): Promise<void> {
    try {
      // Re-read the rollout in case it changed (e.g. weights, completion).
      const current = await this.#rolloutsStorage.getActiveRollout(agentId);
      if (!current || current.id !== rollout.id) return;

      const breached = await evaluateRules(current, this.#observability);
      if (breached) {
        await this.#onRollback(agentId, current.id);
      }
    } catch {
      // Best-effort: swallow errors so we never break the request path.
    }
  }

  /**
   * Reset throttle state for an agent (e.g. after a manual rollback/promote).
   */
  reset(agentId: string): void {
    this.#lastEvaluatedAt.delete(agentId);
  }
}
