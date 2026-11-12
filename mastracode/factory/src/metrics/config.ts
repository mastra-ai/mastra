/** Metric groups a deployment can turn on, one per component to investigate. */
export const METRIC_GROUPS = ['process', 'postgres', 'redis', 'sandbox', 'sessions', 'intake'] as const;
export type MetricGroup = (typeof METRIC_GROUPS)[number];

export interface FactoryMetricsOptions {
  /** Groups to collect, or `'all'`. An empty list turns metrics off. */
  groups: readonly MetricGroup[] | 'all';
  /** How often gauges are sampled and aggregated timings are sent. Default 60s, minimum 15s. */
  intervalMs?: number;
  /** Most records sent per minute per process; the rest are dropped and counted. Default 500. */
  maxRecordsPerMinute?: number;
}

export interface ResolvedMetricsConfig {
  groups: ReadonlySet<MetricGroup>;
  intervalMs: number;
  maxPerMinute: number;
  /** Group names that were asked for but don't exist. */
  unknownGroups: string[];
}

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;
// Longest delay setInterval accepts; Node turns anything above it into 1 ms.
const MAX_INTERVAL_MS = 2_147_483_647;
const DEFAULT_MAX_PER_MINUTE = 500;

function parseGroups(value: readonly string[] | 'all'): { groups: Set<MetricGroup>; unknownGroups: string[] } {
  if (value === 'all') return { groups: new Set(METRIC_GROUPS), unknownGroups: [] };
  const groups = new Set<MetricGroup>();
  const unknownGroups: string[] = [];
  for (const name of value) {
    if ((METRIC_GROUPS as readonly string[]).includes(name)) groups.add(name as MetricGroup);
    else unknownGroups.push(name);
  }
  return { groups, unknownGroups };
}

/**
 * Resolves which metric groups are on. Every record counts towards the deployment's observability
 * usage, so nothing is collected unless a group is asked for. Env vars override the code option:
 * `FACTORY_METRICS` (`all`, `0`, or a list like `sandbox,intake`), `FACTORY_METRICS_INTERVAL_MS`
 * and `FACTORY_METRICS_MAX_PER_MIN`. Returns `undefined` when no group is on.
 */
export function resolveMetricsConfig(
  option: FactoryMetricsOptions | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedMetricsConfig | undefined {
  const envGroups = env.FACTORY_METRICS?.trim();
  let requested: readonly string[] | 'all' | undefined = option?.groups;
  if (envGroups) {
    if (/^(0|false|no|off)$/i.test(envGroups)) return undefined;
    requested = /^(all|1|true|yes)$/i.test(envGroups)
      ? 'all'
      : envGroups
          .split(',')
          .map(name => name.trim())
          .filter(Boolean);
  }
  if (!requested) return undefined;
  const { groups, unknownGroups } = parseGroups(requested);
  if (groups.size === 0 && unknownGroups.length === 0) return undefined;

  const interval = Number(env.FACTORY_METRICS_INTERVAL_MS || option?.intervalMs);
  const maxPerMinute = Number(env.FACTORY_METRICS_MAX_PER_MIN || option?.maxRecordsPerMinute);
  return {
    groups,
    intervalMs:
      Number.isFinite(interval) && interval > 0
        ? Math.min(Math.max(interval, MIN_INTERVAL_MS), MAX_INTERVAL_MS)
        : DEFAULT_INTERVAL_MS,
    maxPerMinute: Number.isInteger(maxPerMinute) && maxPerMinute > 0 ? maxPerMinute : DEFAULT_MAX_PER_MINUTE,
    unknownGroups,
  };
}

export type MetricsService = 'api' | 'worker' | 'all';

/**
 * Which part of a split deployment this process is. Platform deploys a separate worker service
 * when the app has storage and pubsub: the API container runs with `MASTRA_WORKERS=false`, the
 * worker container with it set (empty, or a list of worker names). Unset means one process does both.
 */
export function metricsService(env: NodeJS.ProcessEnv = process.env): MetricsService {
  const workers = env.MASTRA_WORKERS;
  if (workers === undefined) return 'all';
  return workers.trim() === 'false' ? 'api' : 'worker';
}
