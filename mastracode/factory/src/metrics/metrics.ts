import type { MetricsContext } from '@mastra/core/observability';

import type { MetricGroup, MetricsService, ResolvedMetricsConfig } from './config.js';

export type MetricLabels = Record<string, string>;

/** The subset of the Mastra logger metrics write to. */
export interface MetricsLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

/** Where collectors send their samples; capped per tick. */
export interface MetricSink {
  emit(name: string, value: number, labels?: MetricLabels): void;
}

/** Sampled once per interval. */
export interface MetricsCollector {
  collect(sink: MetricSink): Promise<void> | void;
}

export interface MetricsTargets {
  /**
   * The metrics context to send to. Read on every flush: Platform registers its exporter on the
   * Mastra instance after the app module has loaded, replacing the no-op context.
   */
  getMetrics: () => Pick<MetricsContext, 'emit'> | undefined;
  getLogger: () => MetricsLogger | undefined;
}

// Observations kept per series per interval for the p95; count, sum and max stay exact past it.
const MAX_SAMPLES = 1_000;

interface Observation {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  max: number;
  samples: number[];
}

interface Counter {
  name: string;
  labels: MetricLabels;
  value: number;
}

function seriesKey(name: string, labels: MetricLabels): string {
  return `${name}\u0000${Object.keys(labels)
    .sort()
    .map(key => `${key}=${labels[key]}`)
    .join(',')}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
}

/**
 * Factory's metrics. Call sites check `enabled(group)` (or just call `count`/`observe`, which do
 * nothing for a group that's off). Counts and timings are aggregated in-process and sent once per
 * interval, so a burst of events costs one record per series, not one per event.
 */
export class FactoryMetrics {
  readonly #config: ResolvedMetricsConfig | undefined;
  readonly #service: MetricsService;
  readonly #counters = new Map<string, Counter>();
  readonly #observations = new Map<string, Observation>();
  #collectors: MetricsCollector[] = [];
  #targets: MetricsTargets | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  #running = false;

  constructor(config: ResolvedMetricsConfig | undefined, service: MetricsService) {
    this.#config = config;
    this.#service = service;
  }

  get service(): MetricsService {
    return this.#service;
  }

  get intervalMs(): number {
    return this.#config?.intervalMs ?? 0;
  }

  enabled(group: MetricGroup): boolean {
    return this.#config?.groups.has(group) ?? false;
  }

  /** Adds `value` to a counter, sent as one record per series per interval. */
  count(group: MetricGroup, name: string, labels: MetricLabels = {}, value = 1): void {
    if (!this.enabled(group) || !Number.isFinite(value)) return;
    const key = seriesKey(name, labels);
    const counter = this.#counters.get(key);
    if (counter) counter.value += value;
    else this.#counters.set(key, { name, labels, value });
  }

  /** Records a timing, sent per interval as `stat=count|avg|p95|max` on the same series. */
  observe(group: MetricGroup, name: string, value: number, labels: MetricLabels = {}): void {
    if (!this.enabled(group) || !Number.isFinite(value)) return;
    const key = seriesKey(name, labels);
    let observation = this.#observations.get(key);
    if (!observation) {
      observation = { name, labels, count: 0, sum: 0, max: -Infinity, samples: [] };
      this.#observations.set(key, observation);
    }
    observation.count++;
    observation.sum += value;
    observation.max = Math.max(observation.max, value);
    if (observation.samples.length < MAX_SAMPLES) observation.samples.push(value);
  }

  /** Starts the interval timer. Does nothing when every group is off. */
  start(targets: MetricsTargets, collectors: MetricsCollector[]): void {
    if (!this.#config || this.#timer) return;
    this.#targets = targets;
    this.#collectors = collectors;
    for (const name of this.#config.unknownGroups) {
      targets.getLogger()?.warn(`[factory:metrics] Unknown metric group "${name}" ignored.`);
    }
    this.#timer = setInterval(() => void this.tick(), this.#config.intervalMs);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  /**
   * Samples the collectors, then sends aggregated counters and timings. Skipped while the previous
   * tick is still running, so a hung dependency never piles up probes. Exposed for tests.
   */
  async tick(): Promise<void> {
    if (!this.#config || this.#running) return;
    this.#running = true;
    try {
      const metrics = this.#targets?.getMetrics();
      const budget = Math.max(1, Math.floor((this.#config.maxPerMinute * this.#config.intervalMs) / 60_000));
      let used = 0;
      let dropped = 0;
      const service = this.#service;
      const sink: MetricSink = {
        emit(name, value, labels) {
          if (!Number.isFinite(value)) return;
          if (used >= budget) {
            dropped++;
            return;
          }
          used++;
          metrics?.emit(name, value, { ...labels, service });
        },
      };

      const results = await Promise.allSettled(this.#collectors.map(collector => collector.collect(sink)));
      for (const result of results) {
        if (result.status === 'rejected') {
          this.#targets?.getLogger()?.warn('[factory:metrics] Collector failed.', { error: String(result.reason) });
        }
      }

      for (const counter of this.#counters.values()) sink.emit(counter.name, counter.value, counter.labels);
      this.#counters.clear();
      for (const observation of this.#observations.values()) {
        const { name, labels, count, sum, max } = observation;
        const sorted = observation.samples.sort((a, b) => a - b);
        sink.emit(name, count, { ...labels, stat: 'count' });
        sink.emit(name, sum / count, { ...labels, stat: 'avg' });
        sink.emit(name, percentile(sorted, 0.95), { ...labels, stat: 'p95' });
        sink.emit(name, max, { ...labels, stat: 'max' });
      }
      this.#observations.clear();

      // Always sent, past the budget, so a capped deployment can see it is capped.
      if (dropped > 0) metrics?.emit('mastra_factory_metrics_dropped_total', dropped, { service });
    } finally {
      this.#running = false;
    }
  }
}

let current = new FactoryMetrics(undefined, 'all');

/** The process's Factory metrics. A no-op until a `MastraFactory` with metrics is constructed. */
export function factoryMetrics(): FactoryMetrics {
  return current;
}

/** Replaces the process's Factory metrics, stopping the previous one. One Factory per process. */
export function installFactoryMetrics(metrics: FactoryMetrics): void {
  current.stop();
  current = metrics;
}
