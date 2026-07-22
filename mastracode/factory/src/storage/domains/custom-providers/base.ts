import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * A user-defined OpenAI-compatible provider. The DB-backed counterpart of the
 * local `settings.json` `customProviders` entries: org-scoped rows keyed by the
 * derived provider id (name slug), API key stored alongside so a deployed
 * server never reads the shared settings file.
 */
export interface CustomProviderRecord {
  id: string;
  orgId: string;
  createdBy: string;
  /** Stable slug derived from the name (`getCustomProviderId`). */
  providerId: string;
  name: string;
  url: string;
  apiKey: string | null;
  models: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertCustomProviderInput {
  providerId: string;
  name: string;
  url: string;
  apiKey?: string;
  models: string[];
}

export const CUSTOM_PROVIDERS_SCHEMA: CollectionSchema = {
  name: 'custom_providers',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    created_by: { type: 'text' },
    provider_id: { type: 'text' },
    name: { type: 'text' },
    url: { type: 'text' },
    api_key: { type: 'text', nullable: true },
    models: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'custom_providers_org_provider_key', columns: ['org_id', 'provider_id'] }],
};

interface CustomProviderDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  created_by: string;
  provider_id: string;
  name: string;
  url: string;
  api_key: string | null;
  models: string[];
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: CustomProviderDbRow): CustomProviderRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    createdBy: row.created_by,
    providerId: row.provider_id,
    name: row.name,
    url: row.url,
    apiKey: row.api_key,
    models: Array.isArray(row.models) ? row.models : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomProvidersStorage extends FactoryStorageDomain {
  constructor() {
    super('custom-providers');
  }

  async init(): Promise<void> {
    await this.ensureCollections([CUSTOM_PROVIDERS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('custom_providers', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /**
   * Create or wholesale-replace a provider by `(orgId, providerId)` — mirrors
   * the settings.json upsert semantics (no key retention: an absent `apiKey`
   * clears the stored key). `previousProviderId` removes the old row on rename.
   */
  async upsert({
    orgId,
    userId,
    input,
    previousProviderId,
  }: {
    orgId: string;
    userId: string;
    input: UpsertCustomProviderInput;
    previousProviderId?: string;
  }): Promise<CustomProviderRecord> {
    const now = new Date();
    if (previousProviderId && previousProviderId !== input.providerId) {
      await this.#db.deleteMany('custom_providers', { org_id: orgId, provider_id: previousProviderId });
    }
    const existing = await this.#db.findOne<CustomProviderDbRow>('custom_providers', {
      org_id: orgId,
      provider_id: input.providerId,
    });
    if (existing) {
      const row = await this.#db.updateAtomic<CustomProviderDbRow>(
        'custom_providers',
        { org_id: orgId, id: existing.id },
        () => ({
          name: input.name,
          url: input.url,
          api_key: input.apiKey ?? null,
          models: input.models,
          updated_at: now,
        }),
      );
      return toRecord(row ?? existing);
    }
    const row = await this.#db.insertOne<CustomProviderDbRow>('custom_providers', {
      org_id: orgId,
      created_by: userId,
      provider_id: input.providerId,
      name: input.name,
      url: input.url,
      api_key: input.apiKey ?? null,
      models: input.models,
      created_at: now,
      updated_at: now,
    });
    return toRecord(row);
  }

  async list({ orgId }: { orgId: string }): Promise<CustomProviderRecord[]> {
    const rows = await this.#db.findMany<CustomProviderDbRow>(
      'custom_providers',
      { org_id: orgId },
      { orderBy: [['name', 'asc']] },
    );
    return rows.map(toRecord);
  }

  async delete({ orgId, providerId }: { orgId: string; providerId: string }): Promise<boolean> {
    return (await this.#db.deleteMany('custom_providers', { org_id: orgId, provider_id: providerId })) > 0;
  }
}
