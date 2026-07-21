/**
 * Model provider credentials domain — tenant-scoped OAuth tokens and API keys
 * for model providers (Anthropic/Claude Max, OpenAI Codex, GitHub Copilot,
 * xAI, plus plain API-key providers).
 *
 * Tenancy is two-level:
 * - **user-scoped** rows (`userId` present): personal plan OAuth tokens and
 *   personal API keys. OAuth plan tokens are ONLY ever user-scoped — they are
 *   personal subscriptions, and sharing one would bill/rate-limit a single
 *   account for the whole org.
 * - **org-scoped** rows (`userId` absent): shared API keys set by an org
 *   admin, inherited by every member.
 *
 * Resolution order at model-call time is user > org (the caller layers server
 * env vars underneath as a final fallback).
 *
 * Secrets posture: credentials are stored server-side only and never returned
 * to the client (same as `linear_connections.access_token`). Encryption at
 * rest is out of scope, matching the existing posture.
 *
 * The domain also owns `oauth_login_sessions`: pending web login flows
 * (paste-code PKCE verifiers, device-code poll state) persisted server-side so
 * any replica can complete or poll a flow started on another.
 */

import type { AuthCredential, OAuthCredential } from '@mastra/code-sdk/auth/types';
import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

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
}

/** Result of per-caller resolution: the winning credential and its scope. */
export interface ResolvedCredential {
  provider: string;
  scope: CredentialScope;
  credential: AuthCredential;
}

/** Kind of pending web login flow a session row tracks. */
export type LoginSessionKind = 'paste-code' | 'device-code';

/** One pending OAuth login flow, persisted so any replica can continue it. */
export interface LoginSessionRow {
  sessionId: string;
  orgId: string;
  userId: string;
  provider: string;
  kind: LoginSessionKind;
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
  pending: Record<string, unknown>;
  expiresAt: Date;
  nextPollAt?: Date | null;
}

/** Mirror of `AuthStorage.getApiKey()`'s expiry check. */
export function isOAuthCredentialExpired(credential: OAuthCredential, now = Date.now()): boolean {
  return now >= credential.expires;
}

/** OAuth plan credentials are personal and must always have an owning user. */
export function assertCredentialScope(tenant: CredentialTenant, credential: AuthCredential): void {
  if (credential.type === 'oauth' && !tenant.userId) {
    throw new Error('OAuth credentials must be user-scoped');
  }
}

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

export const OAUTH_LOGIN_SESSIONS_SCHEMA: CollectionSchema = {
  name: 'oauth_login_sessions',
  columns: {
    session_id: { type: 'text', primaryKey: true },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    provider: { type: 'text' },
    kind: { type: 'text' },
    pending: { type: 'json' },
    expires_at: { type: 'timestamp' },
    next_poll_at: { type: 'timestamp', nullable: true },
    created_at: { type: 'timestamp' },
  },
};

/** Column shape of one `model_provider_credentials` row as returned by ops. */
interface CredentialDbRow extends Record<string, unknown> {
  id: string;
  provider: string;
  user_id: string | null;
  data: AuthCredential;
  updated_at: Date;
}

/** Column shape of one `oauth_login_sessions` row as returned by ops. */
interface LoginSessionDbRow extends Record<string, unknown> {
  session_id: string;
  org_id: string;
  user_id: string;
  provider: string;
  kind: LoginSessionKind;
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
    pending: db.pending,
    expiresAt: db.expires_at,
    nextPollAt: db.next_poll_at,
    createdAt: db.created_at,
  };
}

/** Filter selecting exactly the tenant's row for a provider (`null` = org row). */
function tenantWhere(tenant: CredentialTenant, provider: string): CollectionWhere {
  return { org_id: tenant.orgId, provider, user_id: tenant.userId ?? null };
}

/**
 * Model-credentials storage, written once against the generic
 * `FactoryStorageOps` surface. `refreshOAuth()` and `claimLoginSession()`
 * ride `updateAtomic` so concurrent replicas serialize instead of
 * invalidating each other's rotating tokens / double-claiming a flow.
 */
export class ModelCredentialsStorage extends FactoryStorageDomain {
  constructor() {
    super('model-credentials');
  }

