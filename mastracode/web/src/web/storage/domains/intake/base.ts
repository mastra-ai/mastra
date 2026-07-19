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

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

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
export class IntakeStorage extends FactoryStorageDomain {
  constructor() {
    super('intake');
  }

  async init(): Promise<void> {
    await this.ensureCollections([INTAKE_SETTINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('intake_settings', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
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
    const where = { org_id: orgId, user_id: userId };
    const updateExisting = () =>
      this.#db.updateAtomic('intake_settings', where, () => ({ config, updated_at: new Date() }));
    if (await updateExisting()) return;

    const now = new Date();
    try {
      await this.#db.insertOne('intake_settings', { ...where, config, created_at: now, updated_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the insert race — update the winning row under the backend's serialized write primitive.
      if (!(await updateExisting())) throw error;
    }
  }
}
