/**
 * Model provider credentials domain — tenant-scoped OAuth tokens and API keys
 * for model providers (Anthropic/Claude Max, OpenAI Codex, GitHub Copilot,
 * xAI, plus plain API-key providers).
 *
 * Tenancy is two-level:
 * - **user-scoped** rows (`userId` present): personal sign-ins and API keys.
 * - **org-scoped** rows (`userId` absent): sign-ins and API keys an org admin
 *   shares with every member.
 *
 * Model calls resolve exactly one scope: user or org. Deployed tenant stores
 * never fall back to the other scope or implicitly borrow server environment keys.
 *
 * A provider can hold several OAuth subscriptions at one scope, so a model call
 * rate-limited on one subscription can retry on the next. They all live in the
 * provider's one row (see `schemas.ts`).
 *
 * Secrets posture: credentials are stored server-side only and never returned
 * to the client (same as `linear_connections.access_token`).
 *
 * The domain also owns `oauth_login_sessions`: pending web login flows
 * (paste-code PKCE verifiers, device-code poll state) persisted server-side so
 * any replica can complete or poll a flow started on another.
 */

import { randomUUID } from 'node:crypto';

import { getOAuthProvider } from '@mastra/code-sdk/auth/storage';
import type { AuthCredential, OAuthCredential } from '@mastra/code-sdk/auth/types';
import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';
import { CREDENTIALS, LOGIN_SESSIONS, MODEL_CREDENTIALS_SCHEMA, OAUTH_LOGIN_SESSIONS_SCHEMA } from './schemas.js';
import type { CredentialDbRow, LoginSessionDbRow } from './schemas.js';

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
  credential: AuthCredential;
  updatedAt: Date;
  /** When the last OAuth token refresh failed; cleared by the next successful refresh or a new sign-in. */
  refreshFailedAt?: Date;
}

/** One OAuth subscription of a provider, in sign-in order among that provider's accounts at its scope. */
export interface CredentialAccount {
  id: string;
  provider: string;
  scope: CredentialScope;
  /** Who the subscription belongs to (an email), when the provider tells us. */
  label?: string;
  credential: OAuthCredential;
  addedAt: Date;
  refreshFailedAt?: Date;
}

export interface AddAccountOptions {
  label?: string;
  /** Sign in again to this account: its tokens are replaced and its place in the order kept. */
  replaceAccountId?: string;
}

/** Result of per-caller resolution: the winning credential and its scope. */
export interface ResolvedCredential {
  /** The account's id; for an API key, its row's id. */
  accountId: string;
  provider: string;
  scope: CredentialScope;
  credential: AuthCredential;
}

/** Kind of pending web login flow a session row tracks. */
export type LoginSessionKind = 'paste-code' | 'device-code';

/** Scope the completed credential should be written to. */
export type LoginCredentialScope = 'user' | 'org';

/** Which subscription a sign-in lands on: a new one beside the others, or one to sign in again to. */
export type LoginAccountTarget = { add: true } | { accountId: string };

/** One pending OAuth login flow, persisted so any replica can continue it. */
export interface LoginSessionRow {
  sessionId: string;
  orgId: string;
  userId: string;
  provider: string;
  kind: LoginSessionKind;
  /** Where the completed credential lands; absent rows default to `'user'`. */
  credentialScope?: LoginCredentialScope;
  /** Absent: the sign-in replaces the provider's first subscription. */
  accountTarget?: LoginAccountTarget;
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
  accountTarget?: LoginAccountTarget;
  pending: Record<string, unknown>;
  expiresAt: Date;
  nextPollAt?: Date | null;
}

/** Mirror of `AuthStorage.getApiKey()`'s expiry check. */
export function isOAuthCredentialExpired(credential: OAuthCredential, now = Date.now()): boolean {
  return now >= credential.expires;
}

