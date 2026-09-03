/**
 * OAuth Client Provider Implementation for MCP Client
 *
 * Provides a ready-to-use OAuthClientProvider implementation that can be used
 * with Mastra's MCPClient for connecting to OAuth-protected MCP servers.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 */

import type {
  OAuthClientProvider,
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthClientInformationContext,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
  OAuthTokens,
} from '../shared/oauth-types.js';
import { validateClientMetadataUrl } from '../shared/oauth-types.js';

/**
 * Storage interface for persisting OAuth data.
 *
 * Implement this interface to persist OAuth data across sessions.
 * For simple in-memory usage, use InMemoryOAuthStorage.
 */
export interface OAuthStorage {
  /**
   * Store a value by key.
   */
  set(key: string, value: string): Promise<void> | void;

  /**
   * Retrieve a value by key.
   */
  get(key: string): Promise<string | undefined> | string | undefined;

  /**
   * Delete a value by key.
   */
  delete(key: string): Promise<void> | void;
}

/**
 * Simple in-memory OAuth storage.
 *
 * Data is lost when the process exits. For production, implement
 * OAuthStorage with a persistent store like Redis or a database.
 */
export class InMemoryOAuthStorage implements OAuthStorage {
  private data = new Map<string, string>();

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  get(key: string): string | undefined {
    return this.data.get(key);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

/**
 * Options for creating a MCPOAuthClientProvider.
 */
export interface MCPClientMetadata extends OAuthClientMetadata {
  /**
   * Required by a Client ID Metadata Document and must match its URL.
   * The provider strips this field from Dynamic Client Registration requests.
   */
  client_id?: string;
}

export interface MCPOAuthClientProviderOptions {
  /**
   * The redirect URL for the OAuth callback.
   * This should be a URL your application controls that can handle
   * the authorization code callback.
   *
   * @example 'http://localhost:3000/oauth/callback'
   */
  redirectUrl: string | URL;

  /**
   * OAuth client metadata published by the client metadata document or used
   * for dynamic client registration fallback. `client_id` is validated against
   * `clientMetadataUrl` and omitted from fallback registration requests.
   */
  clientMetadata: MCPClientMetadata;

  /**
   * HTTPS URL of this client's Client ID Metadata Document.
   *
   * When the authorization server supports metadata documents, this URL is
   * used as the client ID instead of dynamic client registration. It must have
   * a non-root path and exactly match `clientMetadata.client_id`.
   */
  clientMetadataUrl?: string;

  /**
   * Pre-registered client information.
   * If provided, skips dynamic client registration.
   */
  clientInformation?: OAuthClientInformation;

  /**
   * Storage for persisting OAuth data (tokens, client info, etc.).
   * Defaults to InMemoryOAuthStorage if not provided.
   */
  storage?: OAuthStorage;

  /**
   * Callback invoked when the user needs to be redirected to authorize.
   *
   * For CLI applications, you might open the URL in a browser.
   * For web applications, you might redirect the response.
   *
   * @param url - The authorization URL to redirect to
   */
  onRedirectToAuthorization?: (url: URL) => void | Promise<void>;

  /**
   * Generate a random state parameter for OAuth requests.
   * Defaults to using crypto.randomUUID.
   */
  stateGenerator?: () => string | Promise<string>;
}

/**
 * Mastra's OAuth Client Provider implementation.
 *
 * This provider handles the OAuth 2.1 flow for connecting to OAuth-protected
 * MCP servers, including:
 * - Client ID Metadata Documents (preferred)
 * - Dynamic client registration fallback (deprecated by MCP 2026-07-28)
 * - PKCE (Proof Key for Code Exchange)
 * - Token storage and refresh
 *
 * @example
 * ```typescript
 * import { MCPClient, MCPOAuthClientProvider, InMemoryOAuthStorage } from '@mastra/mcp';
 *
 * // Create the OAuth provider
 * const oauthProvider = new MCPOAuthClientProvider({
 *   redirectUrl: 'http://localhost:3000/oauth/callback',
 *   clientMetadata: {
 *     redirect_uris: ['http://localhost:3000/oauth/callback'],
 *     client_name: 'My MCP Client',
 *     grant_types: ['authorization_code', 'refresh_token'],
 *     response_types: ['code'],
 *   },
 *   onRedirectToAuthorization: (url) => {
 *     // Open URL in browser for CLI, or redirect response for web
 *     console.log(`Please visit: ${url}`);
 *   },
 * });
 *
 * // Create the MCP client with OAuth
 * const client = new MCPClient({
 *   servers: {
 *     'protected-server': {
 *       url: 'https://mcp.example.com/mcp',
 *       authProvider: oauthProvider,
 *     },
 *   },
 * });
 *
 * await client.connect();
 * ```
 */
export class MCPOAuthClientProvider implements OAuthClientProvider {
  private _redirectUrl: string | URL;
  private _clientMetadata: OAuthClientMetadata;
  readonly clientMetadataUrl?: string;
  private readonly storage: OAuthStorage;
  private readonly onRedirect?: (url: URL) => void | Promise<void>;
  private readonly generateState: () => string | Promise<string>;

  private configuredClientInfo?: StoredOAuthClientInformation;
  private issuerIndexUpdate: Promise<void> = Promise.resolve();
  private _sessionState?: string;
  private _sessionRedirectUrl?: string | URL;

  constructor(options: MCPOAuthClientProviderOptions) {
    if (options.clientMetadataUrl) {
      validateClientMetadataUrl(options.clientMetadataUrl);
      if (options.clientMetadata.client_id !== options.clientMetadataUrl) {
        throw new Error('clientMetadataUrl must match clientMetadata.client_id');
      }
      if (!options.clientMetadata.client_name || options.clientMetadata.redirect_uris.length === 0) {
        throw new Error('Client ID Metadata Documents require client_name and at least one redirect_uri');
      }
    }

    const registrationMetadata = { ...options.clientMetadata };
    delete registrationMetadata.client_id;
    this._redirectUrl = options.redirectUrl;
    this._clientMetadata = registrationMetadata;
    this.clientMetadataUrl = options.clientMetadataUrl;
    this.configuredClientInfo = options.clientInformation;
    this.storage = options.storage ?? new InMemoryOAuthStorage();
    this.onRedirect = options.onRedirectToAuthorization;
    this.generateState = options.stateGenerator ?? (() => crypto.randomUUID());
  }

  /**
   * The URL to redirect the user agent to after authorization.
   */
  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  /**
   * Metadata about this OAuth client.
   */
  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata;
  }

  /**
   * Returns a OAuth2 state parameter.
   *
   * While an authorization session is active (see beginAuthorizationSession),
   * the pinned session state is returned so a callback server can validate
   * the redirect against a known value.
   */
  async state(): Promise<string> {
    return this._sessionState ?? this.generateState();
  }

  /**
   * Pins the OAuth state parameter for the next authorization request.
   *
   * Hosts driving an interactive authorization flow (e.g. MCPClient.authenticate)
   * call this before triggering the flow so the loopback callback server knows
   * which state value to expect. Call endAuthorizationSession once the flow settles.
   *
   * @returns The pinned state value, generated with the configured stateGenerator
   */
  async beginAuthorizationSession(): Promise<string> {
    this._sessionState = await this.generateState();
    this._sessionRedirectUrl = this._redirectUrl;
    return this._sessionState;
  }

  /**
   * Clears the pinned authorization state (see beginAuthorizationSession) and
   * restores the configured redirect URL if applyResolvedRedirectUrl rebased
   * it to a fallback port during the session, so the next flow starts from
   * the preferred port again.
   */
  endAuthorizationSession(): void {
    this._sessionState = undefined;
    if (this._sessionRedirectUrl !== undefined) {
      this._redirectUrl = this._sessionRedirectUrl;
      this._sessionRedirectUrl = undefined;
    }
  }

  /**
   * Points the provider at the callback URL that is actually bound.
   *
   * Loopback callback servers may bind a fallback port when the preferred one
   * is in use. Call this before triggering authorization so the authorization
   * request's redirect_uri matches the listening server, and so dynamic client
   * registration registers every candidate callback URL (see
   * getCallbackUrlCandidates) rather than only the preferred one.
   *
   * @param redirectUrl - The callback URL that is actually bound
   * @param registeredRedirectUris - The redirect URIs to register during dynamic client registration
   */
  applyResolvedRedirectUrl(redirectUrl: string | URL, registeredRedirectUris: (string | URL)[]): void {
    this._redirectUrl = redirectUrl;
    this._clientMetadata = {
      ...this._clientMetadata,
      redirect_uris: registeredRedirectUris.map(uri => uri.toString()),
    };
  }

  private credentialKey(kind: 'client_info' | 'tokens', ctx?: OAuthClientInformationContext): string {
    return ctx ? `${kind}:${encodeURIComponent(ctx.issuer)}` : kind;
  }

  private async rememberIssuer(issuer: string): Promise<void> {
    const update = this.issuerIndexUpdate.catch(() => {}).then(async () => {
      let issuers: string[] = [];
      const stored = await this.storage.get('credential_issuers');
      if (stored) {
        try {
          issuers = JSON.parse(stored) as string[];
        } catch {
          // Invalid stored data is replaced with a fresh index.
        }
      }
      if (!issuers.includes(issuer)) {
        issuers.push(issuer);
        await this.storage.set('credential_issuers', JSON.stringify(issuers));
      }
    });
    this.issuerIndexUpdate = update;
    await update;
  }

  private async readStored<T>(key: string, expectedIssuer?: string): Promise<T | undefined> {
    const stored = await this.storage.get(key);
    if (!stored) return undefined;
    try {
      const value = JSON.parse(stored) as T;
      if (expectedIssuer && (value as { issuer?: unknown }).issuer !== expectedIssuer) return undefined;
      return value;
    } catch {
      return undefined;
    }
  }

  /**
   * Loads information about this OAuth client.
   */
  async clientInformation(ctx?: OAuthClientInformationContext): Promise<StoredOAuthClientInformation | undefined> {
    if (this.configuredClientInfo) {
      return this.configuredClientInfo;
    }
    return this.readStored(this.credentialKey('client_info', ctx), ctx?.issuer);
  }

  /**
   * Saves dynamically registered or Client ID Metadata Document client information.
   */
  async saveClientInformation(
    clientInformation: StoredOAuthClientInformation,
    ctx?: OAuthClientInformationContext,
  ): Promise<void> {
    if (this.configuredClientInfo?.client_id === clientInformation.client_id) {
      this.configuredClientInfo = clientInformation;
    }
    if (ctx) {
      await this.rememberIssuer(ctx.issuer);
      await this.storage.set(this.credentialKey('client_info', ctx), JSON.stringify(clientInformation));
    }
    await this.storage.set('client_info', JSON.stringify(clientInformation));
  }

  /**
   * Loads existing OAuth tokens.
   */
  async tokens(ctx?: OAuthClientInformationContext): Promise<StoredOAuthTokens | undefined> {
    return this.readStored(this.credentialKey('tokens', ctx), ctx?.issuer);
  }

  /**
   * Stores new OAuth tokens after successful authorization.
   */
  async saveTokens(tokens: StoredOAuthTokens, ctx?: OAuthClientInformationContext): Promise<void> {
    if (ctx) {
      await this.rememberIssuer(ctx.issuer);
      await this.storage.set(this.credentialKey('tokens', ctx), JSON.stringify(tokens));
    }
    await this.storage.set('tokens', JSON.stringify(tokens));
  }

  /**
   * Persists authorization-server discovery state across the browser redirect.
   */
  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await this.storage.set('discovery_state', JSON.stringify(state));
  }

