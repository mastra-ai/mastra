import type { SlackCredentialStorage, SlackUserCredentials } from './credential-storage';
import { FileSlackCredentialStorage } from './credential-storage';
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  parseAuthorizationInput,
  refreshUserToken,
  resolveSlackClientId,
  SlackRefreshTokenDeadError,
  startLoopbackServer,
} from './oauth';
import { generatePKCE, generateState } from './pkce';

/**
 * Default user-token scopes requested during connect. Enough for SlackSignals
 * to read subscribed conversations and resolve authors.
 */
export const DEFAULT_SLACK_USER_SCOPES: readonly string[] = [
  'channels:history',
  'groups:history',
  'im:history',
  'mpim:history',
  'users:read',
];

/** Refresh the access token this many ms before it expires. */
const DEFAULT_REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Thrown when no credentials exist yet — the user must run `connect()`. */
export class SlackAuthRequiredError extends Error {
  constructor() {
    super('Not connected to Slack. Run the connect flow (SlackUserAuth.connect) or supply a static token.');
    this.name = 'SlackAuthRequiredError';
  }
}

/**
 * Thrown when stored credentials can no longer be refreshed (dead refresh
 * token). The user must run `connect()` again.
 */
export class SlackAuthReconnectRequiredError extends Error {
  constructor(cause?: string) {
    super(`Slack connection expired and could not be refreshed${cause ? ` (${cause})` : ''}. Reconnect required.`);
    this.name = 'SlackAuthReconnectRequiredError';
  }
}

export interface SlackUserAuthOptions {
  /**
   * Static user token (`xoxp-…`). Bypasses OAuth, storage, and refresh
   * entirely — for headless/CI environments that manage tokens themselves.
   */
  token?: string;
  /**
   * OAuth client_id of a pre-existing Slack app configured as a PKCE public
   * client. Falls back to the `MASTRA_SLACK_CLIENT_ID` env var.
   */
  clientId?: string;
  /** User-token scopes to request during connect. */
  scopes?: string[];
  /** Credential persistence. Defaults to `~/.mastra/slack-auth.json` (0600). */
  storage?: SlackCredentialStorage;
  /** Refresh this many ms before `expiresAt`. Default 5 minutes. */
  refreshSkewMs?: number;
}

export interface SlackConnectCallbacks {
  /** Called with the authorize URL — open it in a browser or display it. */
  onAuthUrl: (url: string) => void | Promise<void>;
  /**
   * Fallback when the loopback callback never arrives (e.g. remote shell):
   * prompt the user to paste the redirect URL or code.
   */
  onManualCodeInput?: () => Promise<string>;
}

export interface SlackAuthStatus {
  connected: boolean;
  needsReconnect: boolean;
  teamId?: string;
  teamName?: string;
  userId?: string;
  expiresAt?: number;
}

/**
 * Manages a Slack **user-token** connection against a pre-existing Slack app.
 *
 * - `connect()` runs the PKCE loopback OAuth flow and persists credentials.
 * - `getToken()` returns a live access token, transparently refreshing it
 *   before expiry. Slack rotates the refresh token on every refresh, so each
 *   rotation is persisted atomically before the new token is handed out.
 * - When the refresh token dies, the stored credentials are flagged
 *   `needsReconnect` and `getToken()` throws {@link SlackAuthReconnectRequiredError}
 *   instead of surfacing raw `invalid_token` API errors.
 *
 * Distinct from `SlackProvider` (channels), which owns **bot-token**
 * credentials for apps it creates. This class authorizes a user account so
 * the caller can act as that user (read anything the user can see).
 */
export class SlackUserAuth {
  readonly #staticToken?: string;
  readonly #clientId?: string;
  readonly #scopes: string[];
  readonly #storage: SlackCredentialStorage;
  readonly #refreshSkewMs: number;

  /** In-flight refresh, shared so concurrent callers don't double-rotate. */
  #refreshPromise: Promise<SlackUserCredentials> | null = null;
  /** Cached userId for static-token mode (resolved via `auth.test`). */
  #staticTokenUserId?: string;

  constructor(options: SlackUserAuthOptions = {}) {
    this.#staticToken = options.token?.trim() || undefined;
    this.#clientId = options.clientId;
    this.#scopes = options.scopes ? [...options.scopes] : [...DEFAULT_SLACK_USER_SCOPES];
    this.#storage = options.storage ?? new FileSlackCredentialStorage();
    this.#refreshSkewMs = options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS;
  }

