/**
 * Model provider credentials domain — tenant-scoped OAuth tokens and API keys
 * for model providers (Anthropic/Claude Max, OpenAI Codex, GitHub Copilot,
 * xAI, plus plain API-key providers).
 *
 * Each tenant scope holds a **pool** of accounts per provider
 * (`model_provider_accounts`, one row per account). A pool may mix API keys
 * and OAuth subscriptions; exactly one account per pool is active
 * (`model_provider_account_pools`). Tenancy is two-level:
 * - **user-scoped** pools (`userId` present): personal subscriptions and API
 *   keys.
 * - **org-scoped** pools (`userId` absent): Factory-wide API keys and OAuth
 *   subscriptions an org admin signed in, used by every Factory-scoped session.
 *
 * Model calls resolve exactly one scope: user or org. Deployed tenant stores
 * never fall back to the other scope or implicitly borrow server environment
 * keys, and account status (active/cooldown/auth-failed) lives inside one
 * scope's pool, so rotation never crosses user↔org.
 *
 * `model_provider_credentials` (one row per scope and provider) is
 * deprecated: it is only read at boot to copy its rows into one-account pools.
 *
 * Secrets posture: credentials are stored server-side only and never returned
 * to the client (same as `linear_connections.access_token`). When
 * `secretEncryption` is configured, `init()` encrypts both the account rows
 * and the deprecated rows at rest.
 *
 * The domain also owns `oauth_login_sessions`: pending web login flows
 * (paste-code PKCE verifiers, device-code poll state) persisted server-side so
 * any replica can complete or poll a flow started on another.
 */

import { createHash, randomUUID } from 'node:crypto';
import { defaultAccountLabel, findSameSubscription } from '@mastra/code-sdk/auth/account-registry';
import type { AuthCredential, OAuthCredential } from '@mastra/code-sdk/auth/types';
import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';

/** Owning tenant of a credential row. `userId` absent = org-scoped row. */
export interface CredentialTenant {
  orgId: string;
  userId?: string;
}

/** Which tenancy level a credential row lives at. */
export type CredentialScope = 'user' | 'org';

/** One stored credential, annotated with its scope. */
export interface CredentialRecord {
  provider: string;
  scope: CredentialScope;
  /** Pool account the credential belongs to (the scope's active account). */
  accountId: string;
  credential: AuthCredential;
  updatedAt: Date;
  /** When the last OAuth token refresh failed; cleared by the next successful refresh or a new sign-in. */
  refreshFailedAt?: Date;
}

/** Result of per-caller resolution: the winning credential and its scope. */
export interface ResolvedCredential {
  provider: string;
  scope: CredentialScope;
  accountId: string;
  credential: AuthCredential;
}

// TODO(FACT-572): import these from '@mastra/code-sdk/auth/account-registry' once it ships the shared contract.
export type PoolAccountType = 'oauth' | 'api-key';
export type PoolAccountStatus = 'ok' | 'cooldown' | 'auth-failed';
/** Token-free view of one pool account. */
export interface PoolAccountSummary {
  /** `${providerId}:${uuid}` */
  id: string;
  providerId: string;
  type: PoolAccountType;
  label: string;
  active: boolean;
  status: PoolAccountStatus;
  /** Epoch ms; present while `status` is `'cooldown'`. */
  cooldownUntil?: number;
  /** Lower is tried first; ties break by `createdAt`. */
  priority: number;
  /** Epoch ms. */
  createdAt: number;
}

export interface AddAccountInput {
  credential: AuthCredential;
  label?: string;
  /**
   * Stable provider identity of the account (account id, email). An add whose
   * identity is already in the scope's pool updates that account instead of
   * appending a duplicate.
   */
  identity?: string;
  /**
   * Display name of the provider. A new account added without a `label` is
   * named "<providerName> account N", as mastracode's AuthStorage names them.
   */
  providerName?: string;
  /**
   * Make the account active even when the pool already has an active account.
   * Applies to a matched account too, as mastracode's AuthStorage does on re-login.
   */
  activate?: boolean;
}

export interface RefreshAccountOAuthOptions {
  /**
   * Refresh even if the stored token has not expired (the provider rejected
   * it with a 401). Skipped when `staleAccess` is given and the stored access
   * token already differs from it: another caller refreshed in the meantime.
   */
  force?: boolean;
  staleAccess?: string;
}

/** Kind of pending web login flow a session row tracks. */
export type LoginSessionKind = 'paste-code' | 'device-code';

/** Scope the completed credential should be written to. */
export type LoginCredentialScope = 'user' | 'org';

