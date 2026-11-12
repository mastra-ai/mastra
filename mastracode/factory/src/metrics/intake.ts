import type { MetricsCollector } from './metrics.js';
import { factoryMetrics } from './metrics.js';

export type IntakeSource = 'github' | 'linear' | 'gitlab';

/** One inbound event handed to a source's rules, by how it ended (`committed`, `replayed`, `ignored`, `missing`, `error`). */
export function recordIntakeEvent(source: IntakeSource, outcome: string): void {
  factoryMetrics().count('intake', 'mastra_factory_intake_events_total', { source, outcome });
}

// When each source's reconcile sweep last finished cleanly, in this process.
const lastSweepAt = new Map<IntakeSource, number>();

/**
 * One reconcile sweep. `replayed` counts changes the sweep found that live events never
 * delivered: each one is a missed webhook.
 */
export function recordReconcileSweep(
  source: IntakeSource,
  kind: string,
  result: { replayed: number; ok: boolean },
): void {
  const metrics = factoryMetrics();
  if (!metrics.enabled('intake')) return;
  if (result.replayed > 0)
    metrics.count('intake', 'mastra_factory_intake_replayed_total', { source, kind }, result.replayed);
  if (result.ok) lastSweepAt.set(source, Date.now());
  else metrics.count('intake', 'mastra_factory_intake_sweep_failures_total', { source, kind });
}

/** One poll of a Platform-connected source. */
export function recordIntakePoll(source: IntakeSource, ms: number): void {
  factoryMetrics().observe('intake', 'mastra_factory_intake_poll_ms', ms, { source });
}

/**
 * Age of each source's last clean reconcile sweep. Growing without bound means the sweep has
 * stalled, and webhooks it would have caught stay missed.
 */
export function intakeCollector(): MetricsCollector {
  return {
    collect(sink) {
      const now = Date.now();
      for (const [source, at] of lastSweepAt) {
        sink.emit('mastra_factory_intake_last_sweep_age_s', (now - at) / 1000, { source });
      }
    },
  };
}
