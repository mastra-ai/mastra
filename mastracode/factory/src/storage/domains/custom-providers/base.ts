import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';

/**
 * Who a custom provider belongs to: an organization, or one member of it.
 * The two never mix — a member's providers are invisible to the rest of the
 * organization, and both can hold a provider with the same name.
 */
export interface CustomProviderOwner {
  orgId: string;
  /** Set for a member's own providers; absent for the organization's. */
  userId?: string;
}

/**
 * A user-defined OpenAI-compatible provider. The DB-backed counterpart of the
 * local `settings.json` `customProviders` entries: rows keyed by owner and the
 * derived provider id (name slug), API key stored alongside so a deployed
 * server never reads the shared settings file.
 */
export interface CustomProviderRecord {
  id: string;
  orgId: string;
  /** The member who owns the provider, or `null` when the organization does. */
  userId: string | null;
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
  /** Omit to keep the key already saved on the provider. */
  apiKey?: string;
  models: string[];
}

const COLUMNS: CollectionSchema['columns'] = {
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
};

/** Providers an organization owns. */
export const CUSTOM_PROVIDERS_SCHEMA: CollectionSchema = {
  name: 'custom_providers',
  columns: COLUMNS,
  uniqueIndexes: [{ name: 'custom_providers_org_provider_key', columns: ['org_id', 'provider_id'] }],
};

/**
 * Providers one member owns. A separate collection rather than a nullable
 * `user_id` on `custom_providers`: that collection's unique index covers
 * `(org_id, provider_id)` and schema evolution cannot drop it, so two members
 * could never use the same name.
 */
export const USER_CUSTOM_PROVIDERS_SCHEMA: CollectionSchema = {
  name: 'user_custom_providers',
  columns: { ...COLUMNS, user_id: { type: 'text' } },
  uniqueIndexes: [{ name: 'user_custom_providers_owner_provider_key', columns: ['org_id', 'user_id', 'provider_id'] }],
};

const COLLECTIONS = [CUSTOM_PROVIDERS_SCHEMA.name, USER_CUSTOM_PROVIDERS_SCHEMA.name];

interface CustomProviderDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  /** Present on member-owned rows only. */
  user_id?: string;
  created_by: string;
  provider_id: string;
  name: string;
  url: string;
  api_key: string | null;
  models: string[];
  created_at: Date;
  updated_at: Date;
}

/** The collection an owner's providers live in, and the columns that identify the owner there. */
interface OwnerRows {
  collection: string;
  where: CollectionWhere;
}

function ownerRows(owner: CustomProviderOwner): OwnerRows {
  return owner.userId === undefined
    ? { collection: CUSTOM_PROVIDERS_SCHEMA.name, where: { org_id: owner.orgId } }
    : { collection: USER_CUSTOM_PROVIDERS_SCHEMA.name, where: { org_id: owner.orgId, user_id: owner.userId } };
}

