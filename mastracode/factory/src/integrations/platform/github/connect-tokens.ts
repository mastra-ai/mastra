import type { ConnectClient, ConnectionCredential } from '@mastra/connect';

/** Connect provider holding a Factory user's own GitHub token (`resourceId` = the user id). */
export const FACTORY_GITHUB_USER_PROVIDER_KEY = 'factory-github-user';

/** A token is reused until this long before it expires. */
const EXPIRY_SKEW_MS = 60_000;
/** A credential without an expiry is reused for at most this long. */
const UNDATED_TOKEN_TTL_MS = 10 * 60_000;
/** How long "this user has no GitHub connection" is remembered. */
const NO_USER_CONNECTION_TTL_MS = 60_000;

export interface GithubUserToken {
  connectionId: string;
  token: string;
}

type Cached<T> = { value: T; expiresAt: number };

/** Thrown when a Connect credential is not the OAuth token a GitHub connection must hold. */
export class GithubConnectCredentialError extends Error {
  constructor(connectionId: string, type: string) {
    super(`GitHub connection ${connectionId} returned a ${type} credential, not an OAuth token.`);
    this.name = 'GithubConnectCredentialError';
  }
}

/**
 * GitHub tokens read through Connect: the Mastra Factory apps' installation
 * tokens, by connection, and each Factory user's own token. Tokens are cached
 * until shortly before they expire; a caller that sees GitHub reject one
 * invalidates it and asks again.
 */
export class GithubConnectTokens {
  readonly #connect: ConnectClient;
  readonly #now: () => number;
  readonly #installations = new Map<string, Cached<string>>();
  readonly #users = new Map<string, Cached<GithubUserToken | null>>();
  readonly #inflight = new Map<string, Promise<unknown>>();

  constructor(connect: ConnectClient, options: { now?: () => number } = {}) {
    this.#connect = connect;
    this.#now = options.now ?? Date.now;
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

  /** The user's own GitHub token, or null when they have no active `factory-github-user` connection. */
  userToken(userId: string): Promise<GithubUserToken | null> {
    const cached = this.#users.get(userId);
    if (cached && cached.expiresAt > this.#now()) return Promise.resolve(cached.value);
    return this.#once(`user:${userId}`, async () => {
      const scoped = this.#connect.withResource(userId);
      const connection = (await scoped.listConnections({ providerKeys: [FACTORY_GITHUB_USER_PROVIDER_KEY] })).find(
        candidate => candidate.status === 'active' && candidate.resourceId === userId,
      );
      if (!connection) {
        this.#users.set(userId, { value: null, expiresAt: this.#now() + NO_USER_CONNECTION_TTL_MS });
        return null;
      }
      const { token, expiresAt } = this.#oauth(connection.id, await scoped.getCredential(connection.id));
      const value = { connectionId: connection.id, token };
      this.#users.set(userId, { value, expiresAt });
      return value;
    });
  }

  invalidateUser(userId: string): void {
    this.#users.delete(userId);
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