  /**
   * Run the PKCE loopback connect flow: build the authorize URL, wait for the
   * redirect (or manual paste), exchange the code, persist credentials.
   */
  async connect(callbacks: SlackConnectCallbacks): Promise<SlackUserCredentials> {
    const clientId = resolveSlackClientId(this.#clientId);
    if (!clientId) {
      throw new Error(
        'No Slack client_id available. Pass `clientId` (or set MASTRA_SLACK_CLIENT_ID) for a Slack app configured as a PKCE public client.',
      );
    }

    const state = generateState();
    const { verifier, challenge } = await generatePKCE();
    const server = await startLoopbackServer(state);

    const url = buildAuthorizeUrl({
      clientId,
      redirectUri: server.redirectUri,
      scopes: this.#scopes,
      challenge,
      state,
    });

    try {
      await callbacks.onAuthUrl(url);

      let code = await server.waitForCode();
      if (!code && callbacks.onManualCodeInput) {
        const parsed = parseAuthorizationInput(await callbacks.onManualCodeInput());
        if (parsed.state && parsed.state !== state) {
          throw new Error('State mismatch');
        }
        code = parsed.code ?? null;
      }
      if (!code) {
        throw new Error('Slack authorization did not complete (no authorization code received)');
      }

      const credentials = await exchangeAuthorizationCode({
        code,
        verifier,
        redirectUri: server.redirectUri,
        clientId,
      });
      await this.#storage.save(credentials);
      return credentials;
    } finally {
      server.close();
    }
  }

  /**
   * Get a live access token, refreshing (and persisting the rotation) when
   * the stored token is expired or within the refresh skew.
   */
  async getToken(): Promise<string> {
    if (this.#staticToken) return this.#staticToken;

    const credentials = await this.#storage.load();
    if (!credentials) throw new SlackAuthRequiredError();
    if (credentials.needsReconnect) throw new SlackAuthReconnectRequiredError();

    if (!this.#isExpiring(credentials)) return credentials.accessToken;

    // Token can't be refreshed (no rotation) — hand it out and let the API
    // call fail loudly if it's actually dead.
    if (!credentials.refreshToken) return credentials.accessToken;

    const refreshed = await this.#refreshAndPersist(credentials);
    return refreshed.accessToken;
  }

  /** The authed user's Slack id — used to skip the user's own messages. */
  async getUserId(): Promise<string | undefined> {
    if (this.#staticToken) {
      if (!this.#staticTokenUserId) {
        try {
          const response = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.#staticToken}` },
          });
          const json = (await response.json()) as { ok?: boolean; user_id?: string };
          if (json.ok && json.user_id) this.#staticTokenUserId = json.user_id;
        } catch {
          // best-effort; self-skip degrades gracefully without it
        }
      }
      return this.#staticTokenUserId;
    }
    const credentials = await this.#storage.load();
    return credentials?.userId;
  }

  /** Connection status for UIs/status commands. */
  async getStatus(): Promise<SlackAuthStatus> {
    if (this.#staticToken) {
      return { connected: true, needsReconnect: false };
    }
    const credentials = await this.#storage.load();
    if (!credentials) return { connected: false, needsReconnect: false };
    return {
      connected: !credentials.needsReconnect,
      needsReconnect: credentials.needsReconnect === true,
      teamId: credentials.teamId,
      teamName: credentials.teamName,
      userId: credentials.userId,
      expiresAt: credentials.expiresAt,
    };
  }

  /** Remove stored credentials. */
  async disconnect(): Promise<void> {
    await this.#storage.clear();
  }

  #isExpiring(credentials: SlackUserCredentials): boolean {
    if (!credentials.expiresAt) return false;
    return Date.now() >= credentials.expiresAt - this.#refreshSkewMs;
  }

  async #refreshAndPersist(credentials: SlackUserCredentials): Promise<SlackUserCredentials> {
    if (this.#refreshPromise) return this.#refreshPromise;

    this.#refreshPromise = (async () => {
      // Re-read storage first: another process sharing the credential file
      // may have already rotated (our refresh token would now be dead).
      const latest = (await this.#storage.load()) ?? credentials;
      if (latest.needsReconnect) throw new SlackAuthReconnectRequiredError();
      if (!this.#isExpiring(latest)) return latest;

      try {
        const refreshed = await refreshUserToken(latest);
        // Persist BEFORE returning — the old refresh token is single-use.
        await this.#storage.save(refreshed);
        return refreshed;
      } catch (error) {
        if (error instanceof SlackRefreshTokenDeadError) {
          await this.#storage.save({ ...latest, needsReconnect: true });
          throw new SlackAuthReconnectRequiredError(error.message);
        }
        throw error;
      }
    })().finally(() => {
      this.#refreshPromise = null;
    });

    return this.#refreshPromise;
  }
}
