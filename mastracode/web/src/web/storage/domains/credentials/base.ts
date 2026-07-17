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

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

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

/**
 * Abstract model-credentials storage. Backends own their DDL in `init()`;
 * query methods are the typed surface the provider OAuth/key routes and the
 * per-tenant credential resolver consume.
 */
export abstract class ModelCredentialsStorage implements FactoryStorageDomain {
  readonly name = 'model-credentials';

  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /** Read the tenant's credential for a provider at exactly that scope. */
  abstract getCredential(tenant: CredentialTenant, provider: string): Promise<AuthCredential | undefined>;

  /** Upsert the tenant's credential for a provider at exactly that scope. */
  abstract setCredential(tenant: CredentialTenant, provider: string, credential: AuthCredential): Promise<void>;

  /** Delete the tenant's credential at exactly that scope. True when a row was removed. */
  abstract removeCredential(tenant: CredentialTenant, provider: string): Promise<boolean>;

  /** All credentials visible to a user: their own rows plus the org's shared rows. */
  abstract listCredentials(orgId: string, userId: string): Promise<CredentialRecord[]>;

  /**
   * Resolve the credential a caller should use for a provider: the user's own
   * row wins over the org's shared row.
   */
  abstract resolveCredential(orgId: string, userId: string, provider: string): Promise<ResolvedCredential | undefined>;

  /**
   * Refresh the tenant's OAuth credential under a lock so concurrent replicas
   * don't invalidate each other's rotating refresh tokens. After acquiring
   * the lock the expiry is re-checked — another replica may have refreshed
   * already, in which case `refreshFn` is skipped and the fresh credential is
   * returned. Returns `undefined` when no OAuth row exists for the tenant.
   */
  abstract refreshOAuth(
    tenant: CredentialTenant,
    provider: string,
    refreshFn: (current: OAuthCredential) => Promise<OAuthCredential>,
  ): Promise<OAuthCredential | undefined>;

  /** Persist a pending login flow started by a web route. */
  abstract createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRow>;

  /**
   * Read a pending login flow. Expired sessions are deleted on read (TTL
   * cleanup) and reported as absent.
   */
  abstract getLoginSession(sessionId: string): Promise<LoginSessionRow | undefined>;

  /**
   * Atomically claim a due login session for one upstream completion/poll attempt.
   * Returns undefined when the session is missing, expired, owned by another
   * tenant/provider, or already claimed by a concurrent request.
   */
  abstract claimLoginSession(
    sessionId: string,
    owner: Pick<LoginSessionRow, 'orgId' | 'userId' | 'provider' | 'kind'>,
  ): Promise<LoginSessionRow | undefined>;

  /** Update a pending flow's serialized state and/or next allowed poll time. */
  abstract touchLoginSession(
    sessionId: string,
    updates: { pending?: Record<string, unknown>; nextPollAt?: Date | null },
  ): Promise<void>;

  /** Remove a pending login flow (completed, cancelled, or failed). */
  abstract deleteLoginSession(sessionId: string): Promise<void>;
}
