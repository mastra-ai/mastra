import { countRunningSessionSandboxes } from '../sandbox/session-sandbox.js';
import { postgresPoolCollector, postgresStatsCollector, asPool } from './collectors/postgres.js';
import type { PoolLike } from './collectors/postgres.js';
import { processCollector } from './collectors/process.js';
import { asMonitorablePubSub, connectMonitor, redisProbeCollector, redisStatsCollector } from './collectors/redis.js';
import type { RedisMonitorClient } from './collectors/redis.js';
import { intakeCollector } from './intake.js';
import type { FactoryMetrics, MetricsCollector, MetricsTargets } from './metrics.js';

export { METRIC_GROUPS, metricsService, resolveMetricsConfig } from './config.js';
export type { FactoryMetricsOptions, MetricGroup } from './config.js';
export { FactoryMetrics, factoryMetrics, installFactoryMetrics } from './metrics.js';

const SLOW_STATEMENTS_EVERY_MS = 10 * 60_000;

export interface MetricsSources {
  /** The Mastra storage, read for its `pg` pool when it's Postgres. */
  storage: unknown;
  vector: unknown;
  pubsub: unknown;
}

/**
 * Builds the collectors for the enabled groups and starts the interval timer. Server-wide stats
 * (Postgres activity, Redis memory and stream backlog) only run on the worker service (or a
 * single-process deployment), so a split deployment doesn't report them twice. Returns a stop
 * function that also closes the Redis monitor connection.
 */
export function startFactoryMetrics(
  metrics: FactoryMetrics,
  targets: MetricsTargets,
  sources: MetricsSources,
): () => Promise<void> {
  const intervalMs = metrics.intervalMs;
  if (intervalMs === 0) return async () => {};
  const timeoutMs = Math.min(5_000, intervalMs / 2);
  const serverWide = metrics.service !== 'api';
  const collectors: MetricsCollector[] = [];
  let redisClient: RedisMonitorClient | undefined;

  if (metrics.enabled('process')) collectors.push(processCollector());

  if (metrics.enabled('postgres')) {
    const pools: Record<string, PoolLike> = {};
    const store = asPool((sources.storage as { pool?: unknown } | undefined)?.pool);
    const vector = asPool((sources.vector as { pool?: unknown } | undefined)?.pool);
    if (store) pools.store = store;
    if (vector) pools.vector = vector;
    if (Object.keys(pools).length > 0) collectors.push(postgresPoolCollector(pools, timeoutMs));
    const statsPool = store ?? vector;
    if (statsPool && serverWide) {
      const statementsEveryTicks = Math.max(1, Math.round(SLOW_STATEMENTS_EVERY_MS / intervalMs));
      collectors.push(postgresStatsCollector(statsPool, timeoutMs, statementsEveryTicks, targets.getLogger));
    }
  }

  if (metrics.enabled('redis')) {
    const pubsub = asMonitorablePubSub(sources.pubsub);
    if (pubsub) {
      redisClient = connectMonitor(pubsub, targets.getLogger);
      collectors.push(redisProbeCollector(redisClient, timeoutMs));
      if (serverWide) collectors.push(redisStatsCollector(pubsub, redisClient, timeoutMs));
    }
  }

  if (metrics.enabled('sandbox')) {
    collectors.push({
      collect(sink) {
        sink.emit('mastra_factory_sandboxes_active', countRunningSessionSandboxes());
      },
    });
  }

  if (metrics.enabled('intake')) {
    collectors.push(intakeCollector());
  }

  metrics.start(targets, collectors);
  return async () => {
    metrics.stop();
    await redisClient?.destroy?.();
  };
}