/** One pending OAuth login flow, persisted so any replica can continue it. */
export interface LoginSessionRow {
  sessionId: string;
  orgId: string;
  userId: string;
  provider: string;
  kind: LoginSessionKind;
  /** Where the completed credential lands; absent rows default to `'user'`. */
  credentialScope?: LoginCredentialScope;
  /** Serialized flow state (PKCE verifier, device-code pending state, ...). */
  pending: Record<string, unknown>;
  expiresAt: Date;
  /** Earliest time the next upstream poll is allowed (device-code flows). */
  nextPollAt: Date | null;
  createdAt: Date;
}

export interface CreateLoginSessionInput {
  sessionId: string;
  orgId: string;
  userId: string;
  provider: string;
  kind: LoginSessionKind;
  credentialScope?: LoginCredentialScope;
  pending: Record<string, unknown>;
  expiresAt: Date;
  nextPollAt?: Date | null;
}

/** Mirror of `AuthStorage.getApiKey()`'s expiry check. */
export function isOAuthCredentialExpired(credential: OAuthCredential, now = Date.now()): boolean {
  return now >= credential.expires;
}

/**
 * @deprecated One row per scope and provider. Read only at boot to copy rows
 * into {@link MODEL_PROVIDER_ACCOUNTS_SCHEMA}; collection evolution is
 * additive, so its per-provider unique indexes cannot be narrowed in place.
 */
export const MODEL_CREDENTIALS_SCHEMA: CollectionSchema = {
  name: 'model_provider_credentials',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text', nullable: true },
    provider: { type: 'text' },
    type: { type: 'text' },
    data: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
    refresh_failed_at: { type: 'timestamp', nullable: true },
    /** `updated_at` of the row version last copied into the account pools. */
    migrated_at: { type: 'timestamp', nullable: true },
  },
  uniqueIndexes: [
    // Scope is encoded in `user_id` nullability (NULL = org-scoped shared
    // row), enforced by two partial unique indexes.
    {
      name: 'model_provider_credentials_user_unique',
      columns: ['org_id', 'user_id', 'provider'],
      whereNotNull: 'user_id',
    },
    { name: 'model_provider_credentials_org_unique', columns: ['org_id', 'provider'], whereNull: 'user_id' },
  ],
};

/**
 * One row per pool account. `scope_key` is `'org'` for Factory-wide pools and
 * `user:<userId>` for personal pools, so it is never NULL and unique indexes
 * and `IN` filters cover both scopes.
 */
export const MODEL_PROVIDER_ACCOUNTS_SCHEMA: CollectionSchema = {
  name: 'model_provider_accounts',
  columns: {
    id: { type: 'text', primaryKey: true },
    org_id: { type: 'text' },
    scope_key: { type: 'text' },
    provider: { type: 'text' },
    type: { type: 'text' },
    label: { type: 'text' },
    identity: { type: 'text', nullable: true },
    data: { type: 'json' },
    status: { type: 'text' },
    priority: { type: 'integer', default: 0 },
    cooldown_until: { type: 'timestamp', nullable: true },
    refresh_failed_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'model_provider_accounts_identity_unique',
      columns: ['org_id', 'scope_key', 'provider', 'identity'],
      whereNotNull: 'identity',
    },
  ],
  indexes: [{ name: 'model_provider_accounts_pool_idx', columns: ['org_id', 'scope_key', 'provider'] }],
};

/** Per-scope pool state: which account is active for a provider. */
export const MODEL_PROVIDER_ACCOUNT_POOLS_SCHEMA: CollectionSchema = {
  name: 'model_provider_account_pools',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    scope_key: { type: 'text' },
    provider: { type: 'text' },
    active_account_id: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'model_provider_account_pools_unique', columns: ['org_id', 'scope_key', 'provider'] }],
};

export const OAUTH_LOGIN_SESSIONS_SCHEMA: CollectionSchema = {
  name: 'oauth_login_sessions',
  columns: {
    session_id: { type: 'text', primaryKey: true },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    provider: { type: 'text' },
    kind: { type: 'text' },
    credential_scope: { type: 'text', nullable: true },
    pending: { type: 'json' },
    expires_at: { type: 'timestamp' },
    next_poll_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
  },
};

/** Column shape of one deprecated `model_provider_credentials` row as returned by ops. */
interface LegacyCredentialDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  provider: string;
  user_id: string | null;
  type: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
  refresh_failed_at: Date | null;
  migrated_at: Date | null;
}

/** Column shape of one `model_provider_accounts` row as returned by ops. */
interface AccountDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  scope_key: string;
  provider: string;
  type: string;
  label: string;
  identity: string | null;
  data: unknown;
  status: PoolAccountStatus;
  priority: number;
  cooldown_until: Date | null;
  refresh_failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Column shape of one `model_provider_account_pools` row as returned by ops. */
interface PoolDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  scope_key: string;
  provider: string;
  active_account_id: string | null;
}

