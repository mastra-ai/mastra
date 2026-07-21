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

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

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

/** Validate untrusted JSON into a `QueueHealthConfig`, or `null` when invalid. */
export function parseQueueHealthConfig(body: unknown): QueueHealthConfig | null {
  if (typeof body !== 'object' || body === null) return null;
  const config = body as { thresholdsSeconds?: unknown };
  if (!Array.isArray(config.thresholdsSeconds)) return null;
  try {
    assertValidThresholds(config as QueueHealthConfig);
  } catch {
    return null;
  }
  return { thresholdsSeconds: [...(config as QueueHealthConfig).thresholdsSeconds] };
}

/**
 * Return `config.thresholdsSeconds` when valid, else the default. Validation
 * lives at the `saveConfig` write boundary, but `getConfig` round-trips a
 * stored JSON row — a corrupted or hand-edited row (empty / non-ascending)
 * would otherwise reach the chart and invert bucket colors, so the read route
 * re-validates and falls back.
 */
export function thresholdsOrDefault(config: QueueHealthConfig): number[] {
  return parseQueueHealthConfig(config)?.thresholdsSeconds ?? DEFAULT_QUEUE_HEALTH_CONFIG.thresholdsSeconds;
}

export const QUEUE_HEALTH_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'queue_health_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    github_project_id: { type: 'text' },
    config: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'queue_health_settings_org_project_unique', columns: ['org_id', 'github_project_id'] }],
};

/**
 * Queue-health settings storage, written once against the generic
 * `FactoryStorageOps` surface — works on any `FactoryStorage` backend.
 */
export class QueueHealthStorage extends FactoryStorageDomain {
  constructor() {
    super('queue-health');
  }

  async init(): Promise<void> {
    await this.ensureCollections([QUEUE_HEALTH_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('queue_health_settings', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** Read the project's queue-health config, falling back to {@link DEFAULT_QUEUE_HEALTH_CONFIG}. */
  async getConfig(orgId: string, githubProjectId: string): Promise<QueueHealthConfig> {
    const row = await this.#db.findOne<{ config: unknown }>('queue_health_settings', {
      org_id: orgId,
      github_project_id: githubProjectId,
    });
    return structuredClone(parseQueueHealthConfig(row?.config) ?? DEFAULT_QUEUE_HEALTH_CONFIG);
  }

  /** Upsert the project's queue-health config (`created_at` is preserved on update). */
  async saveConfig(orgId: string, githubProjectId: string, config: QueueHealthConfig): Promise<void> {
    assertValidThresholds(config);
    const where = { org_id: orgId, github_project_id: githubProjectId };
    const updateExisting = () =>
      this.#db.updateAtomic('queue_health_settings', where, () => ({ config, updated_at: new Date() }));
    if (await updateExisting()) return;

    const now = new Date();
    try {
      await this.#db.insertOne('queue_health_settings', { ...where, config, created_at: now, updated_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the insert race — update the winning row under the backend's serialized write primitive.
      if (!(await updateExisting())) throw error;
    }
  }
}
