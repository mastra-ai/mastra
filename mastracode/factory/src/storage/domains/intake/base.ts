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

/**
 * Binds an intake source to the Factory project its items belong to.
 *
 * Intake selections are per user and org-wide, so they cannot say *where* an
 * ingested item should land. GitHub items are naturally scoped by their linked
 * repository; providers without that link (Linear) need this explicit binding
 * so viewing one project's board cannot materialize another project's items.
 */
export const INTAKE_SOURCE_BINDINGS_SCHEMA: CollectionSchema = {
  name: 'intake_source_bindings',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    integration_id: { type: 'text' },
    source_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    created_by_user_id: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'intake_source_bindings_project_idx', columns: ['org_id', 'factory_project_id'] }],
  uniqueIndexes: [
    {
      name: 'intake_source_bindings_org_integration_source_unique',
      columns: ['org_id', 'integration_id', 'source_id'],
    },
  ],
};

export interface IntakeSourceBinding {
  integrationId: string;
  sourceId: string;
  factoryProjectId: string;
}

type IntakeSourceBindingRow = {
  integration_id: string;
  source_id: string;
  factory_project_id: string;
};

export class IntakeStorage extends FactoryStorageDomain {
  constructor() {
    super('intake');
  }

  async init(): Promise<void> {
    await this.ensureCollections([INTAKE_SETTINGS_SCHEMA, INTAKE_SOURCE_BINDINGS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('intake_settings', {});
    await this.ops.deleteMany('intake_source_bindings', {});
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

  /** Every source binding in the org, optionally narrowed to one integration. */
  async listBindings({
    orgId,
    integrationId,
  }: {
    orgId: string;
    integrationId?: string;
  }): Promise<IntakeSourceBinding[]> {
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_bindings', {
      org_id: orgId,
      ...(integrationId ? { integration_id: integrationId } : {}),
    });
    return rows.map(row => ({
      integrationId: row.integration_id,
      sourceId: row.source_id,
      factoryProjectId: row.factory_project_id,
    }));
  }

  /** Source ids bound to one Factory project. Empty means "nothing bound". */
  async listBoundSourceIds({
    orgId,
    integrationId,
    factoryProjectId,
  }: {
    orgId: string;
    integrationId: string;
    factoryProjectId: string;
  }): Promise<string[]> {
    const rows = await this.#db.findMany<IntakeSourceBindingRow>('intake_source_bindings', {
      org_id: orgId,
      integration_id: integrationId,
      factory_project_id: factoryProjectId,
    });
    return rows.map(row => row.source_id);
  }

  /**
   * Points a source at a Factory project, replacing any existing binding.
   * A `null` project clears the binding.
   */
  async setBinding({
    orgId,
    integrationId,
    sourceId,
    factoryProjectId,
    userId,
  }: {
    orgId: string;
    integrationId: string;
    sourceId: string;
    factoryProjectId: string | null;
    userId?: string;
  }): Promise<void> {
    const where = { org_id: orgId, integration_id: integrationId, source_id: sourceId };
    if (factoryProjectId === null) {
      await this.#db.deleteMany('intake_source_bindings', where);
      return;
    }
    const now = new Date();
    const patch = { factory_project_id: factoryProjectId, updated_at: now };
    const updated = await this.#db.updateMany('intake_source_bindings', where, patch);
    if (updated > 0) return;
    try {
      await this.#db.insertOne('intake_source_bindings', {
        ...where,
        factory_project_id: factoryProjectId,
        created_by_user_id: userId ?? null,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      await this.#db.updateMany('intake_source_bindings', where, patch);
    }
  }
}
