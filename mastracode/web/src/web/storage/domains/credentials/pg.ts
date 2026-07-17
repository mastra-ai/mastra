/**
 * Postgres model-credentials storage, bound to the shared pool from the
 * `PostgresStore` injected into `MastraFactory`. `init()` owns the idempotent
 * DDL.
 *
 * Scope is encoded in `user_id` nullability (NULL = org-scoped shared row),
 * enforced by two partial unique indexes. `refreshOAuth()` runs inside a
 * transaction with the row read `FOR UPDATE` and the expiry re-checked after
 * acquiring the lock, so replicas racing to refresh a rotating token
 * serialize instead of invalidating each other.
 */

import type pg from 'pg';

import type { AuthCredential, OAuthCredential } from '@mastra/code-sdk/auth/types';

import type { FactoryStorageContext } from '../../domain';
import { ModelCredentialsStorage, assertCredentialScope, isOAuthCredentialExpired } from './base';
import type {
  CreateLoginSessionInput,
  CredentialRecord,
  CredentialTenant,
  LoginSessionRow,
  ResolvedCredential,
} from './base';

export const MODEL_CREDENTIALS_DDL = `
CREATE TABLE IF NOT EXISTS model_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  user_id text,
  provider text NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS model_provider_credentials_user_unique
  ON model_provider_credentials (org_id, user_id, provider)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS model_provider_credentials_org_unique
  ON model_provider_credentials (org_id, provider)
  WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS oauth_login_sessions (
  session_id text PRIMARY KEY,
  org_id text NOT NULL,
  user_id text NOT NULL,
  provider text NOT NULL,
  kind text NOT NULL,
  pending jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  next_poll_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

interface CredentialDbRow {
  provider: string;
  user_id: string | null;
  data: AuthCredential;
  updated_at: Date;
}

interface LoginSessionDbRow {
  session_id: string;
  org_id: string;
  user_id: string;
  provider: string;
  kind: LoginSessionRow['kind'];
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

/** WHERE clause + params selecting exactly the tenant's row for a provider. */
function tenantWhere(tenant: CredentialTenant, provider: string): { where: string; params: unknown[] } {
  if (tenant.userId !== undefined) {
    return { where: 'org_id = $1 AND provider = $2 AND user_id = $3', params: [tenant.orgId, provider, tenant.userId] };
  }
  return { where: 'org_id = $1 AND provider = $2 AND user_id IS NULL', params: [tenant.orgId, provider] };
}

export class ModelCredentialsStoragePG extends ModelCredentialsStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(MODEL_CREDENTIALS_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[ModelCredentialsStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  async #withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getCredential(tenant: CredentialTenant, provider: string): Promise<AuthCredential | undefined> {
    const { where, params } = tenantWhere(tenant, provider);
    const { rows } = await this.#db.query<CredentialDbRow>(
      `SELECT data FROM model_provider_credentials WHERE ${where}`,
      params,
    );
    return rows[0]?.data;
  }

  async setCredential(tenant: CredentialTenant, provider: string, credential: AuthCredential): Promise<void> {
    assertCredentialScope(tenant, credential);
    // The two partial unique indexes force per-arity conflict targets: user
    // rows conflict on (org_id, user_id, provider), org rows on (org_id, provider).
    const conflict =
      tenant.userId !== undefined
        ? 'ON CONFLICT (org_id, user_id, provider) WHERE user_id IS NOT NULL'
        : 'ON CONFLICT (org_id, provider) WHERE user_id IS NULL';
    await this.#db.query(
      `INSERT INTO model_provider_credentials (org_id, user_id, provider, type, data, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ${conflict}
       DO UPDATE SET type = EXCLUDED.type, data = EXCLUDED.data, updated_at = now()`,
      [tenant.orgId, tenant.userId ?? null, provider, credential.type, JSON.stringify(credential)],
    );
  }

  async removeCredential(tenant: CredentialTenant, provider: string): Promise<boolean> {
    const { where, params } = tenantWhere(tenant, provider);
    const { rows } = await this.#db.query(`DELETE FROM model_provider_credentials WHERE ${where} RETURNING id`, params);
    return rows.length > 0;
  }

  async listCredentials(orgId: string, userId: string): Promise<CredentialRecord[]> {
    const { rows } = await this.#db.query<CredentialDbRow>(
      `SELECT provider, user_id, data, updated_at FROM model_provider_credentials
       WHERE org_id = $1 AND (user_id = $2 OR user_id IS NULL)`,
      [orgId, userId],
    );
    return rows.map(row => ({
      provider: row.provider,
      scope: row.user_id === null ? ('org' as const) : ('user' as const),
      credential: row.data,
      updatedAt: row.updated_at,
    }));
  }

  async resolveCredential(orgId: string, userId: string, provider: string): Promise<ResolvedCredential | undefined> {
    // User row sorts before the org row (NULLS LAST) — user > org in one query.
    const { rows } = await this.#db.query<CredentialDbRow>(
      `SELECT provider, user_id, data, updated_at FROM model_provider_credentials
       WHERE org_id = $1 AND provider = $2 AND (user_id = $3 OR user_id IS NULL)
       ORDER BY user_id NULLS LAST
       LIMIT 1`,
      [orgId, provider, userId],
    );
    const row = rows[0];
    if (!row) return undefined;
    return { provider: row.provider, scope: row.user_id === null ? 'org' : 'user', credential: row.data };
  }

  async refreshOAuth(
    tenant: CredentialTenant,
    provider: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
  ): Promise<OAuthCredential | undefined> {
    const { where, params } = tenantWhere(tenant, provider);
    return this.#withTx(async client => {
      const { rows } = await client.query<CredentialDbRow & { id: string }>(
        `SELECT id, data FROM model_provider_credentials WHERE ${where} FOR UPDATE`,
        params,
      );
      const row = rows[0];
      if (!row || row.data.type !== 'oauth') return undefined;
      const current = row.data;
      // Re-check under the lock: another replica may have refreshed while we waited.
      if (!isOAuthCredentialExpired(current)) return current;
      const next = await refreshFn(current);
      await client.query(`UPDATE model_provider_credentials SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [
        row.id,
        JSON.stringify(next),
      ]);
      return next;
    });
  }

  async createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRow> {
    const { rows } = await this.#db.query<LoginSessionDbRow>(
      `INSERT INTO oauth_login_sessions
         (session_id, org_id, user_id, provider, kind, pending, expires_at, next_poll_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       RETURNING *`,
      [
        input.sessionId,
        input.orgId,
        input.userId,
        input.provider,
        input.kind,
        JSON.stringify(input.pending),
        input.expiresAt,
        input.nextPollAt ?? null,
      ],
    );
    return toSessionRow(rows[0]!);
  }

  async getLoginSession(sessionId: string): Promise<LoginSessionRow | undefined> {
    const { rows } = await this.#db.query<LoginSessionDbRow>(
      `SELECT * FROM oauth_login_sessions WHERE session_id = $1`,
      [sessionId],
    );
    const row = rows[0];
    if (!row) return undefined;
    if (row.expires_at.getTime() <= Date.now()) {
      // TTL cleanup on read; also sweep any other expired sessions.
      await this.#db.query(`DELETE FROM oauth_login_sessions WHERE expires_at <= now()`);
      return undefined;
    }
    return toSessionRow(row);
  }

  async claimLoginSession(
    sessionId: string,
    owner: Pick<LoginSessionRow, 'orgId' | 'userId' | 'provider' | 'kind'>,
  ): Promise<LoginSessionRow | undefined> {
    const { rows } = await this.#db.query<LoginSessionDbRow>(
      `UPDATE oauth_login_sessions
       SET next_poll_at = expires_at
       WHERE session_id = $1
         AND org_id = $2
         AND user_id = $3
         AND provider = $4
         AND kind = $5
         AND expires_at > now()
         AND (next_poll_at IS NULL OR next_poll_at <= now())
       RETURNING *`,
      [sessionId, owner.orgId, owner.userId, owner.provider, owner.kind],
    );
    return rows[0] ? toSessionRow(rows[0]) : undefined;
  }

  async touchLoginSession(
    sessionId: string,
    updates: { pending?: Record<string, unknown>; nextPollAt?: Date | null },
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [sessionId];
    if (updates.pending !== undefined) {
      params.push(JSON.stringify(updates.pending));
      sets.push(`pending = $${params.length}::jsonb`);
    }
    if (updates.nextPollAt !== undefined) {
      params.push(updates.nextPollAt);
      sets.push(`next_poll_at = $${params.length}`);
    }
    if (sets.length === 0) return;
    await this.#db.query(`UPDATE oauth_login_sessions SET ${sets.join(', ')} WHERE session_id = $1`, params);
  }

  async deleteLoginSession(sessionId: string): Promise<void> {
    await this.#db.query(`DELETE FROM oauth_login_sessions WHERE session_id = $1`, [sessionId]);
  }
}