/** Column shape of one `oauth_login_sessions` row as returned by ops. */
interface LoginSessionDbRow extends Record<string, unknown> {
  session_id: string;
  org_id: string;
  user_id: string;
  provider: string;
  kind: LoginSessionKind;
  credential_scope: LoginCredentialScope | null;
  pending: Record<string, unknown>;
  expires_at: Date;
  next_poll_at: Date | null;
  created_at: Date;
}

function toSessionRow(db: LoginSessionDbRow): LoginSessionRow {
  return {
    sessionId: db.session_id,
    orgId: db.org_id,
    userId: db.user_id,
    provider: db.provider,
    kind: db.kind,
    ...(db.credential_scope ? { credentialScope: db.credential_scope } : {}),
    pending: db.pending,
    expiresAt: db.expires_at,
    nextPollAt: db.next_poll_at,
    createdAt: db.created_at,
  };
}

const ORG_SCOPE_KEY = 'org';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Non-null pool owner key: `'org'` for the org pool, `user:<id>` for a personal pool. */
function scopeKey(tenant: CredentialTenant): string {
  return tenant.userId ? `user:${tenant.userId}` : ORG_SCOPE_KEY;
}

function scopeOf(key: string): CredentialScope {
  return key === ORG_SCOPE_KEY ? 'org' : 'user';
}

function poolWhere(tenant: CredentialTenant, provider: string): CollectionWhere {
  return { org_id: tenant.orgId, scope_key: scopeKey(tenant), provider };
}

function accountWhere(tenant: CredentialTenant, accountId: string): CollectionWhere {
  return { id: accountId, org_id: tenant.orgId, scope_key: scopeKey(tenant) };
}

/** Filter selecting exactly the tenant's deprecated row for a provider (`null` = org row). */
function legacyTenantWhere(tenant: CredentialTenant, provider: string): CollectionWhere {
  return { org_id: tenant.orgId, provider, user_id: tenant.userId ?? null };
}

/** The id mastracode's AuthStorage gave an account before ids were minted: a hash of its refresh token. */
function legacyAccountIdFor(provider: string, refreshToken: string): string {
  return `${provider}:${createHash('sha256').update(refreshToken).digest('hex').slice(0, 8)}`;
}

/** Whether two credentials are the same token set: same refresh token, or same API key. */
function sameCredential(a: AuthCredential, b: AuthCredential): boolean {
  if (a.type === 'oauth' && b.type === 'oauth') return a.refresh === b.refresh;
  if (a.type === 'api_key' && b.type === 'api_key') return a.key === b.key;
  return false;
}

function accountType(credential: AuthCredential): PoolAccountType {
  return credential.type === 'oauth' ? 'oauth' : 'api-key';
}

/** Status as seen now: a lapsed cooldown reads as `'ok'`. */
function effectiveStatus(row: AccountDbRow, now = Date.now()): PoolAccountStatus {
  if (row.status === 'cooldown' && row.cooldown_until && row.cooldown_until.getTime() <= now) return 'ok';
  return row.status;
}

/** Pool order: priority, then creation time. */
function byPriority(a: AccountDbRow, b: AccountDbRow): number {
  return a.priority - b.priority || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id);
}

/**
 * The account a pool resolves to: the active pointer when it names a live
 * account, otherwise the first usable account in pool order (then the first at all).
 */
function pickActive(accounts: AccountDbRow[], activeId: string | null | undefined): AccountDbRow | undefined {
  const pointed = activeId ? accounts.find(row => row.id === activeId) : undefined;
  if (pointed) return pointed;
  const sorted = [...accounts].sort(byPriority);
  return sorted.find(row => effectiveStatus(row) === 'ok') ?? sorted[0];
}

/**
 * Model-credentials storage, written once against the generic
 * `FactoryStorageOps` surface. OAuth refreshes and `claimLoginSession()`
 * ride `updateAtomic` so concurrent replicas serialize instead of
 * invalidating each other's rotating tokens / double-claiming a flow.
 */
