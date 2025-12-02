import { Logger } from "../logging.js";
import { LocalSyncState } from "./local_state.js";
import { AuthError, IdentityVersion, Transition } from "./protocol.js";
import { jwtDecode } from "../../vendor/jwt-decode/index.js";

// setTimout uses 32 bit integer, so it can only
// schedule about 24 days in the future.
const MAXIMUM_REFRESH_DELAY = 20 * 24 * 60 * 60 * 1000; // 20 days

const MAX_TOKEN_CONFIRMATION_ATTEMPTS = 2;

/**
 * An async function returning a JWT. Depending on the auth providers
 * configured in convex/auth.config.ts, this may be a JWT-encoded OpenID
 * Connect Identity Token or a traditional JWT.
 *
 * `forceRefreshToken` is `true` if the server rejected a previously
 * returned token or the token is anticipated to expiring soon
 * based on its `exp` time.
 *
 * See {@link ConvexReactClient.setAuth}.
 *
 * @public
 */
export type AuthTokenFetcher = (args: {
  forceRefreshToken: boolean;
}) => Promise<string | null | undefined>;

/**
 * What is provided to the client.
 */
type AuthConfig = {
  fetchToken: AuthTokenFetcher;
  onAuthChange: (isAuthenticated: boolean) => void;
};

/**
 * In general we take 3 steps:
 *   1. Fetch a possibly cached token
 *   2. Immediately fetch a fresh token without using a cache
 *   3. Repeat step 2 before the end of the fresh token's lifetime
 *
 * When we fetch without using a cache we know when the token
 * will expire, and can schedule refetching it.
 *
 * If we get an error before a scheduled refetch, we go back
 * to step 2.
 */
type AuthState =
  | { state: "noAuth" }
  | {
      state: "waitingForServerConfirmationOfCachedToken";
      config: AuthConfig;
      hasRetried: boolean;
    }
  | {
      state: "initialRefetch";
      config: AuthConfig;
    }
  | {
      state: "waitingForServerConfirmationOfFreshToken";
      config: AuthConfig;
      hadAuth: boolean;
      token: string;
    }
  | {
      state: "waitingForScheduledRefetch";
      config: AuthConfig;
      refetchTokenTimeoutId: ReturnType<typeof setTimeout>;
    }
  // Special/weird state when we got a valid token
  // but could not fetch a new one.
  | {
      state: "notRefetching";
      config: AuthConfig;
    };

/**
 * Handles the state transitions for auth. The server is the source
 * of truth.
 */
export class AuthenticationManager {
  private authState: AuthState = { state: "noAuth" };
  // Used to detect races involving `setConfig` calls
  // while a token is being fetched.
  private configVersion = 0;
  // Shared by the BaseClient so that the auth manager can easily inspect it
  private readonly syncState: LocalSyncState;
  // Passed down by BaseClient, sends a message to the server
  private readonly authenticate: (token: string) => IdentityVersion;
  private readonly stopSocket: () => Promise<void>;
  private readonly tryRestartSocket: () => void;
  private readonly pauseSocket: () => void;
  private readonly resumeSocket: () => void;
  // Passed down by BaseClient, sends a message to the server
  private readonly clearAuth: () => void;
  private readonly logger: Logger;
  private readonly refreshTokenLeewaySeconds: number;
  // Number of times we have attempted to confirm the latest token. We retry up
  // to `MAX_TOKEN_CONFIRMATION_ATTEMPTS` times.
  private tokenConfirmationAttempts = 0;
  constructor(
    syncState: LocalSyncState,
    callbacks: {
      authenticate: (token: string) => IdentityVersion;
      stopSocket: () => Promise<void>;
      tryRestartSocket: () => void;
      pauseSocket: () => void;
      resumeSocket: () => void;
      clearAuth: () => void;
    },
    config: {
      refreshTokenLeewaySeconds: number;
      logger: Logger;
    },
  ) {
    this.syncState = syncState;
    this.authenticate = callbacks.authenticate;
    this.stopSocket = callbacks.stopSocket;
    this.tryRestartSocket = callbacks.tryRestartSocket;
    this.pauseSocket = callbacks.pauseSocket;
    this.resumeSocket = callbacks.resumeSocket;
    this.clearAuth = callbacks.clearAuth;
    this.logger = config.logger;
    this.refreshTokenLeewaySeconds = config.refreshTokenLeewaySeconds;
  }