  /**
   * Loads authorization-server discovery state for callback issuer validation.
   */
  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return this.readStored<OAuthDiscoveryState>('discovery_state');
  }

  /**
   * Invoked to redirect the user agent to the authorization URL.
   */
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.onRedirect) {
      await this.onRedirect(authorizationUrl);
    } else {
      // Default behavior: just log the URL (CLI scenario)
      console.info(`Authorization required. Please visit: ${authorizationUrl.toString()}`);
    }
  }

  /**
   * Saves a PKCE code verifier before redirecting to authorization.
   */
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.storage.set('code_verifier', codeVerifier);
  }

  /**
   * Loads the PKCE code verifier for validating authorization result.
   */
  async codeVerifier(): Promise<string> {
    const verifier = await this.storage.get('code_verifier');
    if (!verifier) {
      throw new Error('No code verifier found. Authorization flow may not have started properly.');
    }
    return verifier;
  }

  /**
   * Invalidate credentials when server indicates they're no longer valid.
   */
  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    await this.issuerIndexUpdate.catch(() => {});
    const issuerIndex = await this.storage.get('credential_issuers');
    let issuers: string[] = [];
    if (issuerIndex) {
      try {
        issuers = JSON.parse(issuerIndex) as string[];
      } catch {
        // Invalid stored data is ignored during cleanup.
      }
    }
    const deleteCredentialKind = async (kind: 'client_info' | 'tokens') => {
      await this.storage.delete(kind);
      await Promise.all(issuers.map(issuer => this.storage.delete(this.credentialKey(kind, { issuer }))));
    };

    switch (scope) {
      case 'all':
        await deleteCredentialKind('tokens');
        await deleteCredentialKind('client_info');
        await this.storage.delete('code_verifier');
        await this.storage.delete('discovery_state');
        await this.storage.delete('credential_issuers');
        break;
      case 'client':
        await deleteCredentialKind('client_info');
        break;
      case 'tokens':
        await deleteCredentialKind('tokens');
        break;
      case 'verifier':
        await this.storage.delete('code_verifier');
        break;
      case 'discovery':
        await this.storage.delete('discovery_state');
        break;
    }
  }

  /**
   * Clear all stored OAuth data.
   * Useful for logging out or resetting state.
   */
  async clear(): Promise<void> {
    await this.invalidateCredentials('all');
  }

  /**
   * Check if the provider has valid (non-expired) tokens.
   */
  async hasValidTokens(): Promise<boolean> {
    const currentTokens = await this.tokens();
    if (!currentTokens) return false;

    // Check if we have an access token
    if (!currentTokens.access_token) return false;

    // Note: Token expiration checking would require parsing the JWT
    // or tracking when we received the token. The MCP client handles
    // token refresh automatically when needed.
    return true;
  }
}

