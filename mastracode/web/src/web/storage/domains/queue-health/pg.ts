/**
 * Postgres queue-health settings storage, bound to the shared pool from the
 * `PostgresStore` injected into `MastraFactory`. `init()` owns the idempotent
 * DDL.
 */

import type pg from 'pg';

import type { FactoryStorageContext } from '../../domain';
import { assertValidThresholds, DEFAULT_QUEUE_HEALTH_CONFIG, QueueHealthStorage } from './base';
import type { QueueHealthConfig } from './base';

export const QUEUE_HEALTH_DDL = `
CREATE TABLE IF NOT EXISTS queue_health_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  github_project_id text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS queue_health_settings_org_project_unique ON queue_health_settings (org_id, github_project_id);
`;

export class QueueHealthStoragePG extends QueueHealthStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(QUEUE_HEALTH_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[QueueHealthStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  async getConfig(orgId: string, githubProjectId: string): Promise<QueueHealthConfig> {
    const { rows } = await this.#db.query<{ config: QueueHealthConfig }>(
      'SELECT config FROM queue_health_settings WHERE org_id = $1 AND github_project_id = $2',
      [orgId, githubProjectId],
    );
    return structuredClone(rows[0]?.config ?? DEFAULT_QUEUE_HEALTH_CONFIG);
  }

  async saveConfig(orgId: string, githubProjectId: string, config: QueueHealthConfig): Promise<void> {
    assertValidThresholds(config);
    await this.#db.query(
      `INSERT INTO queue_health_settings (org_id, github_project_id, config)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (org_id, github_project_id)
       DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
      [orgId, githubProjectId, JSON.stringify(config)],
    );
  }
}