  async setConfig(
    fetchToken: AuthTokenFetcher,
    onChange: (isAuthenticated: boolean) => void,
  ) {
    this.resetAuthState();
    this._logVerbose("pausing WS for auth token fetch");
    this.pauseSocket();
    const token = await this.fetchTokenAndGuardAgainstRace(fetchToken, {
      forceRefreshToken: false,
    });
    if (token.isFromOutdatedConfig) {
      return;
    }
    if (token.value) {
      this.setAuthState({
        state: "waitingForServerConfirmationOfCachedToken",
        config: { fetchToken, onAuthChange: onChange },
        hasRetried: false,
      });
      this.authenticate(token.value);
    } else {
      this.setAuthState({
        state: "initialRefetch",
        config: { fetchToken, onAuthChange: onChange },
      });
      // Try again with `forceRefreshToken: true`
      await this.refetchToken();
    }
    this._logVerbose("resuming WS after auth token fetch");
    this.resumeSocket();
  }

  onTransition(serverMessage: Transition) {
    if (
      !this.syncState.isCurrentOrNewerAuthVersion(
        serverMessage.endVersion.identity,
      )
    ) {
      // This is a stale transition - client has moved on to
      // a newer auth version.
      return;
    }
    if (
      serverMessage.endVersion.identity <= serverMessage.startVersion.identity
    ) {
      // This transition did not change auth - it is not a response to Authenticate.
      return;
    }

    if (this.authState.state === "waitingForServerConfirmationOfCachedToken") {
      this._logVerbose("server confirmed auth token is valid");
      void this.refetchToken();
      this.authState.config.onAuthChange(true);
      return;
    }
    if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
      this._logVerbose("server confirmed new auth token is valid");
      this.scheduleTokenRefetch(this.authState.token);
      this.tokenConfirmationAttempts = 0;
      if (!this.authState.hadAuth) {
        this.authState.config.onAuthChange(true);
      }
    }
  }

  onAuthError(serverMessage: AuthError) {
    // If the AuthError is not due to updating the token, and we're currently
    // waiting on the result of a token update, ignore.
    if (
      serverMessage.authUpdateAttempted === false &&
      (this.authState.state === "waitingForServerConfirmationOfFreshToken" ||
        this.authState.state === "waitingForServerConfirmationOfCachedToken")
    ) {
      this._logVerbose("ignoring non-auth token expired error");
      return;
    }
    const { baseVersion } = serverMessage;
    // Versioned AuthErrors are ignored if the client advanced to
    // a newer auth identity
    // Error are reporting the previous version, since the server
    // didn't advance, hence `+ 1`.
    if (!this.syncState.isCurrentOrNewerAuthVersion(baseVersion + 1)) {
      this._logVerbose("ignoring auth error for previous auth attempt");
      return;
    }
    void this.tryToReauthenticate(serverMessage);
    return;
  }

  // This is similar to `refetchToken` defined below, in fact we
  // don't represent them as different states, but it is different
  // in that we pause the WebSocket so that mutations
  // don't retry with bad auth.
  private async tryToReauthenticate(serverMessage: AuthError) {
    this._logVerbose(`attempting to reauthenticate: ${serverMessage.error}`);
    if (
      // No way to fetch another token, kaboom
      this.authState.state === "noAuth" ||
      // We failed on a fresh token. After a small number of retries, we give up
      // and clear the auth state to avoid infinite retries.
      (this.authState.state === "waitingForServerConfirmationOfFreshToken" &&
        this.tokenConfirmationAttempts >= MAX_TOKEN_CONFIRMATION_ATTEMPTS)
    ) {
      this.logger.error(
        `Failed to authenticate: "${serverMessage.error}", check your server auth config`,
      );
      if (this.syncState.hasAuth()) {
        this.syncState.clearAuth();
      }
      if (this.authState.state !== "noAuth") {
        this.setAndReportAuthFailed(this.authState.config.onAuthChange);
      }
      return;
    }
    if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
      this.tokenConfirmationAttempts++;
      this._logVerbose(
        `retrying reauthentication, ${MAX_TOKEN_CONFIRMATION_ATTEMPTS - this.tokenConfirmationAttempts} attempts remaining`,
      );
    }

    await this.stopSocket();
    const token = await this.fetchTokenAndGuardAgainstRace(
      this.authState.config.fetchToken,
      {
        forceRefreshToken: true,
      },
    );
    if (token.isFromOutdatedConfig) {
      return;
    }

    if (token.value && this.syncState.isNewAuth(token.value)) {
      this.authenticate(token.value);
      this.setAuthState({
        state: "waitingForServerConfirmationOfFreshToken",
        config: this.authState.config,
        token: token.value,
        hadAuth:
          this.authState.state === "notRefetching" ||
          this.authState.state === "waitingForScheduledRefetch",
      });
    } else {
      this._logVerbose("reauthentication failed, could not fetch a new token");
      if (this.syncState.hasAuth()) {
        this.syncState.clearAuth();
      }
      this.setAndReportAuthFailed(this.authState.config.onAuthChange);
    }
    this.tryRestartSocket();
  }

  // Force refetch the token and schedule another refetch
  // before the token expires - an active client should never
  // need to reauthenticate.
  private async refetchToken() {
    if (this.authState.state === "noAuth") {
      return;
    }
    this._logVerbose("refetching auth token");
    const token = await this.fetchTokenAndGuardAgainstRace(
      this.authState.config.fetchToken,
      {
        forceRefreshToken: true,
      },
    );
    if (token.isFromOutdatedConfig) {
      return;
    }

    if (token.value) {
      if (this.syncState.isNewAuth(token.value)) {
        this.setAuthState({
          state: "waitingForServerConfirmationOfFreshToken",
          hadAuth: this.syncState.hasAuth(),
          token: token.value,
          config: this.authState.config,
        });
        this.authenticate(token.value);
      } else {
        this.setAuthState({
          state: "notRefetching",
          config: this.authState.config,
        });
      }
    } else {
      this._logVerbose("refetching token failed");
      if (this.syncState.hasAuth()) {
        this.clearAuth();
      }
      this.setAndReportAuthFailed(this.authState.config.onAuthChange);
    }
    // Restart in case this refetch was triggered via schedule during
    // a reauthentication attempt.
    this._logVerbose(
      "restarting WS after auth token fetch (if currently stopped)",
    );
    this.tryRestartSocket();
  }

  private scheduleTokenRefetch(token: string) {
    if (this.authState.state === "noAuth") {
      return;
    }
    const decodedToken = this.decodeToken(token);
    if (!decodedToken) {
      // This is no longer really possible, because
      // we wait on server response before scheduling token refetch,
      // and the server currently requires JWT tokens.
      this.logger.error(
        "Auth token is not a valid JWT, cannot refetch the token",
      );
      return;
    }
    // iat: issued at time, UTC seconds timestamp at which the JWT was issued
    // exp: expiration time, UTC seconds timestamp at which the JWT will expire
    const { iat, exp } = decodedToken as { iat?: number; exp?: number };
    if (!iat || !exp) {
      this.logger.error(
        "Auth token does not have required fields, cannot refetch the token",
      );
      return;
    }
    // Because the client and server clocks may be out of sync,
    // we only know that the token will expire after `exp - iat`,
    // and since we just fetched a fresh one we know when that
    // will happen.
    const tokenValiditySeconds = exp - iat;
    if (tokenValiditySeconds <= 2) {
      this.logger.error(
        "Auth token does not live long enough, cannot refetch the token",
      );
      return;
    }
    // Attempt to refresh the token `refreshTokenLeewaySeconds` before it expires,
    // or immediately if the token is already expiring soon.
    let delay = Math.min(
      MAXIMUM_REFRESH_DELAY,
      (tokenValiditySeconds - this.refreshTokenLeewaySeconds) * 1000,
    );
    if (delay <= 0) {
      // Refetch immediately, but this might be due to configuring a `refreshTokenLeewaySeconds`
      // that is too large compared to the token's actual lifetime.
      this.logger.warn(
        `Refetching auth token immediately, configured leeway ${this.refreshTokenLeewaySeconds}s is larger than the token's lifetime ${tokenValiditySeconds}s`,
      );
      delay = 0;
    }
    const refetchTokenTimeoutId = setTimeout(() => {
      this._logVerbose("running scheduled token refetch");
      void this.refetchToken();
    }, delay);
    this.setAuthState({
      state: "waitingForScheduledRefetch",
      refetchTokenTimeoutId,
      config: this.authState.config,
    });
    this._logVerbose(
      `scheduled preemptive auth token refetching in ${delay}ms`,
    );
  }

  // Protects against simultaneous calls to `setConfig`
  // while we're fetching a token
  private async fetchTokenAndGuardAgainstRace(
    fetchToken: AuthTokenFetcher,
    fetchArgs: {
      forceRefreshToken: boolean;
    },
  ) {
    const originalConfigVersion = ++this.configVersion;
    this._logVerbose(
      `fetching token with config version ${originalConfigVersion}`,
    );
    const token = await fetchToken(fetchArgs);
    if (this.configVersion !== originalConfigVersion) {
      // This is a stale config
      this._logVerbose(
        `stale config version, expected ${originalConfigVersion}, got ${this.configVersion}`,
      );
      return { isFromOutdatedConfig: true };
    }
    return { isFromOutdatedConfig: false, value: token };
  }

  stop() {
    this.resetAuthState();
    // Bump this in case we are mid-token-fetch when we get stopped
    this.configVersion++;
    this._logVerbose(`config version bumped to ${this.configVersion}`);
  }

  private setAndReportAuthFailed(
    onAuthChange: (authenticated: boolean) => void,
  ) {
    onAuthChange(false);
    this.resetAuthState();
  }

  private resetAuthState() {
    this.setAuthState({ state: "noAuth" });
  }

  private setAuthState(newAuth: AuthState) {
    const authStateForLog =
      newAuth.state === "waitingForServerConfirmationOfFreshToken"
        ? {
            hadAuth: newAuth.hadAuth,
            state: newAuth.state,
            token: `...${newAuth.token.slice(-7)}`,
          }
        : { state: newAuth.state };
    this._logVerbose(
      `setting auth state to ${JSON.stringify(authStateForLog)}`,
    );
    switch (newAuth.state) {
      case "waitingForScheduledRefetch":
      case "notRefetching":
      case "noAuth":
        this.tokenConfirmationAttempts = 0;
        break;
      case "waitingForServerConfirmationOfFreshToken":
      case "waitingForServerConfirmationOfCachedToken":
      case "initialRefetch":
        break;
      default: {
        newAuth satisfies never;
      }
    }
    if (this.authState.state === "waitingForScheduledRefetch") {
      clearTimeout(this.authState.refetchTokenTimeoutId);

      // The waitingForScheduledRefetch state is the most quiesced authed state.
      // Let the syncState know that auth is in a good state, so it can reset failure backoffs
      this.syncState.markAuthCompletion();
    }
    this.authState = newAuth;
  }

  private decodeToken(token: string) {
    try {
      return jwtDecode(token);
    } catch (e) {
      this._logVerbose(
        `Error decoding token: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
      return null;
    }
  }

  private _logVerbose(message: string) {
    this.logger.logVerbose(`${message} [v${this.configVersion}]`);
  }
}
