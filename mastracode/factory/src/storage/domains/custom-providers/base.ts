import {
  customProviderHeaderProblem,
  isCustomProviderAuthScheme,
} from '@mastra/code-sdk/onboarding/custom-provider-headers';
import type { CustomProviderAuthScheme, CustomProviderHeader } from '@mastra/code-sdk/onboarding/settings';
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

/** The outcome of the last connection test run against a saved provider. */
export interface CustomProviderLastCheck {
  /** When the test ran, as an ISO 8601 string. */
  at: string;
  ok: boolean;
  /** The failure message when the test failed. */
  message?: string;
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
  /** `null` for rows saved before schemes existed, which authenticate as `bearer`. */
  authScheme: CustomProviderAuthScheme | null;
  /** Every header carries an explicit `secret` flag. */
  headers: CustomProviderHeader[];
  lastCheck: CustomProviderLastCheck | null;
  models: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** A header in a save request. Without `value` it keeps the saved value of the same name. */
export interface CustomProviderHeaderInput {
  name: string;
  value?: string;
  /** Omitted on a new header means secret, and on a saved one keeps its flag. */
  secret?: boolean;
}

export interface CustomProviderInput {
  providerId: string;
  name: string;
  url: string;
  /** On an edit, omit to keep the saved key. */
  apiKey?: string;
  /** On an edit, omit to keep the saved scheme. */
  authScheme?: CustomProviderAuthScheme;
  /** The full list. On an edit, omit to keep the saved list. */
  headers?: CustomProviderHeaderInput[];
  /** Omit to keep the saved result while the connection settings stay the same, and clear it otherwise. */
  lastCheck?: CustomProviderLastCheck;
  models: string[];
}

/**
 * Why saved settings cannot be combined with a draft:
 * - `api_key_required`: the draft moves a provider with a saved key to another
 *   origin without giving a key, which would send the saved key there.
 * - `header_value_required`: a header has no value of its own and none can be
 *   kept, or keeping a secret value would send it to another origin.
 * - `header_refused`: the resulting headers break the header rules, with the
 *   reason in `problem`.
 */
export type CustomProviderSettingsRefusal =
  | { refused: 'api_key_required' | 'header_value_required' }
  | { refused: 'header_refused'; problem: string };

/**
 * The outcome of a create or an edit. A refusal leaves storage unchanged:
 * - `name_taken`: the owner already has a provider with this id.
 * - `not_found`: the provider being edited no longer exists.
 * - `changed`: the provider was edited after the row a save's test used.
 * - any {@link CustomProviderSettingsRefusal}.
 */
export type CustomProviderWrite =
  | { saved: CustomProviderRecord }
  | { refused: 'name_taken' | 'not_found' | 'changed' }
  | CustomProviderSettingsRefusal;

/** The settings that decide what a call to an endpoint sends, and where. */
export interface CustomProviderCallSettings {
  url: string;
  apiKey: string | null;
  authScheme: CustomProviderAuthScheme | null;
  headers: CustomProviderHeader[];
}

/** The parts of a create, an edit or a check that may reuse saved settings. */
export interface CustomProviderSettingsDraft {
  url: string;
  apiKey?: string;
  authScheme?: CustomProviderAuthScheme;
  headers?: CustomProviderHeaderInput[];
}

/** Whether two URLs share scheme, host and port. Malformed URLs never match. */
export function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

/** A header without a `secret` flag counts as secret, as the SDK redacts it. */
function isSecret(header: { secret?: boolean }): boolean {
  return header.secret !== false;
}

/**
 * Combine a draft with the saved settings it edits, or `saved: null` for a new
 * provider. Edits and checks both decide through this function, so a check
 * sends exactly what the save would store.
 *
 * Saved secrets (the key and secret header values) are only reused while the
 * draft URL keeps the saved origin. Whoever edits a provider never sees them,
 * so reusing them elsewhere would let that person send them to any server.
 */
export function resolveCustomProviderSettings(
  saved: CustomProviderCallSettings | null,
  draft: CustomProviderSettingsDraft,
): { resolved: CustomProviderCallSettings } | CustomProviderSettingsRefusal {
  const keepSecrets = saved !== null && sameOrigin(saved.url, draft.url);
  if (draft.apiKey === undefined && saved?.apiKey && !keepSecrets) return { refused: 'api_key_required' };
  const authScheme = draft.authScheme ?? saved?.authScheme ?? null;

  let headers: CustomProviderHeader[];
  if (draft.headers === undefined) {
    const kept = saved?.headers ?? [];
    if (!keepSecrets && kept.some(isSecret)) return { refused: 'header_value_required' };
    headers = kept;
  } else {
    headers = [];
    for (const entry of draft.headers) {
      const kept = saved?.headers.find(header => header.name.toLowerCase() === entry.name.toLowerCase());
      if (entry.value !== undefined) {
        headers.push({ name: entry.name, value: entry.value, secret: entry.secret ?? (kept ? isSecret(kept) : true) });
        continue;
      }
      if (!kept) return { refused: 'header_value_required' };
      const secret = entry.secret ?? isSecret(kept);
      // A secret value is never shown, so it may not become plain (and readable)
      // or travel to another origin unless the user types it again.
      if (isSecret(kept) && (!secret || !keepSecrets)) return { refused: 'header_value_required' };
      headers.push({ name: entry.name, value: kept.value, secret });
    }
  }

  // Kept headers were valid under the saved scheme, and the new scheme may
  // write its key into one of them.
  const problem = customProviderHeaderProblem(headers, authScheme ?? undefined);
  if (problem) return { refused: 'header_refused', problem };

  return {
    resolved: { url: draft.url, apiKey: draft.apiKey ?? saved?.apiKey ?? null, authScheme, headers },
  };
}

/** Whether two settings send the same request to the same place. A missing scheme means `bearer`. */
function sameCallSettings(left: CustomProviderCallSettings, right: CustomProviderCallSettings): boolean {
  return (
    left.url === right.url &&
    left.apiKey === right.apiKey &&
    (left.authScheme ?? 'bearer') === (right.authScheme ?? 'bearer') &&
    left.headers.length === right.headers.length &&
    left.headers.every((header, index) => {
      const other = right.headers[index]!;
      return header.name === other.name && header.value === other.value && isSecret(header) === isSecret(other);
    })
  );
}

const COLUMNS: CollectionSchema['columns'] = {
  id: { type: 'uuid-pk' },
  org_id: { type: 'text' },
  created_by: { type: 'text' },
  provider_id: { type: 'text' },
  name: { type: 'text' },
  url: { type: 'text' },
  api_key: { type: 'text', nullable: true },
  auth_scheme: { type: 'text', nullable: true },
  /** The whole header list, encrypted like `api_key`, since it holds secret values. */
  headers: { type: 'text', nullable: true },
  last_check: { type: 'json', nullable: true },
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
  /** `null` on rows written before these columns existed, like the two below. */
  auth_scheme: string | null;
  headers: string | null;
  last_check: unknown;
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

/** A stored `last_check`, or `null` when the column is empty or holds something unexpected. */
function readLastCheck(value: unknown): CustomProviderLastCheck | null {
  if (typeof value !== 'object' || value === null) return null;
  const { at, ok, message } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof ok !== 'boolean') return null;
  return typeof message === 'string' ? { at, ok, message } : { at, ok };
}

/** Decrypted header entries, keeping only well-formed ones and spelling out each `secret` flag. */
function readHeaders(value: unknown): CustomProviderHeader[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { name, value: headerValue, secret } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof headerValue !== 'string') return [];
    return [{ name, value: headerValue, secret: secret !== false }];
  });
}

