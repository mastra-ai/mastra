import type { ClerkRequest } from './clerkRequest';
import type { AuthenticateRequestOptions } from './types';
interface AuthenticateContext extends AuthenticateRequestOptions {
    sessionTokenInHeader: string | undefined;
    origin: string | undefined;
    host: string | undefined;
    forwardedHost: string | undefined;
    forwardedProto: string | undefined;
    referrer: string | undefined;
    userAgent: string | undefined;
    secFetchDest: string | undefined;
    accept: string | undefined;
    sessionTokenInCookie: string | undefined;
    refreshTokenInCookie: string | undefined;
    clientUat: number;
    devBrowserToken: string | undefined;
    handshakeNonce: string | undefined;
    handshakeToken: string | undefined;
    handshakeRedirectLoopCounter: number;
    clerkUrl: URL;
    publishableKey: string;
    instanceType: string;
    frontendApi: string;
}
/**
 * All data required to authenticate a request.
 * This is the data we use to decide whether a request
 * is in a signed in or signed out state or if we need
 * to perform a handshake.
 */
declare class AuthenticateContext implements AuthenticateContext {
    private cookieSuffix;
    private clerkRequest;
    /**
     * Retrieves the session token from either the cookie or the header.
     *
     * @returns {string | undefined} The session token if available, otherwise undefined.
     */
    get sessionToken(): string | undefined;
    constructor(cookieSuffix: string, clerkRequest: ClerkRequest, options: AuthenticateRequestOptions);
    usesSuffixedCookies(): boolean;
    private initPublishableKeyValues;
    private initHeaderValues;
    private initCookieValues;
    private initHandshakeValues;
    private getQueryParam;
    private getHeader;
    private getCookie;
    private getSuffixedCookie;
    private getSuffixedOrUnSuffixedCookie;
    private parseAuthorizationHeader;
    private tokenHasIssuer;
    private tokenBelongsToInstance;
    private sessionExpired;
}
export type { AuthenticateContext };
export declare const createAuthenticateContext: (clerkRequest: ClerkRequest, options: AuthenticateRequestOptions) => Promise<AuthenticateContext>;
//# sourceMappingURL=authenticateContext.d.ts.map