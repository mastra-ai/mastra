/**
 * Intake source configuration domain: which sources feed the Factory Intake
 * page.
 *
 * Stored per `(org, user)` — each user picks their own intake sources within
 * the org's connected integrations:
 *  - GitHub: which of the org's projects (repos) contribute issues.
 *  - Linear: which projects contribute issues.
 *
 * `projectIds` of `null` mean "nothing selected" — the source syncs nothing
 * until the user explicitly picks projects. An `enabled` flag of `false`
 * hides the source entirely regardless of selection.
 */

import { UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

export interface IntakeConfig {
  github: {
    enabled: boolean;
    /** GitHub project ids (app DB uuids) to sync; `null` = nothing selected. */
    projectIds: string[] | null;
  };
  linear: {
    enabled: boolean;
    /** Linear project ids to sync; `null` = nothing selected. */
    projectIds: string[] | null;
  };
}

/** Default: both sources on, but nothing synced until projects are picked. */
export const DEFAULT_INTAKE_CONFIG: IntakeConfig = {
  github: { enabled: true, projectIds: null },
  linear: { enabled: true, projectIds: null },
};

export const INTAKE_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'intake_settings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    config: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'intake_settings_org_user_unique', columns: ['org_id', 'user_id'] }],
};

/**
 * Intake settings storage, written once against the generic
 * `FactoryStorageOps` surface — works on any `FactoryStorage` backend.
 */
export class IntakeStorage implements FactoryStorageDomain {
  readonly name = 'intake';
  #ops?: FactoryStorageOps;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.storage.ensureCollections([INTAKE_SETTINGS_SCHEMA]);
    this.#ops = ctx.storage.ops;
  }

  get #db(): FactoryStorageOps {
    if (!this.#ops) throw new Error('[IntakeStorage] Not initialized — init() has not succeeded.');
    return this.#ops;
  }

  /** Read the caller's intake config, falling back to {@link DEFAULT_INTAKE_CONFIG}. */
  async getConfig(orgId: string, userId: string): Promise<IntakeConfig> {
    const row = await this.#db.findOne<{ config: IntakeConfig }>('intake_settings', {
      org_id: orgId,
      user_id: userId,
    });
    return structuredClone(row?.config ?? DEFAULT_INTAKE_CONFIG);
  }

  /** Upsert the caller's intake config (`created_at` is preserved on update). */
  async saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
    const now = new Date();
    const where = { org_id: orgId, user_id: userId };
    const updated = await this.#db.updateMany('intake_settings', where, { config, updated_at: now });
    if (updated > 0) return;
    try {
      await this.#db.insertOne('intake_settings', { ...where, config, created_at: now, updated_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the insert race — the row exists now; apply as an update.
      await this.#db.updateMany('intake_settings', where, { config, updated_at: now });
    }
  }
}
