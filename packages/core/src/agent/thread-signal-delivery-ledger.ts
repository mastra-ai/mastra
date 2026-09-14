import type { CreatedAgentSignal } from './signals';

export type ThreadSignalDelivery = {
  key: string;
  signal: CreatedAgentSignal;
  scope: 'pending' | 'pre-run';
};

type RunSignalDeliveries = {
  handled: Set<string>;
  deferred: Map<string, { delivery: ThreadSignalDelivery; observedAt: number }>;
  terminal: boolean;
};

const MAX_TRACKED_RUNS = 10_000;

/**
 * Makes signal delivery idempotent across the runtime's thread subscriptions.
 * Signals observed before this runtime owns their run remain deferred until the
 * run is reserved locally. Deferred payloads survive terminal events because
 * a publisher can terminate before another runtime has claimed its follow-up.
 * Only terminal runs without deferred work enter the bounded replay history.
 */
export class ThreadSignalDeliveryLedger {
  #runs = new Map<string, RunSignalDeliveries>();
  #settledRunIds = new Set<string>();
  #nextDeferredExpiry = Number.POSITIVE_INFINITY;

  /** Creates a ledger whose in-memory deferred payloads expire after the recovery window. */
  constructor(
    private readonly recoveryWindowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a signal already queued by this runtime so retained replay cannot queue it again. */
  markHandled(runId: string, signalId: string): void {
    const run = this.#get(runId);
    run.deferred.delete(signalId);
    run.handled.add(signalId);
    this.#trackSettled(runId, run);
  }

  /** Defers a replay until ownership exists, or returns it immediately for an owned run. */
  observe(runId: string, delivery: ThreadSignalDelivery, ownsRun: boolean): ThreadSignalDelivery | undefined {
    this.#sweepExpiredDeferred();
    const run = this.#get(runId);
    if (run.handled.has(delivery.signal.id)) return undefined;
    const deferred = run.deferred.get(delivery.signal.id)?.delivery;
    if (ownsRun) {
      run.deferred.delete(delivery.signal.id);
      run.handled.add(delivery.signal.id);
      this.#trackSettled(runId, run);
      return deferred ?? delivery;
    }
    if (deferred) return undefined;
    const observedAt = this.now();
    run.deferred.set(delivery.signal.id, { delivery, observedAt });
    this.#nextDeferredExpiry = Math.min(this.#nextDeferredExpiry, observedAt + this.recoveryWindowMs);
    this.#settledRunIds.delete(runId);
    return undefined;
  }

  /** Promotes every warm deferred delivery for the specified run and thread. */
  claim(runId: string, key: string): ThreadSignalDelivery[] {
    this.#sweepExpiredDeferred();
    const run = this.#runs.get(runId);
    if (!run) return [];
    const claimed: ThreadSignalDelivery[] = [];
    for (const [signalId, deferred] of run.deferred) {
      const { delivery } = deferred;
      if (delivery.key !== key) continue;
      run.deferred.delete(signalId);
      if (run.handled.has(signalId)) continue;
      run.handled.add(signalId);
      claimed.push(delivery);
    }
    this.#trackSettled(runId, run);
    return claimed;
  }

  /** Marks a run terminal so its replay tombstones become eligible for bounded retention. */
  settle(runId: string): void {
    const run = this.#runs.get(runId);
    if (!run) return;
    run.terminal = true;
    this.#trackSettled(runId, run);
  }

  /** Clears all deferred deliveries and replay tombstones. */
  clear(): void {
    this.#runs.clear();
    this.#settledRunIds.clear();
    this.#nextDeferredExpiry = Number.POSITIVE_INFINITY;
  }

  #get(runId: string): RunSignalDeliveries {
    const existing = this.#runs.get(runId);
    if (existing) return existing;
    const created = {
      handled: new Set<string>(),
      deferred: new Map<string, { delivery: ThreadSignalDelivery; observedAt: number }>(),
      terminal: false,
    };
    this.#runs.set(runId, created);
    return created;
  }

  #trackSettled(runId: string, deliveries: RunSignalDeliveries): void {
    if (!deliveries.terminal || deliveries.deferred.size > 0) return;
    this.#settledRunIds.delete(runId);
    this.#settledRunIds.add(runId);
    while (this.#settledRunIds.size > MAX_TRACKED_RUNS) {
      const oldestRunId = this.#settledRunIds.values().next().value;
      if (oldestRunId === undefined) break;
      this.#settledRunIds.delete(oldestRunId);
      this.#runs.delete(oldestRunId);
    }
  }

  #sweepExpiredDeferred(): void {
    const now = this.now();
    if (now < this.#nextDeferredExpiry) return;

    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const [runId, run] of this.#runs) {
      for (const [signalId, deferred] of run.deferred) {
        const expiresAt = deferred.observedAt + this.recoveryWindowMs;
        if (expiresAt <= now) {
          run.deferred.delete(signalId);
        } else {
          nextExpiry = Math.min(nextExpiry, expiresAt);
        }
      }
      this.#trackSettled(runId, run);
      if (run.handled.size === 0 && run.deferred.size === 0) this.#runs.delete(runId);
    }
    this.#nextDeferredExpiry = nextExpiry;
  }
}
