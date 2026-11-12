import type { MetricsCollector } from './metrics.js';
import { factoryMetrics } from './metrics.js';

export type IntakeSource = 'github' | 'linear' | 'gitlab';

/** One inbound event handed to a source's rules, by how it ended (`committed`, `replayed`, `ignored`, `missing`, `error`). */
export function recordIntakeEvent(source: IntakeSource, outcome: string): void {
  factoryMetrics().count('intake', 'mastra_factory_intake_events_total', { source, outcome });
}

// When each source's reconcile sweep of each kind last finished cleanly, in this process.
const lastSweepAt = new Map<string, { source: IntakeSource; kind: string; at: number }>();

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
  if (result.ok) lastSweepAt.set(`${source}:${kind}`, { source, kind, at: Date.now() });
  else metrics.count('intake', 'mastra_factory_intake_sweep_failures_total', { source, kind });
}

/**
 * Age of each source's last clean reconcile sweep, per kind. Growing without bound means the sweep has
 * stalled, and webhooks it would have caught stay missed.
 */
export function intakeCollector(): MetricsCollector {
  return {
    collect(sink) {
      const now = Date.now();
      for (const { source, kind, at } of lastSweepAt.values()) {
        sink.emit('mastra_factory_intake_last_sweep_age_s', (now - at) / 1000, { source, kind });
      }
    },
  };
}