function toSessionRow(db: LoginSessionDbRow): LoginSessionRow {
  return {
    sessionId: db.session_id,
    orgId: db.org_id,
    userId: db.user_id,
    provider: db.provider,
    kind: db.kind,
    ...(db.credential_scope ? { credentialScope: db.credential_scope } : {}),
    ...(db.account_target ? { accountTarget: db.account_target } : {}),
    pending: db.pending,
    expiresAt: db.expires_at,
    nextPollAt: db.next_poll_at,
    createdAt: db.created_at,
  };
}

/** Filter selecting exactly the tenant's rows for a provider (`null` = org rows). */
function tenantWhere(tenant: CredentialTenant, provider: string): CollectionWhere {
  return { org_id: tenant.orgId, provider, user_id: tenant.userId ?? null };
}

/**
 * Whether two sign-ins are the same subscription: the provider's stable
 * account identity when it exposes one, else identical refresh tokens (all an
 * identity-less provider such as Anthropic gives us).
 */
function sameSubscription(provider: string, a: OAuthCredential, b: OAuthCredential): boolean {
  const identityOf = getOAuthProvider(provider)?.getAccountIdentity;
  const identities = identityOf ? [identityOf(a), identityOf(b)] : [];
  if (identities[0] !== undefined && identities[1] !== undefined) return identities[0] === identities[1];
  return a.refresh === b.refresh;
}

/** A second or later subscription, as stored in the row's encrypted `extra_accounts` list. */
interface StoredAccount {
  id: string;
  label?: string;
  credential: OAuthCredential;
  addedAt: string;
  refreshFailedAt?: string;
}

const firstAccountId = (row: CredentialDbRow) => row.account_id ?? row.id;

/**
 * Model-credentials storage, written once against the generic
 * `FactoryStorageOps` surface. Every change to a provider's accounts, and
 * `claimLoginSession()`, rides `updateAtomic` so concurrent replicas serialize
 * instead of invalidating each other's rotating tokens / double-claiming a flow.
 */
export class ModelCredentialsStorage extends FactoryStorageDomain {
  constructor(private readonly encryption: FactorySecretEncryption = createPlaintextFactorySecretEncryption()) {
    super('model-credentials');
  }

  async init(): Promise<void> {
    await this.ensureCollections([MODEL_CREDENTIALS_SCHEMA, OAUTH_LOGIN_SESSIONS_SCHEMA]);
    const rows = await this.ops.findMany<CredentialDbRow>(CREDENTIALS, {});
    await Promise.all(rows.map(row => this.#migrateCredential(row.id)));
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(LOGIN_SESSIONS, {});
    await this.ops.deleteMany(CREDENTIALS, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #decryptCredential(value: unknown): Promise<AuthCredential> {
    return (await this.encryption.decrypt<AuthCredential>(value)).value;
  }

  async #extras(row: CredentialDbRow): Promise<StoredAccount[]> {
    if (row.extra_accounts == null) return [];
    return (await this.encryption.decrypt<StoredAccount[]>(row.extra_accounts)).value;
  }

  async #encryptExtras(extras: StoredAccount[]): Promise<string | null> {
    return extras.length > 0 ? this.encryption.encrypt(extras) : null;
  }

  async #toRecord(row: CredentialDbRow, scope: CredentialScope): Promise<CredentialRecord> {
    return {
      provider: row.provider,
      scope,
      credential: await this.#decryptCredential(row.data),
      updatedAt: row.updated_at,
      refreshFailedAt: row.refresh_failed_at ?? undefined,
    };
  }

