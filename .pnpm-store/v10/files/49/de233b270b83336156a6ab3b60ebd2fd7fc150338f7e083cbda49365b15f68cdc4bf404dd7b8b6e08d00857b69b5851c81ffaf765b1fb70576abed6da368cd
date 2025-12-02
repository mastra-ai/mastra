import { Logger } from "../logging.js";
import { LocalSyncState } from "./local_state.js";
import { AuthError, IdentityVersion, Transition } from "./protocol.js";
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
 * Handles the state transitions for auth. The server is the source
 * of truth.
 */
export declare class AuthenticationManager {
    private authState;
    private configVersion;
    private readonly syncState;
    private readonly authenticate;
    private readonly stopSocket;
    private readonly tryRestartSocket;
    private readonly pauseSocket;
    private readonly resumeSocket;
    private readonly clearAuth;
    private readonly logger;
    private readonly refreshTokenLeewaySeconds;
    private tokenConfirmationAttempts;
    constructor(syncState: LocalSyncState, callbacks: {
        authenticate: (token: string) => IdentityVersion;
        stopSocket: () => Promise<void>;
        tryRestartSocket: () => void;
        pauseSocket: () => void;
        resumeSocket: () => void;
        clearAuth: () => void;
    }, config: {
        refreshTokenLeewaySeconds: number;
        logger: Logger;
    });
    setConfig(fetchToken: AuthTokenFetcher, onChange: (isAuthenticated: boolean) => void): Promise<void>;
    onTransition(serverMessage: Transition): void;
    onAuthError(serverMessage: AuthError): void;
    private tryToReauthenticate;
    private refetchToken;
    private scheduleTokenRefetch;
    private fetchTokenAndGuardAgainstRace;
    stop(): void;
    private setAndReportAuthFailed;
    private resetAuthState;
    private setAuthState;
    private decodeToken;
    private _logVerbose;
}
//# sourceMappingURL=authentication_manager.d.ts.map