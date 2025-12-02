import { OAuthClientMetadata, OAuthClientInformation, OAuthTokens, OAuthMetadata, OAuthClientInformationFull, OAuthProtectedResourceMetadata, AuthorizationServerMetadata } from '../shared/auth.js';
import { OAuthError } from '../server/auth/errors.js';
import { FetchLike } from '../shared/transport.js';
/**
 * Implements an end-to-end OAuth client to be used with one MCP server.
 *
 * This client relies upon a concept of an authorized "session," the exact
 * meaning of which is application-defined. Tokens, authorization codes, and
 * code verifiers should not cross different sessions.
 */
export interface OAuthClientProvider {
    /**
     * The URL to redirect the user agent to after authorization.
     */
    get redirectUrl(): string | URL;
    /**
     * Metadata about this OAuth client.
     */
    get clientMetadata(): OAuthClientMetadata;
    /**
     * Returns a OAuth2 state parameter.
     */
    state?(): string | Promise<string>;
    /**
     * Loads information about this OAuth client, as registered already with the
     * server, or returns `undefined` if the client is not registered with the
     * server.
     */
    clientInformation(): OAuthClientInformation | undefined | Promise<OAuthClientInformation | undefined>;
    /**
     * If implemented, this permits the OAuth client to dynamically register with
     * the server. Client information saved this way should later be read via
     * `clientInformation()`.
     *
     * This method is not required to be implemented if client information is
     * statically known (e.g., pre-registered).
     */
    saveClientInformation?(clientInformation: OAuthClientInformationFull): void | Promise<void>;
    /**
     * Loads any existing OAuth tokens for the current session, or returns
     * `undefined` if there are no saved tokens.
     */
    tokens(): OAuthTokens | undefined | Promise<OAuthTokens | undefined>;
    /**
     * Stores new OAuth tokens for the current session, after a successful
     * authorization.
     */
    saveTokens(tokens: OAuthTokens): void | Promise<void>;
    /**
     * Invoked to redirect the user agent to the given URL to begin the authorization flow.
     */
    redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;
    /**
     * Saves a PKCE code verifier for the current session, before redirecting to
     * the authorization flow.
     */
    saveCodeVerifier(codeVerifier: string): void | Promise<void>;
    /**
     * Loads the PKCE code verifier for the current session, necessary to validate
     * the authorization result.
     */
    codeVerifier(): string | Promise<string>;
    /**
     * Adds custom client authentication to OAuth token requests.
     *
     * This optional method allows implementations to customize how client credentials
     * are included in token exchange and refresh requests. When provided, this method
     * is called instead of the default authentication logic, giving full control over
     * the authentication mechanism.
     *
     * Common use cases include:
     * - Supporting authentication methods beyond the standard OAuth 2.0 methods
     * - Adding custom headers for proprietary authentication schemes
     * - Implementing client assertion-based authentication (e.g., JWT bearer tokens)
     *
     * @param headers - The request headers (can be modified to add authentication)
     * @param params - The request body parameters (can be modified to add credentials)
     * @param url - The token endpoint URL being called
     * @param metadata - Optional OAuth metadata for the server, which may include supported authentication methods
     */
    addClientAuthentication?(headers: Headers, params: URLSearchParams, url: string | URL, metadata?: AuthorizationServerMetadata): void | Promise<void>;
    /**
     * If defined, overrides the selection and validation of the
     * RFC 8707 Resource Indicator. If left undefined, default
     * validation behavior will be used.
     *
     * Implementations must verify the returned resource matches the MCP server.
     */
    validateResourceURL?(serverUrl: string | URL, resource?: string): Promise<URL | undefined>;
    /**
     * If implemented, provides a way for the client to invalidate (e.g. delete) the specified
     * credentials, in the case where the server has indicated that they are no longer valid.
     * This avoids requiring the user to intervene manually.
     */
    invalidateCredentials?(scope: 'all' | 'client' | 'tokens' | 'verifier'): void | Promise<void>;
}
export type AuthResult = 'AUTHORIZED' | 'REDIRECT';
export declare class UnauthorizedError extends Error {
    constructor(message?: string);
}
/**
 * Parses an OAuth error response from a string or Response object.
 *
 * If the input is a standard OAuth2.0 error response, it will be parsed according to the spec
 * and an instance of the appropriate OAuthError subclass will be returned.
 * If parsing fails, it falls back to a generic ServerError that includes
 * the response status (if available) and original content.
 *
 * @param input - A Response object or string containing the error response
 * @returns A Promise that resolves to an OAuthError instance
 */
export declare function parseErrorResponse(input: Response | string): Promise<OAuthError>;
/**
 * Orchestrates the full auth flow with a server.
 *
 * This can be used as a single entry point for all authorization functionality,
 * instead of linking together the other lower-level functions in this module.
 */
export declare function auth(provider: OAuthClientProvider, options: {
    serverUrl: string | URL;
    authorizationCode?: string;
    scope?: string;
    resourceMetadataUrl?: URL;
    fetchFn?: FetchLike;
}): Promise<AuthResult>;
export declare function selectResourceURL(serverUrl: string | URL, provider: OAuthClientProvider, resourceMetadata?: OAuthProtectedResourceMetadata): Promise<URL | undefined>;
/**
 * Extract resource_metadata from response header.
 */
