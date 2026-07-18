/**
 * Queue-health threshold configuration domain: per-project age buckets for the
 * Factory Overview queue-health chart.
 *
 * Stored per `(org, github_project)` — each connected GitHub project gets its
 * own age thresholds so a fast-moving automated pipeline and a slow human one
 * can bucket "how old is the work" differently. `thresholdsSeconds` is an
 * ordered-ascending list of age boundaries in seconds: an item younger than
 * the first boundary is green, younger than the second amber, younger than the
 * third orange, and red otherwise. Seconds (not hours) so sub-minute buckets
 * are representable for fast automated flows.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

export interface QueueHealthConfig {
  /** Ordered-ascending age boundaries in seconds, e.g. `[14400, 86400, 259200]`. */
  thresholdsSeconds: number[];
}

/** Default: green <4h, amber <24h, orange <72h, red 72h+. */
export const DEFAULT_QUEUE_HEALTH_CONFIG: QueueHealthConfig = {
  thresholdsSeconds: [14400, 86400, 259200],
};

/**
 * Throw unless `thresholdsSeconds` is a non-empty ascending number list. A
 * descending config would silently invert bucket semantics, so validate at the
 * write boundary rather than trusting callers.
 */
export function assertValidThresholds(config: QueueHealthConfig): void {
  const t = config.thresholdsSeconds;
  if (!Array.isArray(t) || t.length === 0 || t.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new Error('[QueueHealthStorage] thresholdsSeconds must be a non-empty array of finite numbers.');
  }
  for (let i = 1; i < t.length; i++) {
    if (t[i]! <= t[i - 1]!) {
      throw new Error('[QueueHealthStorage] thresholdsSeconds must be strictly ascending.');
    }
  }
}

/**
 * Return `config.thresholdsSeconds` when valid, else the default. Validation
 * lives at the `saveConfig` write boundary, but `getConfig` round-trips a
 * stored JSONB row — a corrupted or hand-edited row (empty / non-ascending)
 * would otherwise reach the chart and invert bucket colors, so the read route
 * re-validates and falls back.
 */
export function thresholdsOrDefault(config: QueueHealthConfig): number[] {
  try {
    assertValidThresholds(config);
    return config.thresholdsSeconds;
  } catch {
    return DEFAULT_QUEUE_HEALTH_CONFIG.thresholdsSeconds;
  }
}

/**
 * Abstract queue-health settings storage. Backends own their DDL in `init()`;
 * query methods are the typed surface the health threshold route consumes.
 */
export abstract class QueueHealthStorage implements FactoryStorageDomain {
  readonly name = 'queue-health';

  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /** Read the project's queue-health config, falling back to {@link DEFAULT_QUEUE_HEALTH_CONFIG}. */
  abstract getConfig(orgId: string, githubProjectId: string): Promise<QueueHealthConfig>;

  /** Upsert the project's queue-health config. */
  abstract saveConfig(orgId: string, githubProjectId: string, config: QueueHealthConfig): Promise<void>;
}