  async #migrateCredential(id: string): Promise<void> {
    await this.#db.updateAtomic<CredentialDbRow>(CREDENTIALS, { id }, async row => {
      const data = await this.encryption.decrypt<AuthCredential>(row.data);
      const extras =
        row.extra_accounts == null ? undefined : await this.encryption.decrypt<StoredAccount[]>(row.extra_accounts);
      if (!data.needsReencryption && !extras?.needsReencryption) return null;
      return {
        data: await this.encryption.encrypt(data.value),
        ...(extras ? { extra_accounts: await this.encryption.encrypt(extras.value) } : {}),
      };
    });
  }

  /** The user's own rows plus the org's shared rows. SQL `IN` never matches NULL, so the org rows need their own query. */
  async #visibleRows(orgId: string, userId: string) {
    const [userRows, orgRows] = await Promise.all([
      this.#db.findMany<CredentialDbRow>(CREDENTIALS, { org_id: orgId, user_id: userId }),
      this.#db.findMany<CredentialDbRow>(CREDENTIALS, { org_id: orgId, user_id: null }),
    ]);
    return [
      ...userRows.map(row => ({ row, scope: 'user' as const })),
      ...orgRows.map(row => ({ row, scope: 'org' as const })),
    ];
  }

  /** Read the tenant's credential for a provider at exactly that scope. */
  async getCredential(tenant: CredentialTenant, provider: string): Promise<AuthCredential | undefined> {
    const row = await this.#db.findOne<CredentialDbRow>(CREDENTIALS, tenantWhere(tenant, provider));
    return row ? this.#decryptCredential(row.data) : undefined;
  }

  /**
   * Upsert the tenant's credential (`created_at` is preserved on update).
   * Saving an API key replaces every OAuth subscription at that scope.
   */
  async setCredential(tenant: CredentialTenant, provider: string, credential: AuthCredential): Promise<void> {
    await this.#upsertFirst(tenant, provider, credential, null);
  }

  async #upsertFirst(
    tenant: CredentialTenant,
    provider: string,
    credential: AuthCredential,
    label: string | null,
  ): Promise<void> {
    const where = tenantWhere(tenant, provider);
    const encrypted = await this.encryption.encrypt(credential);
    const update = async () =>
      this.#db.updateMany(CREDENTIALS, where, {
        type: credential.type,
        data: encrypted,
        label,
        ...(credential.type === 'api_key' ? { account_id: null, extra_accounts: null } : {}),
        updated_at: new Date(),
        refresh_failed_at: null,
      });

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      if ((await update()) > 0) return;

      const now = new Date();
      try {
        await this.#db.insertOne<CredentialDbRow>(CREDENTIALS, {
          org_id: tenant.orgId,
          user_id: tenant.userId ?? null,
          provider,
          type: credential.type,
          data: encrypted,
          label,
          created_at: now,
          updated_at: now,
        });
        return;
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  /**
   * Store an OAuth sign-in as one of the provider's subscriptions at that
   * scope. A sign-in to a subscription already held updates it in place; a
   * new one is added after the others; the first replaces any API key.
   */
  async addAccount(
    tenant: CredentialTenant,
    provider: string,
    credential: OAuthCredential,
    options: AddAccountOptions = {},
  ): Promise<void> {
    const encrypted = await this.encryption.encrypt(credential);
    const now = new Date();
    const updated = await this.#db.updateAtomic<CredentialDbRow>(
      CREDENTIALS,
      tenantWhere(tenant, provider),
      async row => {
        const first = await this.#decryptCredential(row.data);
        const fresh = { data: encrypted, updated_at: now, refresh_failed_at: null };
        if (first.type !== 'oauth') {
          return { ...fresh, type: 'oauth', label: options.label ?? null, account_id: null, extra_accounts: null };
        }
        const isTarget = (id: string, held: OAuthCredential) =>
          options.replaceAccountId ? options.replaceAccountId === id : sameSubscription(provider, held, credential);
        if (isTarget(firstAccountId(row), first)) {
          return { ...fresh, ...(options.label !== undefined ? { label: options.label } : {}) };
        }

        const extras = await this.#extras(row);
        const index = extras.findIndex(account => isTarget(account.id, account.credential));
        if (index >= 0) {
          const { refreshFailedAt: _cleared, ...held } = extras[index]!;
          extras[index] = { ...held, credential, ...(options.label !== undefined ? { label: options.label } : {}) };
        } else {
          extras.push({
            id: randomUUID(),
            ...(options.label !== undefined ? { label: options.label } : {}),
            credential,
            addedAt: now.toISOString(),
          });
        }
        return { extra_accounts: await this.#encryptExtras(extras), updated_at: now };
      },
    );
    if (!updated) await this.#upsertFirst(tenant, provider, credential, options.label ?? null);
  }

  async #accountsOf(row: CredentialDbRow, scope: CredentialScope): Promise<CredentialAccount[]> {
    const first = await this.#decryptCredential(row.data);
    const extras = await this.#extras(row);
    return [
      ...(first.type === 'oauth'
        ? [
            {
              id: firstAccountId(row),
              provider: row.provider,
              scope,
              ...(row.label ? { label: row.label } : {}),
              credential: first,
              addedAt: row.created_at,
              ...(row.refresh_failed_at ? { refreshFailedAt: row.refresh_failed_at } : {}),
            },
          ]
        : []),
      ...extras.map(account => ({
        id: account.id,
        provider: row.provider,
        scope,
        ...(account.label ? { label: account.label } : {}),
        credential: account.credential,
        addedAt: new Date(account.addedAt),
        ...(account.refreshFailedAt ? { refreshFailedAt: new Date(account.refreshFailedAt) } : {}),
      })),
    ];
  }

  /**
   * Every OAuth subscription visible to a user — their own, then the org's —
   * each provider's accounts in sign-in order.
   */
  async listAccounts(orgId: string, userId: string): Promise<CredentialAccount[]> {
    const rows = await this.#visibleRows(orgId, userId);
    return (await Promise.all(rows.map(({ row, scope }) => this.#accountsOf(row, scope)))).flat();
  }

  /**
   * Remove one subscription. Removing the first promotes the next one into its
   * place so the provider stays connected. True when an account was removed.
   */
  async removeAccount(tenant: CredentialTenant, provider: string, accountId: string): Promise<boolean> {
    let removed = false;
    let lastAccount: string | undefined;
    await this.#db.updateAtomic<CredentialDbRow>(CREDENTIALS, tenantWhere(tenant, provider), async row => {
      const extras = await this.#extras(row);
      const index = extras.findIndex(account => account.id === accountId);
      if (index >= 0) {
        removed = true;
        extras.splice(index, 1);
        return { extra_accounts: await this.#encryptExtras(extras), updated_at: new Date() };
      }
      if (firstAccountId(row) !== accountId) return null;
      removed = true;
      const [next, ...rest] = extras;
      if (!next) {
        lastAccount = row.id;
        return null;
      }
      return {
        type: 'oauth',
        data: await this.encryption.encrypt(next.credential),
        label: next.label ?? null,
        account_id: next.id,
        extra_accounts: await this.#encryptExtras(rest),
        updated_at: new Date(),
        refresh_failed_at: next.refreshFailedAt ? new Date(next.refreshFailedAt) : null,
      };
    });
    if (lastAccount) await this.#db.deleteMany(CREDENTIALS, { id: lastAccount, extra_accounts: null });
    return removed;
  }

  /** Delete the tenant's credential and every subscription at exactly that scope. True when a row was removed. */
  async removeCredential(tenant: CredentialTenant, provider: string): Promise<boolean> {
    return (await this.#db.deleteMany(CREDENTIALS, tenantWhere(tenant, provider))) > 0;
  }

  /** All credentials visible to a user: their own rows plus the org's shared rows. */
  async listCredentials(orgId: string, userId: string): Promise<CredentialRecord[]> {
    const rows = await this.#visibleRows(orgId, userId);
    return Promise.all(rows.map(({ row, scope }) => this.#toRecord(row, scope)));
  }

  /** Resolve a provider credential from exactly one tenancy scope: the first account, or `accountId`. */
  async resolveCredential(
    orgId: string,
    userId: string,
    provider: string,
    scope: CredentialScope,
    accountId?: string,
  ): Promise<ResolvedCredential | undefined> {
    const tenant = scope === 'org' ? { orgId } : { orgId, userId };
    const row = await this.#db.findOne<CredentialDbRow>(CREDENTIALS, tenantWhere(tenant, provider));
    if (!row) return undefined;
    if (accountId === undefined || accountId === firstAccountId(row)) {
      return { accountId: firstAccountId(row), provider, scope, credential: await this.#decryptCredential(row.data) };
    }
    const extra = (await this.#extras(row)).find(account => account.id === accountId);
    return extra ? { accountId, provider, scope, credential: extra.credential } : undefined;
  }

  /**
   * Refresh one OAuth account (the first, or `accountId`) under the backend's
   * atomic read-modify-write so concurrent replicas don't invalidate each
   * other's rotating refresh tokens. The expiry is re-checked under the lock —
   * another replica may have refreshed already, in which case `refreshFn` is
   * skipped and the fresh credential is returned. Returns `undefined` when no
   * such OAuth account exists. A failed `refreshFn` is recorded on that account
   * (surfaced as `refreshFailedAt`) and rethrown.
   *
   * `needsRefresh` replaces the expiry check, e.g. to replace an access token
   * the provider rejected before its recorded expiry.
   */
  async refreshOAuth(
    tenant: CredentialTenant,
    provider: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
    needsRefresh: (current: OAuthCredential) => boolean = current => isOAuthCredentialExpired(current),
    accountId?: string,
  ): Promise<OAuthCredential | undefined> {
    let result: OAuthCredential | undefined;
    let failure: { error: unknown } | undefined;
    await this.#db.updateAtomic<CredentialDbRow>(CREDENTIALS, tenantWhere(tenant, provider), async row => {
      if (accountId === undefined || accountId === firstAccountId(row)) {
        const decrypted = await this.encryption.decrypt<AuthCredential>(row.data);
        if (decrypted.value.type !== 'oauth') return null;
        const current = decrypted.value;
        // Re-check under the lock: another replica may have refreshed while we waited.
        if (!needsRefresh(current)) {
          result = current;
          return decrypted.needsReencryption ? { data: await this.encryption.encrypt(current) } : null;
        }
        try {
          result = await refreshFn(current);
        } catch (error) {
          failure = { error };
          return { refresh_failed_at: new Date() };
        }
        return { data: await this.encryption.encrypt(result), updated_at: new Date(), refresh_failed_at: null };
      }

      const extras = await this.#extras(row);
      const index = extras.findIndex(account => account.id === accountId);
      const account = extras[index];
      if (!account) return null;
      if (!needsRefresh(account.credential)) {
        result = account.credential;
        return null;
      }
      try {
        result = await refreshFn(account.credential);
        const { refreshFailedAt: _cleared, ...held } = account;
        extras[index] = { ...held, credential: result };
      } catch (error) {
        failure = { error };
        extras[index] = { ...account, refreshFailedAt: new Date().toISOString() };
      }
      return { extra_accounts: await this.#encryptExtras(extras), updated_at: new Date() };
    });
    if (failure) throw failure.error;
    return result;
  }

  /** Persist a pending login flow started by a web route. */
  async createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRow> {
    const inserted = await this.#db.insertOne<LoginSessionDbRow>(LOGIN_SESSIONS, {
      session_id: input.sessionId,
      org_id: input.orgId,
      user_id: input.userId,
      provider: input.provider,
      kind: input.kind,
      credential_scope: input.credentialScope ?? null,
      account_target: input.accountTarget ?? null,
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
    const row = await this.#db.findOne<LoginSessionDbRow>(LOGIN_SESSIONS, { session_id: sessionId });
    if (!row) return undefined;
    if (row.expires_at.getTime() <= Date.now()) {
      await this.#db.deleteMany(LOGIN_SESSIONS, { session_id: sessionId });
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
    const updated = await this.#db.updateAtomic<LoginSessionDbRow>(LOGIN_SESSIONS, { session_id: sessionId }, row => {
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
    });
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
    await this.#db.updateMany(LOGIN_SESSIONS, { session_id: sessionId }, set);
  }

  /** Remove a pending login flow (completed, cancelled, or failed). */
  async deleteLoginSession(sessionId: string): Promise<void> {
    await this.#db.deleteMany(LOGIN_SESSIONS, { session_id: sessionId });
  }
}