export declare function extractResourceMetadataUrl(res: Response): URL | undefined;
/**
 * Looks up RFC 9728 OAuth 2.0 Protected Resource Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 */
export declare function discoverOAuthProtectedResourceMetadata(serverUrl: string | URL, opts?: {
    protocolVersion?: string;
    resourceMetadataUrl?: string | URL;
}, fetchFn?: FetchLike): Promise<OAuthProtectedResourceMetadata>;
/**
 * Looks up RFC 8414 OAuth 2.0 Authorization Server Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 *
 * @deprecated This function is deprecated in favor of `discoverAuthorizationServerMetadata`.
 */
export declare function discoverOAuthMetadata(issuer: string | URL, { authorizationServerUrl, protocolVersion }?: {
    authorizationServerUrl?: string | URL;
    protocolVersion?: string;
}, fetchFn?: FetchLike): Promise<OAuthMetadata | undefined>;
/**
 * Builds a list of discovery URLs to try for authorization server metadata.
 * URLs are returned in priority order:
 * 1. OAuth metadata at the given URL
 * 2. OAuth metadata at root (if URL has path)
 * 3. OIDC metadata endpoints
 */
export declare function buildDiscoveryUrls(authorizationServerUrl: string | URL): {
    url: URL;
    type: 'oauth' | 'oidc';
}[];
/**
 * Discovers authorization server metadata with support for RFC 8414 OAuth 2.0 Authorization Server Metadata
 * and OpenID Connect Discovery 1.0 specifications.
 *
 * This function implements a fallback strategy for authorization server discovery:
 * 1. Attempts RFC 8414 OAuth metadata discovery first
 * 2. If OAuth discovery fails, falls back to OpenID Connect Discovery
 *
 * @param authorizationServerUrl - The authorization server URL obtained from the MCP Server's
 *                                 protected resource metadata, or the MCP server's URL if the
 *                                 metadata was not found.
 * @param options - Configuration options
 * @param options.fetchFn - Optional fetch function for making HTTP requests, defaults to global fetch
 * @param options.protocolVersion - MCP protocol version to use, defaults to LATEST_PROTOCOL_VERSION
 * @returns Promise resolving to authorization server metadata, or undefined if discovery fails
 */
export declare function discoverAuthorizationServerMetadata(authorizationServerUrl: string | URL, { fetchFn, protocolVersion }?: {
    fetchFn?: FetchLike;
    protocolVersion?: string;
}): Promise<AuthorizationServerMetadata | undefined>;
/**
 * Begins the authorization flow with the given server, by generating a PKCE challenge and constructing the authorization URL.
 */
export declare function startAuthorization(authorizationServerUrl: string | URL, { metadata, clientInformation, redirectUrl, scope, state, resource }: {
    metadata?: AuthorizationServerMetadata;
    clientInformation: OAuthClientInformation;
    redirectUrl: string | URL;
    scope?: string;
    state?: string;
    resource?: URL;
}): Promise<{
    authorizationUrl: URL;
    codeVerifier: string;
}>;
/**
 * Exchanges an authorization code for an access token with the given server.
 *
 * Supports multiple client authentication methods as specified in OAuth 2.1:
 * - Automatically selects the best authentication method based on server support
 * - Falls back to appropriate defaults when server metadata is unavailable
 *
 * @param authorizationServerUrl - The authorization server's base URL
 * @param options - Configuration object containing client info, auth code, etc.
 * @returns Promise resolving to OAuth tokens
 * @throws {Error} When token exchange fails or authentication is invalid
 */
export declare function exchangeAuthorization(authorizationServerUrl: string | URL, { metadata, clientInformation, authorizationCode, codeVerifier, redirectUri, resource, addClientAuthentication, fetchFn }: {
    metadata?: AuthorizationServerMetadata;
    clientInformation: OAuthClientInformation;
    authorizationCode: string;
    codeVerifier: string;
    redirectUri: string | URL;
    resource?: URL;
    addClientAuthentication?: OAuthClientProvider['addClientAuthentication'];
    fetchFn?: FetchLike;
}): Promise<OAuthTokens>;
/**
 * Exchange a refresh token for an updated access token.
 *
 * Supports multiple client authentication methods as specified in OAuth 2.1:
 * - Automatically selects the best authentication method based on server support
 * - Preserves the original refresh token if a new one is not returned
 *
 * @param authorizationServerUrl - The authorization server's base URL
 * @param options - Configuration object containing client info, refresh token, etc.
 * @returns Promise resolving to OAuth tokens (preserves original refresh_token if not replaced)
 * @throws {Error} When token refresh fails or authentication is invalid
 */
export declare function refreshAuthorization(authorizationServerUrl: string | URL, { metadata, clientInformation, refreshToken, resource, addClientAuthentication, fetchFn }: {
    metadata?: AuthorizationServerMetadata;
    clientInformation: OAuthClientInformation;
    refreshToken: string;
    resource?: URL;
    addClientAuthentication?: OAuthClientProvider['addClientAuthentication'];
    fetchFn?: FetchLike;
}): Promise<OAuthTokens>;
/**
 * Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
 */
export declare function registerClient(authorizationServerUrl: string | URL, { metadata, clientMetadata, fetchFn }: {
    metadata?: AuthorizationServerMetadata;
    clientMetadata: OAuthClientMetadata;
    fetchFn?: FetchLike;
}): Promise<OAuthClientInformationFull>;
//# sourceMappingURL=auth.d.ts.map