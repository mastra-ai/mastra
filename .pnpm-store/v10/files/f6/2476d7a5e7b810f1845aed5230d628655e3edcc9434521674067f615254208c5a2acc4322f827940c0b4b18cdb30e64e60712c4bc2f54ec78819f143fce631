/**
 * Header providers for LanceDB remote connections.
 *
 * This module provides a flexible header management framework for LanceDB remote
 * connections, allowing users to implement custom header strategies for
 * authentication, request tracking, custom metadata, or any other header-based
 * requirements.
 *
 * @module header
 */
/**
 * Abstract base class for providing custom headers for each request.
 *
 * Users can implement this interface to provide dynamic headers for various purposes
 * such as authentication (OAuth tokens, API keys), request tracking (correlation IDs),
 * custom metadata, or any other header-based requirements. The provider is called
 * before each request to ensure fresh header values are always used.
 *
 * @example
 * Simple JWT token provider:
 * ```typescript
 * class JWTProvider extends HeaderProvider {
 *   constructor(private token: string) {
 *     super();
 *   }
 *
 *   getHeaders(): Record<string, string> {
 *     return { authorization: `Bearer ${this.token}` };
 *   }
 * }
 * ```
 *
 * @example
 * Provider with request tracking:
 * ```typescript
 * class RequestTrackingProvider extends HeaderProvider {
 *   constructor(private sessionId: string) {
 *     super();
 *   }
 *
 *   getHeaders(): Record<string, string> {
 *     return {
 *       "X-Session-Id": this.sessionId,
 *       "X-Request-Id": `req-${Date.now()}`
 *     };
 *   }
 * }
 * ```
 */
export declare abstract class HeaderProvider {
    /**
     * Get the latest headers to be added to requests.
     *
     * This method is called before each request to the remote LanceDB server.
     * Implementations should return headers that will be merged with existing headers.
     *
     * @returns Dictionary of header names to values to add to the request.
     * @throws If unable to fetch headers, the exception will be propagated and the request will fail.
     */
    abstract getHeaders(): Record<string, string>;
}
/**
 * Example implementation: A simple header provider that returns static headers.
 *
 * This is an example implementation showing how to create a HeaderProvider
 * for cases where headers don't change during the session.
 *
 * @example
 * ```typescript
 * const provider = new StaticHeaderProvider({
 *   authorization: "Bearer my-token",
 *   "X-Custom-Header": "custom-value"
 * });
 * const headers = provider.getHeaders();
 * // Returns: {authorization: 'Bearer my-token', 'X-Custom-Header': 'custom-value'}
 * ```
 */
export declare class StaticHeaderProvider extends HeaderProvider {
    private _headers;
    /**
     * Initialize with static headers.
     * @param headers - Headers to return for every request.
     */
    constructor(headers: Record<string, string>);
    /**
     * Return the static headers.
     * @returns Copy of the static headers.
     */
    getHeaders(): Record<string, string>;
}
/**
 * Token response from OAuth provider.
 * @public
 */
export interface TokenResponse {
    accessToken: string;
    expiresIn?: number;
}
/**
 * Example implementation: OAuth token provider with automatic refresh.
 *
 * This is an example implementation showing how to manage OAuth tokens
 * with automatic refresh when they expire.
 *
 * @example
 * ```typescript
 * async function fetchToken(): Promise<TokenResponse> {
 *   const response = await fetch("https://oauth.example.com/token", {
 *     method: "POST",
 *     body: JSON.stringify({
 *       grant_type: "client_credentials",
 *       client_id: "your-client-id",
 *       client_secret: "your-client-secret"
 *     }),
 *     headers: { "Content-Type": "application/json" }
 *   });
 *   const data = await response.json();
 *   return {
 *     accessToken: data.access_token,
 *     expiresIn: data.expires_in
 *   };
 * }
 *
 * const provider = new OAuthHeaderProvider(fetchToken);
 * const headers = provider.getHeaders();
 * // Returns: {"authorization": "Bearer <your-token>"}
 * ```
 */
export declare class OAuthHeaderProvider extends HeaderProvider {
    private _tokenFetcher;
    private _refreshBufferSeconds;
    private _currentToken;
    private _tokenExpiresAt;
    private _refreshPromise;
    /**
     * Initialize the OAuth provider.
     * @param tokenFetcher - Function to fetch new tokens. Should return object with 'accessToken' and optionally 'expiresIn'.
     * @param refreshBufferSeconds - Seconds before expiry to refresh token. Default 300 (5 minutes).
     */
    constructor(tokenFetcher: () => Promise<TokenResponse> | TokenResponse, refreshBufferSeconds?: number);
    /**
     * Check if token needs refresh.
     */
    private _needsRefresh;
    /**
     * Refresh the token if it's expired or close to expiring.
     */
    private _refreshTokenIfNeeded;
    /**
     * Get OAuth headers, refreshing token if needed.
     * Note: This is synchronous for now as the Rust implementation expects sync.
     * In a real implementation, this would need to handle async properly.
     * @returns Headers with Bearer token authorization.
     * @throws If unable to fetch or refresh token.
     */
    getHeaders(): Record<string, string>;
    /**
     * Manually refresh the token.
     * Call this before using getHeaders() to ensure token is available.
     */
    refreshToken(): Promise<void>;
}
