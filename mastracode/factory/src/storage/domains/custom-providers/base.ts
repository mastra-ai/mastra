import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';

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

export class CustomProvidersStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('custom-providers');
  }

  async init(): Promise<void> {
    await this.ensureCollections([CUSTOM_PROVIDERS_SCHEMA]);
    const rows = await this.ops.findMany<CustomProviderDbRow>('custom_providers', {});
    await Promise.all(rows.filter(row => row.api_key !== null).map(row => this.#migrateApiKey(row.id)));
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('custom_providers', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #toRecord(row: CustomProviderDbRow): Promise<CustomProviderRecord> {
    const apiKey = row.api_key === null ? null : (await this.encryption.decrypt<string>(row.api_key)).value;
    return {
      id: row.id,
      orgId: row.org_id,
      createdBy: row.created_by,
      providerId: row.provider_id,
      name: row.name,
      url: row.url,
      apiKey,
      models: Array.isArray(row.models) ? row.models : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async #encryptApiKey(apiKey: string | undefined): Promise<string | null> {
    return apiKey === undefined ? null : this.encryption.encrypt(apiKey);
  }

  async #migrateApiKey(id: string): Promise<void> {
    await this.#db.updateAtomic<CustomProviderDbRow>('custom_providers', { id }, async row => {
      if (row.api_key === null) return null;
      const decrypted = await this.encryption.decrypt<string>(row.api_key);
      return decrypted.needsReencryption ? { api_key: await this.encryption.encrypt(decrypted.value) } : null;
    });
  }

  /**
   * Create or wholesale-replace a provider by `(orgId, providerId)` — mirrors
   * the settings.json upsert semantics (no key retention: an absent `apiKey`
   * clears the stored key). `previousProviderId` renames the provider: the
   * common path is a single atomic in-place update of the old row; renaming
   * onto an id that already exists overwrites the target first and removes the
   * old row last, so no interleaving or failure can lose the provider.
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
    const encryptedApiKey = await this.#encryptApiKey(input.apiKey);
    const renameFrom = previousProviderId && previousProviderId !== input.providerId ? previousProviderId : undefined;

    if (renameFrom) {
      const target = await this.#db.findOne<CustomProviderDbRow>('custom_providers', {
        org_id: orgId,
        provider_id: input.providerId,
      });
      if (!target) {
        // In-place rename: one atomic write with no delete/insert gap, so a
        // failure can never drop the provider (and `created_at`/`created_by`
        // are preserved). If a concurrent create grabs the new id between the
        // lookup and this update, the unique index rejects the update and the
        // old row stays intact — the request fails cleanly and a retry
        // converges on the rename-onto-existing path below.
        const renamed = await this.#db.updateAtomic<CustomProviderDbRow>(
          'custom_providers',
          { org_id: orgId, provider_id: renameFrom },
          () => ({
            provider_id: input.providerId,
            name: input.name,
            url: input.url,
            api_key: encryptedApiKey,
            models: input.models,
            updated_at: now,
          }),
        );
        if (renamed) return this.#toRecord(renamed);
        // Old row already gone — fall through to a plain create of the new id.
      }
      // Rename onto an existing id: overwrite the target below, then delete
      // the old row last — a failure in the gap leaves a redundant duplicate
      // (recoverable by re-submitting or deleting) instead of losing data.
    }

    const record = await this.#write({ orgId, userId, input, encryptedApiKey, now });
    if (renameFrom) {
      await this.#db.deleteMany('custom_providers', { org_id: orgId, provider_id: renameFrom });
    }
    return record;
  }

  /**
   * Update-first, then insert-and-catch-unique-violation (see `queue_health`):
   * concurrent creates of the same provider both succeed (last write wins on
   * the single row) instead of one failing on the unique index, and a row
   * deleted mid-flight is recreated rather than reported as a stale success.
   */
  async #write({
    orgId,
    userId,
    input,
    encryptedApiKey,
    now,
  }: {
    orgId: string;
    userId: string;
    input: UpsertCustomProviderInput;
    encryptedApiKey: string | null;
    now: Date;
  }): Promise<CustomProviderRecord> {
    const updateExisting = () =>
      this.#db.updateAtomic<CustomProviderDbRow>(
        'custom_providers',
        { org_id: orgId, provider_id: input.providerId },
        () => ({
          name: input.name,
          url: input.url,
          api_key: encryptedApiKey,
          models: input.models,
          updated_at: now,
        }),
      );

    const updated = await updateExisting();
    if (updated) return this.#toRecord(updated);

    try {
      const row = await this.#db.insertOne<CustomProviderDbRow>('custom_providers', {
        org_id: orgId,
        created_by: userId,
        provider_id: input.providerId,
        name: input.name,
        url: input.url,
        api_key: encryptedApiKey,
        models: input.models,
        created_at: now,
        updated_at: now,
      });
      return this.#toRecord(row);
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      // Lost the insert race — apply this write to the winning row.
      const row = await updateExisting();
      if (!row) throw error;
      return this.#toRecord(row);
    }
  }

  async list({ orgId }: { orgId: string }): Promise<CustomProviderRecord[]> {
    const rows = await this.#db.findMany<CustomProviderDbRow>(
      'custom_providers',
      { org_id: orgId },
      { orderBy: [['name', 'asc']] },
    );
    return Promise.all(rows.map(row => this.#toRecord(row)));
  }

  async delete({ orgId, providerId }: { orgId: string; providerId: string }): Promise<boolean> {
    return (await this.#db.deleteMany('custom_providers', { org_id: orgId, provider_id: providerId })) > 0;
  }
}