export class CustomProvidersStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('custom-providers');
  }

  async init(): Promise<void> {
    await this.ensureCollections([CUSTOM_PROVIDERS_SCHEMA, USER_CUSTOM_PROVIDERS_SCHEMA]);
    for (const collection of COLLECTIONS) {
      const rows = await this.ops.findMany<CustomProviderDbRow>(collection, {});
      await Promise.all(rows.filter(row => row.api_key !== null).map(row => this.#migrateApiKey(collection, row.id)));
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await Promise.all(COLLECTIONS.map(collection => this.ops.deleteMany(collection, {})));
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #toRecord(row: CustomProviderDbRow): Promise<CustomProviderRecord> {
    const apiKey = row.api_key === null ? null : (await this.#decryptApiKey(row.api_key)).value;
    return {
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id ?? null,
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

  /**
   * API keys are always strings. A legacy raw key that happens to be valid JSON
   * (e.g. `12345`) decodes to a non-string, so keep the stored text instead.
   */
  async #decryptApiKey(stored: string): Promise<{ value: string; needsReencryption: boolean }> {
    const decrypted = await this.encryption.decrypt<unknown>(stored);
    return {
      value: typeof decrypted.value === 'string' ? decrypted.value : stored,
      needsReencryption: decrypted.needsReencryption,
    };
  }

  /**
   * The stored form of the key a write should end up with: the new key when
   * one is given, otherwise the key already saved on the provider being edited
   * (under its previous id when it is being renamed).
   */
  async #apiKeyToStore(
    rows: OwnerRows,
    input: UpsertCustomProviderInput,
    previousProviderId: string | undefined,
  ): Promise<string | null> {
    if (input.apiKey !== undefined) return this.encryption.encrypt(input.apiKey);
    const find = (providerId: string) =>
      this.#db.findOne<CustomProviderDbRow>(rows.collection, { ...rows.where, provider_id: providerId });
    const edited = (previousProviderId && (await find(previousProviderId))) || (await find(input.providerId));
    return edited?.api_key ?? null;
  }

  async #migrateApiKey(collection: string, id: string): Promise<void> {
    await this.#db.updateAtomic<CustomProviderDbRow>(collection, { id }, async row => {
      if (row.api_key === null) return null;
      const decrypted = await this.#decryptApiKey(row.api_key);
      return decrypted.needsReencryption ? { api_key: await this.encryption.encrypt(decrypted.value) } : null;
    });
  }

  /**
   * Create or replace one of the owner's providers by provider id. An absent
   * `apiKey` keeps the saved key, so editing a name, URL or model list never
   * drops it. `previousProviderId` renames the provider: the common path is a
   * single atomic in-place update of the old row; renaming onto an id that
   * already exists overwrites the target first and removes the old row last,
   * so no interleaving or failure can lose the provider.
   */
  async upsert({
    owner,
    createdBy,
    input,
    previousProviderId,
  }: {
    owner: CustomProviderOwner;
    createdBy: string;
    input: UpsertCustomProviderInput;
    previousProviderId?: string;
  }): Promise<CustomProviderRecord> {
    const now = new Date();
    const rows = ownerRows(owner);
    const apiKey = await this.#apiKeyToStore(rows, input, previousProviderId);
    const renameFrom = previousProviderId && previousProviderId !== input.providerId ? previousProviderId : undefined;

    if (renameFrom) {
      const target = await this.#db.findOne<CustomProviderDbRow>(rows.collection, {
        ...rows.where,
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
          rows.collection,
          { ...rows.where, provider_id: renameFrom },
          () => ({
            provider_id: input.providerId,
            name: input.name,
            url: input.url,
            api_key: apiKey,
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

    const record = await this.#write({ rows, createdBy, input, apiKey, now });
    if (renameFrom) {
      await this.#db.deleteMany(rows.collection, { ...rows.where, provider_id: renameFrom });
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
    rows,
    createdBy,
    input,
    apiKey,
    now,
  }: {
    rows: OwnerRows;
    createdBy: string;
    input: UpsertCustomProviderInput;
    apiKey: string | null;
    now: Date;
  }): Promise<CustomProviderRecord> {
    const updateExisting = () =>
      this.#db.updateAtomic<CustomProviderDbRow>(
        rows.collection,
        { ...rows.where, provider_id: input.providerId },
        () => ({
          name: input.name,
          url: input.url,
          api_key: apiKey,
          models: input.models,
          updated_at: now,
        }),
      );

    const updated = await updateExisting();
    if (updated) return this.#toRecord(updated);

    try {
      const row = await this.#db.insertOne<CustomProviderDbRow>(rows.collection, {
        ...rows.where,
        created_by: createdBy,
        provider_id: input.providerId,
        name: input.name,
        url: input.url,
        api_key: apiKey,
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

  /** The owner's providers, by name. */
  async list(owner: CustomProviderOwner): Promise<CustomProviderRecord[]> {
    const rows = ownerRows(owner);
    const found = await this.#db.findMany<CustomProviderDbRow>(rows.collection, rows.where, {
      orderBy: [['name', 'asc']],
    });
    return Promise.all(found.map(row => this.#toRecord(row)));
  }

  /**
   * Every provider in an organization: its own and each member's. For the
   * model-resolution snapshot, which serves any owner without another query.
   */
  async listForOrg(orgId: string): Promise<CustomProviderRecord[]> {
    const found = await Promise.all(
      COLLECTIONS.map(collection =>
        this.#db.findMany<CustomProviderDbRow>(collection, { org_id: orgId }, { orderBy: [['name', 'asc']] }),
      ),
    );
    return Promise.all(found.flat().map(row => this.#toRecord(row)));
  }

  async delete({ owner, providerId }: { owner: CustomProviderOwner; providerId: string }): Promise<boolean> {
    const rows = ownerRows(owner);
    return (await this.#db.deleteMany(rows.collection, { ...rows.where, provider_id: providerId })) > 0;
  }
}
