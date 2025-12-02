import { TokenVerificationError } from '../errors';
import type { AuthenticateContext } from './authenticateContext';
import type { SignedInState, SignedOutState } from './authStatus';
import type { OrganizationMatcher } from './organizationMatcher';
import type { OrganizationSyncOptions } from './types';
import type { VerifyTokenOptions } from './verify';
/**
 * Similar to our verifyToken flow for Clerk-issued JWTs, but this verification flow is for our signed handshake payload.
 * The handshake payload requires fewer verification steps.
 */
export declare function verifyHandshakeToken(token: string, options: VerifyTokenOptions): Promise<{
    handshake: string[];
}>;
export declare class HandshakeService {
    private readonly authenticateContext;
    private readonly organizationMatcher;
    private readonly options;
    constructor(authenticateContext: AuthenticateContext, options: {
        organizationSyncOptions?: OrganizationSyncOptions;
    }, organizationMatcher: OrganizationMatcher);
    /**
     * Determines if a request is eligible for handshake based on its headers
     *
     * Currently, a request is only eligible for a handshake if we can say it's *probably* a request for a document, not a fetch or some other exotic request.
     * This heuristic should give us a reliable enough signal for browsers that support `Sec-Fetch-Dest` and for those that don't.
     *
     * @returns boolean indicating if the request is eligible for handshake
     */
    isRequestEligibleForHandshake(): boolean;
    /**
     * Builds the redirect headers for a handshake request
     * @param reason - The reason for the handshake (e.g. 'session-token-expired')
     * @returns Headers object containing the Location header for redirect
     * @throws Error if clerkUrl is missing in authenticateContext
     */
    buildRedirectToHandshake(reason: string): Headers;
    /**
     * Gets cookies from either a handshake nonce or a handshake token
     * @returns Promise resolving to string array of cookie directives
     */
    getCookiesFromHandshake(): Promise<string[]>;
    /**
     * Resolves a handshake request by verifying the handshake token and setting appropriate cookies
     * @returns Promise resolving to either a SignedInState or SignedOutState
     * @throws Error if handshake verification fails or if there are issues with the session token
     */
    resolveHandshake(): Promise<SignedInState | SignedOutState>;
    /**
     * Handles handshake token verification errors in development mode
     * @param error - The TokenVerificationError that occurred
     * @throws Error with a descriptive message about the verification failure
     */
    handleTokenVerificationErrorInDevelopment(error: TokenVerificationError): void;
    /**
     * Checks if a redirect loop is detected and sets headers to track redirect count
     * @param headers - The Headers object to modify
     * @returns boolean indicating if a redirect loop was detected (true) or if the request can proceed (false)
     */
    checkAndTrackRedirectLoop(headers: Headers): boolean;
    private removeDevBrowserFromURL;
    private getOrganizationSyncTarget;
    private getOrganizationSyncQueryParams;
}
//# sourceMappingURL=handshake.d.ts.map