export class CustomProvidersStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('custom-providers');
  }

  /** Create or evolve the collections, then re-encrypt secrets written under an older key or none. */
  async init(): Promise<void> {
    await this.ensureCollections([CUSTOM_PROVIDERS_SCHEMA, USER_CUSTOM_PROVIDERS_SCHEMA]);
    for (const collection of COLLECTIONS) {
      const rows = await this.ops.findMany<CustomProviderDbRow>(collection, {});
      await Promise.all(
        rows
          .filter(row => row.api_key !== null || row.headers !== null)
          .map(row => this.#migrateSecrets(collection, row.id)),
      );
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await Promise.all(COLLECTIONS.map(collection => this.ops.deleteMany(collection, {})));
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #toRecord(row: CustomProviderDbRow): Promise<CustomProviderRecord> {
    const settings = await this.#callSettings(row);
    return {
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id ?? null,
      createdBy: row.created_by,
      providerId: row.provider_id,
      name: row.name,
      ...settings,
      lastCheck: readLastCheck(row.last_check),
      models: Array.isArray(row.models) ? row.models : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** The decrypted settings a call to the row's endpoint uses. */
  async #callSettings(row: CustomProviderDbRow): Promise<CustomProviderCallSettings> {
    return {
      url: row.url,
      apiKey: row.api_key === null ? null : (await this.#decryptApiKey(row.api_key)).value,
      authScheme: isCustomProviderAuthScheme(row.auth_scheme) ? row.auth_scheme : null,
      headers: row.headers === null ? [] : readHeaders((await this.encryption.decrypt<unknown>(row.headers)).value),
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

  /** The stored `headers` column for a list. An empty list is stored as `null`, like a row from before headers. */
  async #encryptHeaders(headers: CustomProviderHeader[]): Promise<string | null> {
    return headers.length === 0 ? null : this.encryption.encrypt(headers);
  }

  /**
   * Re-encrypt the row's key and header list when they were written under an
   * older key or none. One atomic write per row, so a concurrent edit is not
   * overwritten.
   */
  async #migrateSecrets(collection: string, id: string): Promise<void> {
    await this.#db.updateAtomic<CustomProviderDbRow>(collection, { id }, async row => {
      const set: Partial<CustomProviderDbRow> = {};
      if (row.api_key !== null) {
        const decrypted = await this.#decryptApiKey(row.api_key);
        if (decrypted.needsReencryption) set.api_key = await this.encryption.encrypt(decrypted.value);
      }
      if (row.headers !== null) {
        const decrypted = await this.encryption.decrypt<unknown>(row.headers);
        if (decrypted.needsReencryption) set.headers = await this.#encryptHeaders(readHeaders(decrypted.value));
      }
      return Object.keys(set).length > 0 ? set : null;
    });
  }

  /**
   * Add a provider to the owner's list. Never replaces one: a name the owner
   * already uses, including one a concurrent create just took, is refused.
   */
  async create({
    owner,
    createdBy,
    input,
  }: {
    owner: CustomProviderOwner;
    createdBy: string;
    input: CustomProviderInput;
  }): Promise<CustomProviderWrite> {
    const settings = resolveCustomProviderSettings(null, input);
    if ('refused' in settings) return settings;
    const rows = ownerRows(owner);
    const now = new Date();
    try {
      const row = await this.#db.insertOne<CustomProviderDbRow>(rows.collection, {
        ...rows.where,
        created_by: createdBy,
        provider_id: input.providerId,
        name: input.name,
        url: input.url,
        api_key: input.apiKey === undefined ? null : await this.encryption.encrypt(input.apiKey),
        auth_scheme: settings.resolved.authScheme,
        headers: await this.#encryptHeaders(settings.resolved.headers),
        last_check: input.lastCheck ?? null,
        models: input.models,
        created_at: now,
        updated_at: now,
      });
      return { saved: await this.#toRecord(row) };
    } catch (error) {
      if (error instanceof UniqueViolationError) return { refused: 'name_taken' };
      throw error;
    }
  }

  /**
   * Edit one of the owner's providers, renaming it when `input.providerId`
   * differs from `providerId`. One atomic write, so kept secrets come from the
   * row as it is at that moment (see {@link resolveCustomProviderSettings}).
   *
   * `checked` is the row the save's connection test resolved its kept secrets
   * from. When another edit landed since, this write would keep secrets that
   * were never tested, so it is refused with `changed` and nothing is written.
   */
  async update({
    owner,
    providerId,
    input,
    checked,
  }: {
    owner: CustomProviderOwner;
    providerId: string;
    input: CustomProviderInput;
    checked?: CustomProviderRecord;
  }): Promise<CustomProviderWrite> {
    const rows = ownerRows(owner);
    let refusal: CustomProviderSettingsRefusal | { refused: 'changed' } | undefined;
    try {
      const row = await this.#db.updateAtomic<CustomProviderDbRow>(
        rows.collection,
        { ...rows.where, provider_id: providerId },
        async current => {
          if (checked && checked.updatedAt.getTime() !== current.updated_at.getTime()) {
            refusal = { refused: 'changed' };
            return null;
          }
          const before = await this.#callSettings(current);
          const settings = resolveCustomProviderSettings(before, input);
          if ('refused' in settings) {
            refusal = settings;
            return null;
          }
          // A result describes the settings it was measured with. It survives an
          // edit that changes none of them (a rename, the model list), and
          // goes as soon as any of them changes.
          const lastCheck = input.lastCheck
            ? input.lastCheck
            : sameCallSettings(before, settings.resolved)
              ? current.last_check
              : null;
          return {
            provider_id: input.providerId,
            name: input.name,
            url: input.url,
            api_key: input.apiKey === undefined ? current.api_key : await this.encryption.encrypt(input.apiKey),
            auth_scheme: settings.resolved.authScheme,
            headers: await this.#encryptHeaders(settings.resolved.headers),
            last_check: lastCheck ?? null,
            models: input.models,
            // `recordCheck` and `checked` tell edits apart by `updated_at`, so two
            // edits within one millisecond must still get different values.
            updated_at: new Date(Math.max(Date.now(), current.updated_at.getTime() + 1)),
          };
        },
      );
      if (!row) return { refused: 'not_found' };
      if (refusal) return refusal;
      return { saved: await this.#toRecord(row) };
    } catch (error) {
      // Renamed onto a name the owner already uses.
      if (error instanceof UniqueViolationError) return { refused: 'name_taken' };
      throw error;
    }
  }

  /** One of the owner's providers, or `null` when it does not exist. */
  async get({
    owner,
    providerId,
  }: {
    owner: CustomProviderOwner;
    providerId: string;
  }): Promise<CustomProviderRecord | null> {
    const rows = ownerRows(owner);
    const row = await this.#db.findOne<CustomProviderDbRow>(rows.collection, {
      ...rows.where,
      provider_id: providerId,
    });
    return row ? this.#toRecord(row) : null;
  }

  /**
   * Store the result of a connection test run against `checked`. The test
   * takes seconds and an edit may land meanwhile, so the write applies only
   * while the row's `url` and `updated_at` still match `checked`. Returns the
   * updated record, or `null` when the row changed or is gone.
   */
  async recordCheck({
    owner,
    providerId,
    checked,
    lastCheck,
  }: {
    owner: CustomProviderOwner;
    providerId: string;
    checked: CustomProviderRecord;
    lastCheck: CustomProviderLastCheck;
  }): Promise<CustomProviderRecord | null> {
    const rows = ownerRows(owner);
    let recorded = false;
    const row = await this.#db.updateAtomic<CustomProviderDbRow>(
      rows.collection,
      { ...rows.where, provider_id: providerId },
      current => {
        if (current.url !== checked.url || current.updated_at.getTime() !== checked.updatedAt.getTime()) return null;
        recorded = true;
        // `updated_at` stays: a test result is not an edit, and a later
        // test of the same settings must still match it.
        return { last_check: lastCheck };
      },
    );
    return row && recorded ? this.#toRecord(row) : null;
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

  /** Remove one of the owner's providers. Returns whether it existed. */
  async delete({ owner, providerId }: { owner: CustomProviderOwner; providerId: string }): Promise<boolean> {
    const rows = ownerRows(owner);
    return (await this.#db.deleteMany(rows.collection, { ...rows.where, provider_id: providerId })) > 0;
  }
}
