import type {
  Monitor,
  MonitorAggregation,
  MonitorEvent,
  MonitorsStorage,
  MonitorThresholdOp,
} from '../../storage/domains/monitors';
import type { ScoresStorage } from '../../storage/domains/scores';
import type { ScoreRowData } from '../types';

const PAGE_SIZE = 1000;

export interface EvaluateMonitorsOptions {
  monitorsStore: MonitorsStorage;
  scoresStore: ScoresStorage;
  /** Evaluation timestamp (epoch ms). Defaults to `Date.now()`. */
  now?: number;
  /** Fetch implementation used for webhook delivery. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  logger?: { error: (msg: string, meta?: Record<string, unknown>) => void };
}

export interface MonitorEvaluationResult {
  monitorId: string;
  /** Aggregated value for the window; null when the window had no scores. */
  value: number | null;
  count: number;
  breached: boolean;
  /** True when a breach notification was actually sent (not suppressed by cooldown). */
  notified: boolean;
  /** Events recorded during this evaluation. */
  events: MonitorEvent[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function aggregate(scores: number[], aggregation: MonitorAggregation, passThreshold: number): number | null {
  if (aggregation === 'count') return scores.length;
  if (scores.length === 0) return null;
  switch (aggregation) {
    case 'avg':
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    case 'p50':
      return percentile(
        [...scores].sort((a, b) => a - b),
        0.5,
      );
    case 'p95':
      return percentile(
        [...scores].sort((a, b) => a - b),
        0.95,
      );
    case 'passRate':
      return scores.filter(s => s >= passThreshold).length / scores.length;
  }
}

function compare(value: number, op: MonitorThresholdOp, threshold: number): boolean {
  switch (op) {
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
  }
}

async function collectWindowScores(
  scoresStore: ScoresStorage,
  monitor: Monitor,
  windowStart: number,
  windowEnd: number,
): Promise<ScoreRowData[]> {
  const all: ScoreRowData[] = [];
  let page = 0;
  // Page until a short page — window score volumes are expected to stay modest.
  for (;;) {
    const res = await scoresStore.listScores({
      filter: {
        ...monitor.filter,
        startDate: new Date(windowStart),
        endDate: new Date(windowEnd),
      },
      pagination: { page, perPage: PAGE_SIZE },
    });
    all.push(...res.scores);
    if (res.scores.length < PAGE_SIZE) break;
    page += 1;
  }
  return all;
}

/**
 * Evaluates a single monitor: aggregates matching scores over its window,
 * checks the threshold, records breach/recovery events, and delivers webhook
 * notifications (respecting cooldown). Never throws on delivery failure —
 * failures are recorded as `delivery_failure` events instead.
 */
export async function evaluateMonitor(
  monitor: Monitor,
  opts: EvaluateMonitorsOptions,
): Promise<MonitorEvaluationResult> {
  const now = opts.now ?? Date.now();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const windowStart = now - monitor.windowMinutes * 60_000;
  const windowEnd = now;

  const scores = await collectWindowScores(opts.scoresStore, monitor, windowStart, windowEnd);
  const values = scores.map(s => s.score);
  const value = aggregate(values, monitor.aggregation, monitor.passThreshold ?? 1);

  let breached: boolean;
  if (value === null) {
    breached = (monitor.noDataBehavior ?? 'skip') === 'breach';
  } else {
    breached = compare(value, monitor.threshold.op, monitor.threshold.value);
  }

  const events: MonitorEvent[] = [];
  let notified = false;

  if (breached) {
    const cooldownMs = (monitor.cooldownMinutes ?? 0) * 60_000;
    const inCooldown = monitor.lastBreachAt != null && now - monitor.lastBreachAt < cooldownMs;
    if (!inCooldown) {
      const breachEvent = await opts.monitorsStore.recordMonitorEvent({
        monitorId: monitor.id,
        type: 'breach',
        value,
        count: values.length,
        threshold: monitor.threshold,
        windowStart,
        windowEnd,
        createdAt: now,
      });
      events.push(breachEvent);
      notified = true;

      const payload = {
        monitor: { id: monitor.id, name: monitor.name },
        type: 'breach' as const,
        value,
        count: values.length,
        aggregation: monitor.aggregation,
        threshold: monitor.threshold,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
      };

      for (const channel of monitor.channels) {
        const body =
          channel.format === 'slack'
            ? JSON.stringify({
                text: `:rotating_light: Monitor "${monitor.name}" breached: ${monitor.aggregation} ${value === null ? 'no data' : value.toFixed(4)} ${monitor.threshold.op} ${monitor.threshold.value} (${values.length} scores)`,
              })
            : JSON.stringify(payload);
        try {
          const res = await fetchImpl(channel.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          if (!res.ok) {
            throw new Error(`Webhook responded with status ${res.status}`);
          }
        } catch (error) {
          const failureEvent = await opts.monitorsStore.recordMonitorEvent({
            monitorId: monitor.id,
            type: 'delivery_failure',
            value,
            count: values.length,
            threshold: monitor.threshold,
            windowStart,
            windowEnd,
            error: error instanceof Error ? error.message : String(error),
            metadata: { channelUrl: channel.url },
            createdAt: now,
          });
          events.push(failureEvent);
          opts.logger?.error?.(`Monitor webhook delivery failed`, { monitorId: monitor.id, url: channel.url });
        }
      }
    }
    await opts.monitorsStore.updateMonitor(monitor.id, {
      lastEvaluatedAt: now,
      breached: true,
      ...(notified ? { lastBreachAt: now } : {}),
    });
  } else {
    if (monitor.breached && value !== null) {
      const recoveryEvent = await opts.monitorsStore.recordMonitorEvent({
        monitorId: monitor.id,
        type: 'recovery',
        value,
        count: values.length,
        threshold: monitor.threshold,
        windowStart,
        windowEnd,
        createdAt: now,
      });
      events.push(recoveryEvent);
    }
    await opts.monitorsStore.updateMonitor(monitor.id, {
      lastEvaluatedAt: now,
      // Only re-arm on a real observation; a no-data window keeps prior state.
      ...(value !== null ? { breached: false } : {}),
    });
  }

  return { monitorId: monitor.id, value, count: values.length, breached, notified, events };
}

/**
 * Evaluates every active monitor exactly once. Individual monitor failures
 * are logged and skipped so one bad monitor never blocks the rest — the
 * evaluation loop must never crash.
 */
export async function evaluateMonitors(opts: EvaluateMonitorsOptions): Promise<MonitorEvaluationResult[]> {
  const monitors = await opts.monitorsStore.listMonitors({ status: 'active' });
  const results: MonitorEvaluationResult[] = [];
  for (const monitor of monitors) {
    try {
      results.push(await evaluateMonitor(monitor, opts));
    } catch (error) {
      opts.logger?.error?.(`Monitor evaluation failed`, {
        monitorId: monitor.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
