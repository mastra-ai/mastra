/**
 * Postgres intake settings storage, bound to the shared pool from the
 * `PostgresStore` injected into `MastraFactory`. `init()` owns the idempotent
 * DDL (formerly `INTAKE_MIGRATION_SQL` + `ensureIntakeDbReady()`).
 */

import type pg from 'pg';

import type { FactoryStorageContext } from '../../domain';
import { DEFAULT_INTAKE_CONFIG, IntakeStorage } from './base';
import type { IntakeConfig } from './base';

export const INTAKE_DDL = `
CREATE TABLE IF NOT EXISTS intake_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  user_id text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS intake_settings_org_user_unique ON intake_settings (org_id, user_id);
`;

export class IntakeStoragePG extends IntakeStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(INTAKE_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[IntakeStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  async getConfig(orgId: string, userId: string): Promise<IntakeConfig> {
    const { rows } = await this.#db.query<{ config: IntakeConfig }>(
      'SELECT config FROM intake_settings WHERE org_id = $1 AND user_id = $2',
      [orgId, userId],
    );
    return rows[0]?.config ?? DEFAULT_INTAKE_CONFIG;
  }

  async saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
    await this.#db.query(
      `INSERT INTO intake_settings (org_id, user_id, config)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (org_id, user_id)
       DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
      [orgId, userId, JSON.stringify(config)],
    );
  }
}
