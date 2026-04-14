import type { RolloutsStorage } from '../storage/domains/rollouts';
import type { RolloutRecord, RolloutAllocation, RolloutRule } from '../storage/types';

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
 * Hash a string pair into a bucket [0, 100).
 * Uses a fast non-cryptographic hash (FNV-1a inspired) for deterministic, stable results.
 */
export function deterministicBucket(routingValue: string, agentId: string): number {
  const input = `${routingValue}:${agentId}`;
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Convert to unsigned 32-bit and mod 100
  return (hash >>> 0) % 100;
}

/**
 * Pick an allocation based on a bucket value [0, 100).
 * Allocations are walked in order; their weights define consecutive ranges.
 */
export function pickAllocation(allocations: RolloutAllocation[], bucket: number): string {
  let cumulative = 0;
  for (const alloc of allocations) {
    cumulative += alloc.weight;
    if (bucket < cumulative) {
      return alloc.versionId;
    }
  }
  // Fallback: return the last allocation (should never happen if weights sum to 100)
  return allocations[allocations.length - 1]!.versionId;
}

// ---------------------------------------------------------------------------
// RolloutAccumulator — In-memory sliding window of recent scores
// ---------------------------------------------------------------------------

interface ScoreEntry {
  score: number;
  timestamp: number;
}

interface AccumulatorWindow {
  entries: ScoreEntry[];
  /** Next write position (circular buffer) */
  cursor: number;
  /** Total entries ever written (used to know if buffer is full) */
  totalWrites: number;
}

/**
 * In-memory accumulator for scorer results during active rollouts.
 *
 * Scores are pushed here asynchronously after each generate() call.
 * A background timer periodically evaluates rollout rules against accumulated scores.
 *
 * Key design points:
 * - push() is O(1) — no overhead on the hot path
 * - Each server instance has its own accumulator (no shared state needed)
 * - On server restart, windows reset — safe because "no data" means "keep running"
 * - Background evaluation is configurable (default: every 30s)
 */
export class RolloutAccumulator {
  /** Max entries per window (circular buffer size) */
  static readonly MAX_WINDOW_SIZE = 1000;

  /** Key: `${agentId}:${versionId}:${scorerId}` */
  readonly #windows = new Map<string, AccumulatorWindow>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #evaluationIntervalMs: number;
  #rolloutsStorage: RolloutsStorage | null = null;
  #onRollback: ((agentId: string, rolloutId: string) => Promise<void>) | null = null;

  /** Whether the accumulator has been bound to storage and started. */
  bound = false;

  constructor(options?: {
    /** How often to evaluate rules, in milliseconds. Default: 30000 (30s) */
    evaluationIntervalMs?: number;
  }) {
    this.#evaluationIntervalMs = options?.evaluationIntervalMs ?? 30_000;
  }

  /**
   * Bind the accumulator to a storage backend and a rollback handler.
   * Called during Mastra initialization.
   */
  bind(storage: RolloutsStorage, onRollback: (agentId: string, rolloutId: string) => Promise<void>): void {
    this.#rolloutsStorage = storage;
    this.#onRollback = onRollback;
    this.bound = true;
  }

  /**
   * Start the background evaluation timer.
   */
  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      this.#evaluateAll().catch(() => {
        // Swallow errors — evaluation is best-effort
      });
    }, this.#evaluationIntervalMs);
    // Don't block process exit
    if (this.#timer && typeof this.#timer === 'object' && 'unref' in this.#timer) {
      this.#timer.unref();
    }
  }

  /**
   * Stop the background evaluation timer.
   */
  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * Push a score into the accumulator. O(1), fire-and-forget.
   */
  push(agentId: string, versionId: string, scorerId: string, score: number): void {
    const key = `${agentId}:${versionId}:${scorerId}`;
    let window = this.#windows.get(key);
    if (!window) {
      window = {
        entries: new Array(RolloutAccumulator.MAX_WINDOW_SIZE),
        cursor: 0,
        totalWrites: 0,
      };
      this.#windows.set(key, window);
    }

    window.entries[window.cursor] = { score, timestamp: Date.now() };
    window.cursor = (window.cursor + 1) % RolloutAccumulator.MAX_WINDOW_SIZE;
    window.totalWrites++;
  }

  /**
   * Get the rolling window stats for a given key.
   * @param windowSize - Number of most-recent entries to consider
   */
  getWindow(
    agentId: string,
    versionId: string,
    scorerId: string,
    windowSize: number,
  ): { avg: number; count: number } | null {
    const key = `${agentId}:${versionId}:${scorerId}`;
    const window = this.#windows.get(key);
    if (!window || window.totalWrites === 0) return null;

    const filled = Math.min(window.totalWrites, RolloutAccumulator.MAX_WINDOW_SIZE);
    const size = Math.min(windowSize, filled);

    let sum = 0;
    let count = 0;

    // Read backwards from the most recently written entry
    for (let i = 0; i < size; i++) {
      const idx = (window.cursor - 1 - i + RolloutAccumulator.MAX_WINDOW_SIZE) % RolloutAccumulator.MAX_WINDOW_SIZE;
      const entry = window.entries[idx];
      if (entry) {
        sum += entry.score;
        count++;
      }
    }

    if (count === 0) return null;
    return { avg: sum / count, count };
  }

  /**
   * Clear all windows for a specific agent (called when a rollout completes).
   */
  clearAgent(agentId: string): void {
    const prefix = `${agentId}:`;
    for (const key of this.#windows.keys()) {
      if (key.startsWith(prefix)) {
        this.#windows.delete(key);
      }
    }
  }

  /**
   * Clear everything (primarily for testing).
   */
  clearAll(): void {
    this.#windows.clear();
  }

  /**
   * Background evaluation: iterate all active rollouts and check rules.
   * This is the "slow path" that runs every N seconds.
   */
  async #evaluateAll(): Promise<void> {
    if (!this.#rolloutsStorage || !this.#onRollback) return;

    // Collect unique agentIds from accumulated windows
    const agentIds = new Set<string>();
    for (const key of this.#windows.keys()) {
      const agentId = key.split(':')[0]!;
      agentIds.add(agentId);
    }

    for (const agentId of agentIds) {
      try {
        const rollout = await this.#rolloutsStorage.getActiveRollout(agentId);
        if (!rollout || !rollout.rules || rollout.rules.length === 0) continue;

        const breached = evaluateRules(rollout, this);
        if (breached) {
          await this.#onRollback(agentId, rollout.id);
          this.clearAgent(agentId);
        }
      } catch {
        // Continue with next agent — evaluation is best-effort
      }
    }
  }
}

/**
 * Evaluate rollout rules against the accumulator.
 * Returns the first breached rule, or null if all rules pass.
 *
 * A rule is breached when:
 * - We have at least `windowSize` scores in the window
 * - The average score is below the threshold
 */
export function evaluateRules(rollout: RolloutRecord, accumulator: RolloutAccumulator): RolloutRule | null {
  if (!rollout.rules) return null;

  // For canary rollouts, rules apply to the candidate version (non-stable allocations)
  const candidateAllocations = rollout.allocations.filter(a => a.versionId !== rollout.stableVersionId);

  for (const rule of rollout.rules) {
    for (const alloc of candidateAllocations) {
      const stats = accumulator.getWindow(rollout.agentId, alloc.versionId, rule.scorerId, rule.windowSize);

      // Only evaluate when we have enough data
      if (!stats || stats.count < rule.windowSize) continue;

      if (stats.avg < rule.threshold) {
        return rule;
      }
    }
  }

  return null;
}
