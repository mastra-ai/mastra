/**
 * Per-user intake selections for every configured intake integration.
 *
 * Integration ids are dynamic. Each integration contributes provider-neutral
 * sources through `FactoryIntegration.intake`; this domain only persists which
 * source ids the user selected.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export interface IntakeSelection {
  enabled: boolean;
  /** Provider-owned source ids; `null` means nothing is selected. */
  sourceIds: string[] | null;
}

export type IntakeConfig = Record<string, IntakeSelection>;

export interface EnabledIntakeSourceSelection {
  orgId: string;
  userId: string;
  sourceIds: string[];
}

export const DEFAULT_INTAKE_CONFIG: IntakeConfig = {};

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

  async getConfig({
    orgId,
    userId,
    integrationIds,
  }: {
    orgId: string;
    userId: string;
    /**
     * When provided, the result contains exactly these integration ids, with
     * unset integrations defaulting to `{ enabled: true, sourceIds: null }`.
     */
    integrationIds?: string[];
  }): Promise<IntakeConfig> {
    const row = await this.#db.findOne<{ config: IntakeConfig }>('intake_settings', {
      org_id: orgId,
      user_id: userId,
    });
    const saved = structuredClone(row?.config ?? DEFAULT_INTAKE_CONFIG);
    if (!integrationIds) return saved;
    return Object.fromEntries(
      integrationIds.map(integrationId => [integrationId, saved[integrationId] ?? { enabled: true, sourceIds: null }]),
    );
  }

  async listEnabledSourceSelections(integrationId: string): Promise<EnabledIntakeSourceSelection[]> {
    const rows = await this.#db.findMany<{ org_id: string; user_id: string; config: IntakeConfig }>(
      'intake_settings',
      {},
      {
        orderBy: [
          ['org_id', 'asc'],
          ['user_id', 'asc'],
        ],
      },
    );
    return rows.flatMap(row => {
      const selection = row.config[integrationId];
      if (!selection?.enabled || !selection.sourceIds?.length) return [];
      return [{ orgId: row.org_id, userId: row.user_id, sourceIds: [...selection.sourceIds] }];
    });
  }

  async saveConfig({ orgId, userId, config }: { orgId: string; userId: string; config: IntakeConfig }): Promise<void> {
    const now = new Date();
    const where = { org_id: orgId, user_id: userId };
    const updated = await this.#db.updateMany('intake_settings', where, { config, updated_at: now });
    if (updated > 0) return;
    try {
      await this.#db.insertOne('intake_settings', { ...where, config, created_at: now, updated_at: now });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      await this.#db.updateMany('intake_settings', where, { config, updated_at: now });
    }
  }
}