/**
 * Creates a simple OAuth provider with pre-configured tokens.
 *
 * This is useful for testing scenarios where you already have a valid token.
 * For production, use the full MCPOAuthClientProvider with proper OAuth flow.
 *
 * @param accessToken - A valid access token
 * @param options - Additional configuration options
 * @returns An OAuthClientProvider that returns the pre-configured token
 *
 * @example
 * ```typescript
 * const provider = createSimpleTokenProvider('my-access-token', {
 *   redirectUrl: 'http://localhost:3000/callback',
 *   clientMetadata: {
 *     redirect_uris: ['http://localhost:3000/callback'],
 *     client_name: 'Test Client',
 *   },
 * });
 *
 * const client = new MCPClient({
 *   servers: {
 *     test: { url: 'https://mcp.example.com', authProvider: provider }
 *   },
 * });
 * ```
 */
export function createSimpleTokenProvider(
  accessToken: string,
  options: {
    redirectUrl: string | URL;
    clientMetadata: OAuthClientMetadata;
    clientInformation?: OAuthClientInformation;
    tokenType?: string;
    refreshToken?: string;
    expiresIn?: number;
    scope?: string;
  },
): OAuthClientProvider {
  const tokens: OAuthTokens = {
    access_token: accessToken,
    token_type: options.tokenType ?? 'Bearer',
    refresh_token: options.refreshToken,
    expires_in: options.expiresIn,
    scope: options.scope,
  };

  const storage = new InMemoryOAuthStorage();
  storage.set('tokens', JSON.stringify(tokens));

  if (options.clientInformation) {
    storage.set('client_info', JSON.stringify(options.clientInformation));
  }

  return new MCPOAuthClientProvider({
    redirectUrl: options.redirectUrl,
    clientMetadata: options.clientMetadata,
    clientInformation: options.clientInformation,
    storage,
  });
}
