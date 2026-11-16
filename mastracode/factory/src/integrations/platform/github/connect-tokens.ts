import type { ConnectClient, ConnectionCredential } from '@mastra/connect';

import { FACTORY_GITHUB_PROVIDER_KEY } from './connect-events.js';

/** A token is reused until this long before it expires. */
const EXPIRY_SKEW_MS = 60_000;
/** A credential without an expiry is reused for at most this long. */
const UNDATED_TOKEN_TTL_MS = 10 * 60_000;
/** How long a user's pasted token, or their having no token, is remembered. */
const USER_LOOKUP_TTL_MS = 60_000;

export type GithubUserToken =
  { source: 'connection'; connectionId: string; token: string } | { source: 'pat'; token: string };

/** Reads the classic PAT a user pasted into Factory, or null. */
export type GithubUserPatSource = (orgId: string, userId: string) => Promise<string | null>;

type Cached<T> = { value: T; expiresAt: number };

/** Thrown when a Connect credential is not the OAuth token a GitHub connection must hold. */
export class GithubConnectCredentialError extends Error {
  constructor(connectionId: string, type: string) {
    super(`GitHub connection ${connectionId} returned a ${type} credential, not an OAuth token.`);
    this.name = 'GithubConnectCredentialError';
  }
}

/**
 * GitHub tokens for the Mastra Factory apps: their installation tokens, read
 * through Connect by connection, and each Factory user's own token. A user's
 * token comes from their end-user `factory-github` connection (`resourceId` =
 * their user id) when they have an active one, else from the PAT they pasted
 * into Factory. Tokens are cached
 * until shortly before they expire; a caller that sees GitHub reject one
 * invalidates it and asks again.
 */
export class GithubConnectTokens {
  readonly #connect: ConnectClient;
  readonly #now: () => number;
  readonly #userPat: GithubUserPatSource;
  readonly #installations = new Map<string, Cached<string>>();
  readonly #users = new Map<string, Cached<GithubUserToken | null>>();
  readonly #inflight = new Map<string, Promise<unknown>>();

  constructor(connect: ConnectClient, options: { now?: () => number; userPat?: GithubUserPatSource } = {}) {
    this.#connect = connect;
    this.#now = options.now ?? Date.now;
    this.#userPat = options.userPat ?? (async () => null);
  }

  installationToken(connectionId: string): Promise<string> {
    const cached = this.#installations.get(connectionId);
    if (cached && cached.expiresAt > this.#now()) return Promise.resolve(cached.value);
    return this.#once(`installation:${connectionId}`, async () => {
      const credential = await this.#connect.getCredential(connectionId);
      const { token, expiresAt } = this.#oauth(connectionId, credential);
      this.#installations.set(connectionId, { value: token, expiresAt });
      return token;
    });
  }

  invalidateInstallation(connectionId: string): void {
    this.#installations.delete(connectionId);
  }

  /** The user's own GitHub token in `orgId`, or null when they have neither a connection nor a PAT. */
  userToken(orgId: string, userId: string): Promise<GithubUserToken | null> {
    const key = userKey(orgId, userId);
    const cached = this.#users.get(key);
    if (cached && cached.expiresAt > this.#now()) return Promise.resolve(cached.value);
    return this.#once(`user:${key}`, async () => {
      const scoped = this.#connect.withResource(userId);
      const connection = (await scoped.listConnections({ providerKeys: [FACTORY_GITHUB_PROVIDER_KEY] })).find(
        candidate => candidate.status === 'active' && candidate.resourceId === userId,
      );
      if (connection) {
        const { token, expiresAt } = this.#oauth(connection.id, await scoped.getCredential(connection.id));
        const value: GithubUserToken = { source: 'connection', connectionId: connection.id, token };
        this.#users.set(key, { value, expiresAt });
        return value;
      }
      const pat = await this.#userPat(orgId, userId);
      const value: GithubUserToken | null = pat ? { source: 'pat', token: pat } : null;
      this.#users.set(key, { value, expiresAt: this.#now() + USER_LOOKUP_TTL_MS });
      return value;
    });
  }

  invalidateUser(orgId: string, userId: string): void {
    this.#users.delete(userKey(orgId, userId));
  }

  #oauth(connectionId: string, credential: ConnectionCredential): { token: string; expiresAt: number } {
    if (credential.type !== 'oauth2') throw new GithubConnectCredentialError(connectionId, credential.type);
    const expires = credential.expiresAt ? Date.parse(credential.expiresAt) : Number.NaN;
    return {
      token: credential.accessToken,
      expiresAt: Number.isFinite(expires) ? expires - EXPIRY_SKEW_MS : this.#now() + UNDATED_TOKEN_TTL_MS,
    };
  }

  #once<T>(key: string, load: () => Promise<T>): Promise<T> {
    const pending = this.#inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const promise = load().finally(() => this.#inflight.delete(key));
    this.#inflight.set(key, promise);
    return promise;
  }
}

function userKey(orgId: string, userId: string): string {
  return `${orgId}\u0000${userId}`;
}
