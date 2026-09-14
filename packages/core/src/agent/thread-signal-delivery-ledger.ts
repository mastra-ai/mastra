import type { CreatedAgentSignal } from './signals';

export type ThreadSignalDelivery = {
  key: string;
  signal: CreatedAgentSignal;
  scope: 'pending' | 'pre-run';
};

type RunSignalDeliveries = {
  handled: Set<string>;
  deferred: Map<string, ThreadSignalDelivery>;
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

  markHandled(runId: string, signalId: string): void {
    const run = this.#get(runId);
    run.deferred.delete(signalId);
    run.handled.add(signalId);
    this.#trackSettled(runId, run);
  }

  observe(runId: string, delivery: ThreadSignalDelivery, ownsRun: boolean): ThreadSignalDelivery | undefined {
    const run = this.#get(runId);
    if (run.handled.has(delivery.signal.id)) return undefined;
    const deferred = run.deferred.get(delivery.signal.id);
    if (ownsRun) {
      run.deferred.delete(delivery.signal.id);
      run.handled.add(delivery.signal.id);
      this.#trackSettled(runId, run);
      return deferred ?? delivery;
    }
    if (deferred) return undefined;
    run.deferred.set(delivery.signal.id, delivery);
    this.#settledRunIds.delete(runId);
    return undefined;
  }

  claim(runId: string, key: string): ThreadSignalDelivery[] {
    const run = this.#runs.get(runId);
    if (!run) return [];
    const claimed: ThreadSignalDelivery[] = [];
    for (const [signalId, delivery] of run.deferred) {
      if (delivery.key !== key) continue;
      run.deferred.delete(signalId);
      if (run.handled.has(signalId)) continue;
      run.handled.add(signalId);
      claimed.push(delivery);
    }
    this.#trackSettled(runId, run);
    return claimed;
  }

  settle(runId: string): void {
    const run = this.#runs.get(runId);
    if (!run) return;
    run.terminal = true;
    this.#trackSettled(runId, run);
  }

  clear(): void {
    this.#runs.clear();
    this.#settledRunIds.clear();
  }

  #get(runId: string): RunSignalDeliveries {
    const existing = this.#runs.get(runId);
    if (existing) return existing;
    const created = { handled: new Set<string>(), deferred: new Map<string, ThreadSignalDelivery>(), terminal: false };
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
}