  async init(): Promise<void> {
    await this.ensureCollections([MODEL_CREDENTIALS_SCHEMA, OAUTH_LOGIN_SESSIONS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('oauth_login_sessions', {});
    await this.ops.deleteMany('model_provider_credentials', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** Read the tenant's credential for a provider at exactly that scope. */
  async getCredential(tenant: CredentialTenant, provider: string): Promise<AuthCredential | undefined> {
    const row = await this.#db.findOne<CredentialDbRow>('model_provider_credentials', tenantWhere(tenant, provider));
    return row?.data;
  }

  /** Upsert the tenant's credential (`created_at` is preserved on update). */
  async setCredential(tenant: CredentialTenant, provider: string, credential: AuthCredential): Promise<void> {
    assertCredentialScope(tenant, credential);
    const where = tenantWhere(tenant, provider);
    const update = async () =>
      this.#db.updateMany('model_provider_credentials', where, {
        type: credential.type,
        data: credential,
        updated_at: new Date(),
      });

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      if ((await update()) > 0) return;

      const now = new Date();
      try {
        await this.#db.insertOne<CredentialDbRow>('model_provider_credentials', {
          org_id: tenant.orgId,
          user_id: tenant.userId ?? null,
          provider,
          type: credential.type,
          data: credential,
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

  /** Delete the tenant's credential at exactly that scope. True when a row was removed. */
  async removeCredential(tenant: CredentialTenant, provider: string): Promise<boolean> {
    const deleted = await this.#db.deleteMany('model_provider_credentials', tenantWhere(tenant, provider));
    return deleted > 0;
  }

  /** All credentials visible to a user: their own rows plus the org's shared rows. */
  async listCredentials(orgId: string, userId: string): Promise<CredentialRecord[]> {
    // SQL `IN` never matches NULL, so the org rows need their own query.
    const [userRows, orgRows] = await Promise.all([
      this.#db.findMany<CredentialDbRow>('model_provider_credentials', { org_id: orgId, user_id: userId }),
      this.#db.findMany<CredentialDbRow>('model_provider_credentials', { org_id: orgId, user_id: null }),
    ]);
    return [
      ...userRows.map(row => ({
        provider: row.provider,
        scope: 'user' as const,
        credential: row.data,
        updatedAt: row.updated_at,
      })),
      ...orgRows.map(row => ({
        provider: row.provider,
        scope: 'org' as const,
        credential: row.data,
        updatedAt: row.updated_at,
      })),
    ];
  }

  /**
   * Resolve the credential a caller should use for a provider: the user's own
   * row wins over the org's shared row.
   */
  async resolveCredential(orgId: string, userId: string, provider: string): Promise<ResolvedCredential | undefined> {
    const userRow = await this.#db.findOne<CredentialDbRow>('model_provider_credentials', {
      org_id: orgId,
      provider,
      user_id: userId,
    });
    if (userRow) return { provider: userRow.provider, scope: 'user', credential: userRow.data };
    const orgRow = await this.#db.findOne<CredentialDbRow>('model_provider_credentials', {
      org_id: orgId,
      provider,
      user_id: null,
    });
    if (orgRow) return { provider: orgRow.provider, scope: 'org', credential: orgRow.data };
    return undefined;
  }

  /**
   * Refresh the tenant's OAuth credential under the backend's atomic
   * read-modify-write so concurrent replicas don't invalidate each other's
   * rotating refresh tokens. The expiry is re-checked under the lock —
   * another replica may have refreshed already, in which case `refreshFn` is
   * skipped and the fresh credential is returned. Returns `undefined` when no
   * OAuth row exists for the tenant.
   */
  async refreshOAuth(
    tenant: CredentialTenant,
    provider: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
  ): Promise<OAuthCredential | undefined> {
    let result: OAuthCredential | undefined;
    await this.#db.updateAtomic<CredentialDbRow>(
      'model_provider_credentials',
      tenantWhere(tenant, provider),
      async row => {
        if (row.data.type !== 'oauth') return null;
        const current = row.data;
        // Re-check under the lock: another replica may have refreshed while we waited.
        if (!isOAuthCredentialExpired(current)) {
          result = current;
          return null;
        }
        const next = await refreshFn(current);
        result = next;
        return { data: next, updated_at: new Date() };
      },
    );
    return result;
  }

  /** Persist a pending login flow started by a web route. */
  async createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRow> {
    const inserted = await this.#db.insertOne<LoginSessionDbRow>('oauth_login_sessions', {
      session_id: input.sessionId,
      org_id: input.orgId,
      user_id: input.userId,
      provider: input.provider,
      kind: input.kind,
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