export class ModelCredentialsStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('model-credentials');
  }

  async init(): Promise<void> {
    await this.ensureCollections([
      MODEL_CREDENTIALS_SCHEMA,
      MODEL_PROVIDER_ACCOUNTS_SCHEMA,
      MODEL_PROVIDER_ACCOUNT_POOLS_SCHEMA,
      OAUTH_LOGIN_SESSIONS_SCHEMA,
    ]);
    // Encrypt the deprecated rows in place first so neither they nor their copies stay plaintext.
    const legacyIds = await this.ops.findMany<LegacyCredentialDbRow>('model_provider_credentials', {});
    await Promise.all(legacyIds.map(row => this.#migrateCredential(row.id, 'model_provider_credentials')));
    const legacyRows = await this.ops.findMany<LegacyCredentialDbRow>('model_provider_credentials', {});
    for (const row of legacyRows) await this.#copyLegacyCredential(row);
    const accounts = await this.ops.findMany<AccountDbRow>('model_provider_accounts', {});
    await Promise.all(accounts.map(row => this.#migrateCredential(row.id, 'model_provider_accounts')));
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('oauth_login_sessions', {});
    await this.ops.deleteMany('model_provider_account_pools', {});
    await this.ops.deleteMany('model_provider_accounts', {});
    await this.ops.deleteMany('model_provider_credentials', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #decryptCredential(value: unknown): Promise<AuthCredential> {
    return (await this.encryption.decrypt<AuthCredential>(value)).value;
  }

  async #migrateCredential(
    id: string,
    collection: 'model_provider_accounts' | 'model_provider_credentials',
  ): Promise<void> {
    await this.#db.updateAtomic<{ data: unknown }>(collection, { id }, async row => {
      const decrypted = await this.encryption.decrypt<AuthCredential>(row.data);
      if (!decrypted.needsReencryption) return null;
      return { data: await this.encryption.encrypt(decrypted.value) };
    });
  }

  /**
   * Copy one deprecated row into a one-account pool. The account id is derived
   * from the legacy row id, and `migrated_at` records which row version was
   * copied, so concurrent or repeated boots converge: an already-copied
   * version is skipped, a duplicate insert loses harmlessly, and a legacy row
   * written since the last copy (an older replica during a rolling deploy)
   * overwrites the account only when it is newer.
   */
  async #copyLegacyCredential(row: LegacyCredentialDbRow): Promise<void> {
    if (row.migrated_at && row.migrated_at.getTime() >= row.updated_at.getTime()) return;
    const tenant: CredentialTenant = row.user_id ? { orgId: row.org_id, userId: row.user_id } : { orgId: row.org_id };
    const id = `${row.provider}:${row.id}`;
    const type: PoolAccountType = row.type === 'oauth' ? 'oauth' : 'api-key';
    const existing = await this.#db.findOne<AccountDbRow>('model_provider_accounts', { id });
    if (!existing) {
      try {
        await this.#db.insertOne<AccountDbRow>('model_provider_accounts', {
          id,
          ...poolWhere(tenant, row.provider),
          type,
          label: row.provider,
          identity: null,
          data: row.data,
          status: 'ok',
          priority: 0,
          cooldown_until: null,
          refresh_failed_at: row.refresh_failed_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
      }
      await this.#ensureActive(tenant, row.provider);
    } else if (row.updated_at.getTime() > existing.updated_at.getTime()) {
      await this.#db.updateMany(
        'model_provider_accounts',
        { id },
        { type, data: row.data, refresh_failed_at: row.refresh_failed_at, updated_at: row.updated_at },
      );
    }
    await this.#db.updateMany('model_provider_credentials', { id: row.id }, { migrated_at: row.updated_at });
  }

  async #listPool(tenant: CredentialTenant, provider?: string): Promise<AccountDbRow[]> {
    const where: CollectionWhere = { org_id: tenant.orgId, scope_key: scopeKey(tenant) };
    if (provider) where.provider = provider;
    const rows = await this.#db.findMany<AccountDbRow>('model_provider_accounts', where);
    return rows.sort(byPriority);
  }

  async #getPool(tenant: CredentialTenant, provider: string): Promise<PoolDbRow | null> {
    return this.#db.findOne<PoolDbRow>('model_provider_account_pools', poolWhere(tenant, provider));
  }

  /** The account a scope's pool currently resolves to, if the pool has any. */
  async #activeAccount(tenant: CredentialTenant, provider: string): Promise<AccountDbRow | undefined> {
    const [accounts, pool] = await Promise.all([this.#listPool(tenant, provider), this.#getPool(tenant, provider)]);
    return pickActive(accounts, pool?.active_account_id);
  }

  async #insertPoolRow(tenant: CredentialTenant, provider: string, activeId: string | null): Promise<boolean> {
    const now = new Date();
    try {
      await this.#db.insertOne<PoolDbRow>('model_provider_account_pools', {
        ...poolWhere(tenant, provider),
        active_account_id: activeId,
        created_at: now,
        updated_at: now,
      });
      return true;
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      return false;
    }
  }

  /** Point the pool at `accountId` unconditionally. */
  async #setActive(tenant: CredentialTenant, provider: string, accountId: string): Promise<void> {
    const set = () =>
      this.#db.updateMany('model_provider_account_pools', poolWhere(tenant, provider), {
        active_account_id: accountId,
        updated_at: new Date(),
      });
    if ((await set()) > 0 || (await this.#insertPoolRow(tenant, provider, accountId))) return;
    await set();
  }

  /**
   * Repair the pool's active pointer under the pool row lock: keep it when it
   * names a live account (other than `excluding`), otherwise promote the
   * next account in pool order, preferring usable ones.
   */
  async #ensureActive(tenant: CredentialTenant, provider: string, excluding?: string): Promise<void> {
    if (!(await this.#getPool(tenant, provider))) {
      const accounts = (await this.#listPool(tenant, provider)).filter(row => row.id !== excluding);
      if (await this.#insertPoolRow(tenant, provider, pickActive(accounts, undefined)?.id ?? null)) return;
    }
    await this.#db.updateAtomic<PoolDbRow>('model_provider_account_pools', poolWhere(tenant, provider), async pool => {
      const accounts = (await this.#listPool(tenant, provider)).filter(row => row.id !== excluding);
      const current = pool.active_account_id;
      if (current && accounts.some(row => row.id === current)) return null;
      const next = pickActive(accounts, undefined)?.id ?? null;
      return next === current ? null : { active_account_id: next, updated_at: new Date() };
    });
  }

  /**
   * Insert a new account at the end of its pool (max priority + 1). The read
   * and insert share a serializable transaction so concurrent adds cannot
   * take the same slot: libSQL serializes writers, and Postgres retries the
   * loser of the conflict.
   */
  async #insertAccount(
    tenant: CredentialTenant,
    provider: string,
    fields: Pick<AccountDbRow, 'type' | 'label' | 'identity' | 'data'>,
  ): Promise<string> {
    const id = `${provider}:${randomUUID()}`;
    await this.storage.withTransaction(
      async ops => {
        const pool = await ops.findMany<AccountDbRow>('model_provider_accounts', poolWhere(tenant, provider));
        const priority = pool.reduce((max, row) => Math.max(max, row.priority + 1), 0);
        const now = new Date();
        await ops.insertOne<AccountDbRow>('model_provider_accounts', {
          id,
          ...poolWhere(tenant, provider),
          ...fields,
          status: 'ok',
          priority,
          cooldown_until: null,
          refresh_failed_at: null,
          created_at: now,
          updated_at: now,
        });
      },
      { isolationLevel: 'serializable' },
    );
    return id;
  }

  #toSummary(row: AccountDbRow, active: boolean): PoolAccountSummary {
    const status = effectiveStatus(row);
    return {
      id: row.id,
      providerId: row.provider,
      type: row.type === 'oauth' ? 'oauth' : 'api-key',
      label: row.label,
      active,
      status,
      ...(status === 'cooldown' && row.cooldown_until ? { cooldownUntil: row.cooldown_until.getTime() } : {}),
      priority: row.priority,
      createdAt: row.created_at.getTime(),
    };
  }

  async #toRecord(row: AccountDbRow): Promise<CredentialRecord> {
    return {
      provider: row.provider,
      scope: scopeOf(row.scope_key),
      accountId: row.id,
      credential: await this.#decryptCredential(row.data),
      updatedAt: row.updated_at,
      refreshFailedAt: row.refresh_failed_at ?? undefined,
    };
  }

  /** The active account of every pool in `accounts`, given those pools' state rows. */
  #activeOfEachPool(accounts: AccountDbRow[], pools: PoolDbRow[]): AccountDbRow[] {
    const groups = new Map<string, AccountDbRow[]>();
    for (const row of accounts) {
      const key = `${row.scope_key}\n${row.provider}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.values()].flatMap(group => {
      const { scope_key, provider } = group[0]!;
      const pool = pools.find(row => row.scope_key === scope_key && row.provider === provider);
      const active = pickActive(group, pool?.active_account_id);
      return active ? [active] : [];
    });
  }

  // ---------------------------------------------------------------------------
  // Account pools
  // ---------------------------------------------------------------------------

  /** Token-free summaries of the scope's pool accounts, in pool order (priority, then creation). */
  async listAccounts(tenant: CredentialTenant, provider?: string): Promise<PoolAccountSummary[]> {
    const [accounts, pools] = await Promise.all([
      this.#listPool(tenant, provider),
      this.#db.findMany<PoolDbRow>('model_provider_account_pools', {
        org_id: tenant.orgId,
        scope_key: scopeKey(tenant),
        ...(provider ? { provider } : {}),
      }),
    ]);
    const activeIds = new Set(this.#activeOfEachPool(accounts, pools).map(row => row.id));
    return accounts.map(row => this.#toSummary(row, activeIds.has(row.id)));
  }

  /** Decrypted credential of one account in the tenant's scope. */
  async getAccountCredential(tenant: CredentialTenant, accountId: string): Promise<AuthCredential | undefined> {
    const row = await this.#db.findOne<AccountDbRow>('model_provider_accounts', accountWhere(tenant, accountId));
    return row ? this.#decryptCredential(row.data) : undefined;
  }

  /**
   * Add an account to the scope's pool, or update the one it already is.
   * Matching follows mastracode's AuthStorage.addAccount: the provider
   * identity, then the legacy id (a hash of the refresh token), then an
   * account already holding the same credential. A matched account keeps its
   * id, label, priority and active state; its credential is replaced and its
   * status reset. A new account goes last in pool order and becomes active
   * when `activate` is set or the pool had no active account.
   */
  async addAccount(tenant: CredentialTenant, provider: string, input: AddAccountInput): Promise<PoolAccountSummary> {
    const encrypted = await this.encryption.encrypt(input.credential);
    const type = accountType(input.credential);
    let accountId: string | undefined;

    for (let attempt = 0; attempt < 2 && !accountId; attempt++) {
      const pool = await this.#listPool(tenant, provider);
      const existing = await this.#findSameAccount(pool, provider, input);
      if (existing) {
        await this.#db.updateMany(
          'model_provider_accounts',
          { id: existing.id },
          {
            type,
            data: encrypted,
            ...(input.identity ? { identity: input.identity } : {}),
            status: 'ok',
            cooldown_until: null,
            refresh_failed_at: null,
            updated_at: new Date(),
          },
        );
        accountId = existing.id;
        break;
      }
      try {
        accountId = await this.#insertAccount(tenant, provider, {
          type,
          label:
            input.label ??
            (input.providerName ? defaultAccountLabel(input.providerName, pool.length + 1) : undefined) ??
            input.identity ??
            provider,
          identity: input.identity ?? null,
          data: encrypted,
        });
      } catch (error) {
        // A concurrent add with the same identity won the insert; update it on the retry.
        if (!(error instanceof UniqueViolationError) || !input.identity || attempt > 0) throw error;
      }
    }

    const id = accountId!;
    if (input.activate) await this.#setActive(tenant, provider, id);
    else await this.#ensureActive(tenant, provider);
    return (await this.listAccounts(tenant, provider)).find(row => row.id === id)!;
  }

  /** The pool account an incoming credential is the same subscription as, in mastracode's match order. */
  async #findSameAccount(
    pool: AccountDbRow[],
    provider: string,
    input: AddAccountInput,
  ): Promise<AccountDbRow | undefined> {
    const entries = await Promise.all(
      pool.map(async row => ({
        id: row.id,
        active: false,
        priority: row.priority,
        ...(row.identity ? { identity: row.identity } : {}),
        row,
        credential: row.type === accountType(input.credential) ? await this.#decryptCredential(row.data) : undefined,
      })),
    );
    return findSameSubscription(entries, {
      identity: input.identity,
      legacyId: input.credential.type === 'oauth' ? legacyAccountIdFor(provider, input.credential.refresh) : undefined,
      sameCredential: entry => entry.credential !== undefined && sameCredential(entry.credential, input.credential),
    })?.row;
  }

  /**
   * Remove one account. When it was the pool's active account the next
   * account (in pool order, preferring usable ones) becomes active.
   */
  async removeAccount(tenant: CredentialTenant, accountId: string): Promise<boolean> {
    const row = await this.#db.findOne<AccountDbRow>('model_provider_accounts', accountWhere(tenant, accountId));
    if (!row) return false;
    await this.#ensureActive(tenant, row.provider, accountId);
    const deleted = await this.#db.deleteMany('model_provider_accounts', accountWhere(tenant, accountId));
    // Drop the deprecated row the account was copied from so a later boot cannot resurrect it.
    const legacyId = row.id.slice(row.provider.length + 1);
    if (UUID_PATTERN.test(legacyId)) await this.#db.deleteMany('model_provider_credentials', { id: legacyId });
    return deleted > 0;
  }

  /** Make an account its pool's active account. False when it is not in the tenant's scope. */
  async activateAccount(tenant: CredentialTenant, accountId: string): Promise<boolean> {
    const row = await this.#db.findOne<AccountDbRow>('model_provider_accounts', accountWhere(tenant, accountId));
    if (!row) return false;
    await this.#setActive(tenant, row.provider, accountId);
    return true;
  }

  /**
   * Rewrite the pool's priorities atomically: `orderedIds` go first, in the
   * order given, and every account left out follows in its current pool
   * order. The pool is renumbered 0..n-1. Unknown, foreign-scope or
   * duplicate ids are rejected with an error and nothing changes.
   */
  async reorderAccounts(tenant: CredentialTenant, provider: string, orderedIds: string[]): Promise<void> {
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error('reorderAccounts: duplicate account ids');
    }
    await this.storage.withTransaction(
      async ops => {
        const pool = await ops.findMany<AccountDbRow>('model_provider_accounts', poolWhere(tenant, provider));
        const poolIds = new Set(pool.map(row => row.id));
        const unknown = orderedIds.filter(id => !poolIds.has(id));
        if (unknown.length > 0) {
          throw new Error(`reorderAccounts: accounts not in this pool: ${unknown.join(', ')}`);
        }
        const listed = new Set(orderedIds);
        const rest = pool
          .filter(row => !listed.has(row.id))
          .sort(byPriority)
          .map(row => row.id);
        const now = new Date();
        for (const [priority, id] of [...orderedIds, ...rest].entries()) {
          await ops.updateMany('model_provider_accounts', { id }, { priority, updated_at: now });
        }
      },
      { isolationLevel: 'serializable' },
    );
  }

  async renameAccount(tenant: CredentialTenant, accountId: string, label: string): Promise<boolean> {
    const updated = await this.#db.updateMany('model_provider_accounts', accountWhere(tenant, accountId), {
      label,
      updated_at: new Date(),
    });
    return updated > 0;
  }

  /**
   * Record an account's health. `until` (epoch ms or Date) bounds a cooldown;
   * a lapsed cooldown reads back as `'ok'`. The active pointer is left alone:
   * rotation policy belongs to the caller.
   */
  async markAccountStatus(
    tenant: CredentialTenant,
    accountId: string,
    status: PoolAccountStatus,
    until?: number | Date,
  ): Promise<boolean> {
    const updated = await this.#db.updateMany('model_provider_accounts', accountWhere(tenant, accountId), {
      status,
      cooldown_until: status === 'cooldown' && until !== undefined ? new Date(until) : null,
      updated_at: new Date(),
    });
    return updated > 0;
  }

  /**
   * Refresh one account's OAuth credential under the backend's atomic
   * read-modify-write so concurrent replicas don't invalidate each other's
   * rotating refresh tokens. The expiry is re-checked under the lock —
   * another replica may have refreshed already, in which case `refreshFn` is
   * skipped and the fresh credential is returned. `force` refreshes an
   * unexpired token (the 401 path) unless `staleAccess` shows it was already
   * replaced. Returns `undefined` when the account is missing or not OAuth. A
   * failed `refreshFn` is recorded on the row (`refreshFailedAt`) and rethrown.
   */
  async refreshAccountOAuth(
    tenant: CredentialTenant,
    accountId: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
    options: RefreshAccountOAuthOptions = {},
  ): Promise<OAuthCredential | undefined> {
    let result: OAuthCredential | undefined;
    let failure: { error: unknown } | undefined;
    await this.#db.updateAtomic<AccountDbRow>('model_provider_accounts', accountWhere(tenant, accountId), async row => {
      const decrypted = await this.encryption.decrypt<AuthCredential>(row.data);
      if (decrypted.value.type !== 'oauth') return null;
      const current = decrypted.value;
      // Re-check under the lock: another replica may have refreshed while we waited.
      const replaced = options.staleAccess !== undefined && current.access !== options.staleAccess;
      if (replaced || (!options.force && !isOAuthCredentialExpired(current))) {
        result = current;
        return decrypted.needsReencryption ? { data: await this.encryption.encrypt(current) } : null;
      }
      try {
        result = await refreshFn(current);
      } catch (error) {
        failure = { error };
        return { refresh_failed_at: new Date() };
      }
      return {
        data: await this.encryption.encrypt(result),
        updated_at: new Date(),
        refresh_failed_at: null,
        ...(row.status === 'auth-failed' ? { status: 'ok' } : {}),
      };
    });
    if (failure) throw failure.error;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Single-credential view: each scope's pool resolves to its active account.
  // ---------------------------------------------------------------------------

  /** Read the credential of the scope's active account for a provider. */
  async getCredential(tenant: CredentialTenant, provider: string): Promise<AuthCredential | undefined> {
    const row = await this.#activeAccount(tenant, provider);
    return row ? this.#decryptCredential(row.data) : undefined;
  }

  /**
   * Replace the credential of the scope's active account for a provider, or
   * start the pool with it. Appending further accounts is `addAccount`.
   */
  async setCredential(tenant: CredentialTenant, provider: string, credential: AuthCredential): Promise<void> {
    const active = await this.#activeAccount(tenant, provider);
    if (!active) {
      await this.addAccount(tenant, provider, { credential });
      return;
    }
    const type = accountType(credential);
    await this.#db.updateMany(
      'model_provider_accounts',
      { id: active.id },
      {
        type,
        data: await this.encryption.encrypt(credential),
        // A different credential type is a different account; drop the old identity.
        ...(type !== active.type ? { identity: null } : {}),
        status: 'ok',
        cooldown_until: null,
        refresh_failed_at: null,
        updated_at: new Date(),
      },
    );
    await this.#setActive(tenant, provider, active.id);
  }

  /**
   * Sign out of the scope's active account for a provider, leaving the
   * pool's other accounts in place; the next account in pool order becomes
   * active (as `removeAccount`). Once the pool is empty the deprecated row is
   * dropped too, so the provider reads as signed out everywhere. True when
   * anything was removed.
   */
  async removeCredential(tenant: CredentialTenant, provider: string): Promise<boolean> {
    const active = await this.#activeAccount(tenant, provider);
    const removed = active ? await this.removeAccount(tenant, active.id) : false;
    if ((await this.#listPool(tenant, provider)).length > 0) return removed;
    const legacyDeleted = await this.#db.deleteMany('model_provider_credentials', legacyTenantWhere(tenant, provider));
    return removed || legacyDeleted > 0;
  }

  /**
   * Credentials visible to a user: the active account of each of their own
   * pools plus each of the org's pools (one record per scope and provider).
   */
  async listCredentials(orgId: string, userId: string): Promise<CredentialRecord[]> {
    const where: CollectionWhere = {
      org_id: orgId,
      scope_key: { in: [scopeKey({ orgId, userId }), ORG_SCOPE_KEY] },
    };
    const [accounts, pools] = await Promise.all([
      this.#db.findMany<AccountDbRow>('model_provider_accounts', where),
      this.#db.findMany<PoolDbRow>('model_provider_account_pools', where),
    ]);
    return Promise.all(this.#activeOfEachPool(accounts, pools).map(row => this.#toRecord(row)));
  }

  /** Resolve a provider credential from exactly one tenancy scope's active account. */
  async resolveCredential(
    orgId: string,
    userId: string,
    provider: string,
    scope: CredentialScope,
  ): Promise<ResolvedCredential | undefined> {
    const tenant = scope === 'org' ? { orgId } : { orgId, userId };
    const row = await this.#activeAccount(tenant, provider);
    return row
      ? { provider: row.provider, scope, accountId: row.id, credential: await this.#decryptCredential(row.data) }
      : undefined;
  }

  /** {@link refreshAccountOAuth} for the scope's active account. */
  async refreshOAuth(
    tenant: CredentialTenant,
    provider: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
    options?: RefreshAccountOAuthOptions,
  ): Promise<OAuthCredential | undefined> {
    const active = await this.#activeAccount(tenant, provider);
    return active ? this.refreshAccountOAuth(tenant, active.id, refreshFn, options) : undefined;
  }

  /** Persist a pending login flow started by a web route. */
  async createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRow> {
    const inserted = await this.#db.insertOne<LoginSessionDbRow>('oauth_login_sessions', {
      session_id: input.sessionId,
      org_id: input.orgId,
      user_id: input.userId,
      provider: input.provider,
      kind: input.kind,
      credential_scope: input.credentialScope ?? null,
      pending: input.pending,
      expires_at: input.expiresAt,
      next_poll_at: input.nextPollAt ?? null,
      created_at: new Date(),
    });
    return toSessionRow(inserted);
  }

  /**
   * Read a pending login flow. An expired session is deleted on read (TTL
   * cleanup) and reported as absent.
   */
  async getLoginSession(sessionId: string): Promise<LoginSessionRow | undefined> {
    const row = await this.#db.findOne<LoginSessionDbRow>('oauth_login_sessions', { session_id: sessionId });
    if (!row) return undefined;
    if (row.expires_at.getTime() <= Date.now()) {
      await this.#db.deleteMany('oauth_login_sessions', { session_id: sessionId });
      return undefined;
    }
    return toSessionRow(row);
  }

  /**
   * Atomically claim a due login session for one upstream completion/poll attempt.
   * Returns undefined when the session is missing, expired, owned by another
   * tenant/provider, or already claimed by a concurrent request.
   */
  async claimLoginSession(
    sessionId: string,
    owner: Pick<LoginSessionRow, 'orgId' | 'userId' | 'provider' | 'kind'>,
  ): Promise<LoginSessionRow | undefined> {
    const now = Date.now();
    let claimed = false;
    const updated = await this.#db.updateAtomic<LoginSessionDbRow>(
      'oauth_login_sessions',
      { session_id: sessionId },
      row => {
        if (
          row.org_id !== owner.orgId ||
          row.user_id !== owner.userId ||
          row.provider !== owner.provider ||
          row.kind !== owner.kind
        ) {
          return null;
        }
        if (row.expires_at.getTime() <= now) return null;
        if (row.next_poll_at && row.next_poll_at.getTime() > now) return null;
        claimed = true;
        // Park the next poll at expiry so a concurrent claim loses until the
        // claimer either touches the session forward or deletes it.
        return { next_poll_at: row.expires_at };
      },
    );
    return claimed && updated ? toSessionRow(updated) : undefined;
  }

  /** Update a pending flow's serialized state and/or next allowed poll time. */
  async touchLoginSession(
    sessionId: string,
    updates: { pending?: Record<string, unknown>; nextPollAt?: Date | null },
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    if (updates.pending !== undefined) set.pending = updates.pending;
    if (updates.nextPollAt !== undefined) set.next_poll_at = updates.nextPollAt;
    if (Object.keys(set).length === 0) return;
    await this.#db.updateMany('oauth_login_sessions', { session_id: sessionId }, set);
  }

  /** Remove a pending login flow (completed, cancelled, or failed). */
  async deleteLoginSession(sessionId: string): Promise<void> {
    await this.#db.deleteMany('oauth_login_sessions', { session_id: sessionId });
  }
}
