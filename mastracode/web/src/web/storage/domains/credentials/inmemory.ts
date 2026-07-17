/**
 * In-memory model-credentials storage for unit and route tests. Mirrors the
 * Postgres implementation's semantics, including refresh serialization:
 * `refreshOAuth()` calls for the same row are chained so a concurrent refresh
 * observes the previous one's result (the FOR UPDATE re-check behavior).
 */

import type { AuthCredential, OAuthCredential } from '@mastra/code-sdk/auth/types';

import { ModelCredentialsStorage, assertCredentialScope, isOAuthCredentialExpired } from './base';
import type {
  CreateLoginSessionInput,
  CredentialRecord,
  CredentialTenant,
  LoginSessionRow,
  ResolvedCredential,
} from './base';

interface StoredRow {
  credential: AuthCredential;
  updatedAt: Date;
}

export class ModelCredentialsStorageInMemory extends ModelCredentialsStorage {
  #rows = new Map<string, StoredRow>();
  #sessions = new Map<string, LoginSessionRow>();
  /** Per-row promise chain standing in for the pg row lock. */
  #locks = new Map<string, Promise<unknown>>();

  async init(): Promise<void> {
    // Nothing to set up.
  }

  #key(tenant: CredentialTenant, provider: string): string {
    return `${tenant.orgId}\u0000${tenant.userId ?? ''}\u0000${provider}`;
  }

  async getCredential(tenant: CredentialTenant, provider: string): Promise<AuthCredential | undefined> {
    const row = this.#rows.get(this.#key(tenant, provider));
    return row ? structuredClone(row.credential) : undefined;
  }

  async setCredential(tenant: CredentialTenant, provider: string, credential: AuthCredential): Promise<void> {
    assertCredentialScope(tenant, credential);
    this.#rows.set(this.#key(tenant, provider), { credential: structuredClone(credential), updatedAt: new Date() });
  }

  async removeCredential(tenant: CredentialTenant, provider: string): Promise<boolean> {
    return this.#rows.delete(this.#key(tenant, provider));
  }

  async listCredentials(orgId: string, userId: string): Promise<CredentialRecord[]> {
    const records: CredentialRecord[] = [];
    for (const [key, row] of this.#rows) {
      const [rowOrg, rowUser, provider] = key.split('\u0000') as [string, string, string];
      if (rowOrg !== orgId) continue;
      if (rowUser !== '' && rowUser !== userId) continue;
      records.push({
        provider,
        scope: rowUser === '' ? 'org' : 'user',
        credential: structuredClone(row.credential),
        updatedAt: row.updatedAt,
      });
    }
    return records;
  }

  async resolveCredential(orgId: string, userId: string, provider: string): Promise<ResolvedCredential | undefined> {
    const userRow = this.#rows.get(this.#key({ orgId, userId }, provider));
    if (userRow) return { provider, scope: 'user', credential: structuredClone(userRow.credential) };
    const orgRow = this.#rows.get(this.#key({ orgId }, provider));
    if (orgRow) return { provider, scope: 'org', credential: structuredClone(orgRow.credential) };
    return undefined;
  }

  async refreshOAuth(
    tenant: CredentialTenant,
    provider: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
  ): Promise<OAuthCredential | undefined> {
    const key = this.#key(tenant, provider);
    const previous = this.#locks.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => {})
      .then(async () => {
        const row = this.#rows.get(key);
        if (!row || row.credential.type !== 'oauth') return undefined;
        const current = row.credential;
        // Re-check under the "lock": a chained refresh may have run already.
        if (!isOAuthCredentialExpired(current)) return structuredClone(current);
        const next = await refreshFn(structuredClone(current));
        this.#rows.set(key, { credential: structuredClone(next), updatedAt: new Date() });
        return next;
      });
    this.#locks.set(key, run);
    return run;
  }

  async createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRow> {
    const row: LoginSessionRow = {
      sessionId: input.sessionId,
      orgId: input.orgId,
      userId: input.userId,
      provider: input.provider,
      kind: input.kind,
      pending: structuredClone(input.pending),
      expiresAt: input.expiresAt,
      nextPollAt: input.nextPollAt ?? null,
      createdAt: new Date(),
    };
    this.#sessions.set(row.sessionId, row);
    return structuredClone(row);
  }

  async getLoginSession(sessionId: string): Promise<LoginSessionRow | undefined> {
    const row = this.#sessions.get(sessionId);
    if (!row) return undefined;
    if (row.expiresAt.getTime() <= Date.now()) {
      this.#sessions.delete(sessionId);
      return undefined;
    }
    return structuredClone(row);
  }

  async claimLoginSession(
    sessionId: string,
    owner: Pick<LoginSessionRow, 'orgId' | 'userId' | 'provider' | 'kind'>,
  ): Promise<LoginSessionRow | undefined> {
    const row = this.#sessions.get(sessionId);
    const now = Date.now();
    if (!row || row.expiresAt.getTime() <= now) {
      if (row) this.#sessions.delete(sessionId);
      return undefined;
    }
    if (
      row.orgId !== owner.orgId ||
      row.userId !== owner.userId ||
      row.provider !== owner.provider ||
      row.kind !== owner.kind ||
      (row.nextPollAt !== null && row.nextPollAt.getTime() > now)
    ) {
      return undefined;
    }
    row.nextPollAt = row.expiresAt;
    return structuredClone(row);
  }

  async touchLoginSession(
    sessionId: string,
    updates: { pending?: Record<string, unknown>; nextPollAt?: Date | null },
  ): Promise<void> {
    const row = this.#sessions.get(sessionId);
    if (!row) return;
    if (updates.pending !== undefined) row.pending = structuredClone(updates.pending);
    if (updates.nextPollAt !== undefined) row.nextPollAt = updates.nextPollAt;
  }

  async deleteLoginSession(sessionId: string): Promise<void> {
    this.#sessions.delete(sessionId);
  }
}
