/**
 * OAuth Client Provider Implementation for MCP Client
 *
 * Provides a ready-to-use OAuthClientProvider implementation that can be used
 * with Mastra's MCPClient for connecting to OAuth-protected MCP servers.
 *
 * Client identity is configured, never registered at runtime: the provider is
 * given either pre-registered client information or a Client ID Metadata
 * Document URL (SEP-991), and it never performs dynamic client registration.
 */

import { validateClientMetadataUrl } from '@modelcontextprotocol/client';
import type {
  OAuthClientProvider,
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthClientInformationContext,
  OAuthDiscoveryState,
  StoredOAuthTokens,
} from '../shared/oauth-types.js';

/**
 * Storage interface for persisting OAuth data.
 *
 * Implement this interface to persist OAuth data across processes.
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
 *
 * Exactly one client identity source is required: `clientInformation` for a
 * client pre-registered with the authorization server, or `clientMetadataUrl`
 * for a Client ID Metadata Document the authorization server fetches.
 */
export interface MCPClientMetadata extends OAuthClientMetadata {
  /**
   * The `client_id` published in a Client ID Metadata Document. When present it
   * must equal `clientMetadataUrl`; the provider never sends it to the
   * authorization server itself.
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
   * OAuth client metadata (name, redirect URIs, grant types, scope).
   *
   * Used for scope selection and as the description of this client; it is
   * never posted to a registration endpoint. With `clientMetadataUrl` it must
   * mirror the hosted document: `client_name` and at least one redirect URI.
   */
  clientMetadata: MCPClientMetadata;

  /**
   * Client information for a client pre-registered with the authorization server.
   */
  clientInformation?: OAuthClientInformation;

  /**
   * HTTPS URL of this client's Client ID Metadata Document (SEP-991).
   *
   * The URL is used as the `client_id`; the authorization server fetches the
   * document to learn the client's metadata. Must be an HTTPS URL with a
   * non-root pathname.
   */
  clientMetadataUrl?: string;

  /**
   * Storage for persisting OAuth data (tokens, discovery state and the PKCE
   * verifier). Defaults to InMemoryOAuthStorage if not provided.
   *
   * Tokens are keyed by the authorization server's validated `issuer`, and
   * mutation ordering is coordinated only within one provider instance, so
   * give each provider its own storage namespace.
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
 * This provider handles the OAuth 2.1 authorization-code flow for connecting to
 * OAuth-protected MCP servers, including:
 * - Pre-registered or URL-based (Client ID Metadata Document) client identity
 * - PKCE (Proof Key for Code Exchange)
 * - Token storage and refresh
 *
 * @example
 * ```typescript
 * import { MCPClient, MCPOAuthClientProvider } from '@mastra/mcp';
 *
 * const oauthProvider = new MCPOAuthClientProvider({
 *   redirectUrl: 'http://localhost:3000/oauth/callback',
 *   clientMetadataUrl: 'https://my-app.example.com/oauth/client-metadata.json',
 *   clientMetadata: {
 *     redirect_uris: ['http://localhost:3000/oauth/callback'],
 *     client_name: 'My MCP Client',
 *     grant_types: ['authorization_code', 'refresh_token'],
 *     response_types: ['code'],
 *   },
 *   onRedirectToAuthorization: (url) => {
 *     console.log(`Please visit: ${url}`);
 *   },
 * });
 *
 * const client = new MCPClient({
 *   servers: {
 *     'protected-server': {
 *       url: new URL('https://mcp.example.com/mcp'),
 *       authProvider: oauthProvider,
 *     },
 *   },
 * });
 * ```
 */
export class MCPOAuthClientProvider implements OAuthClientProvider {
  private _redirectUrl: string | URL;
  private readonly _clientMetadata: OAuthClientMetadata;
  private readonly _clientMetadataUrl?: string;
  private readonly _clientInfo?: OAuthClientInformation;
  private readonly storage: OAuthStorage;
  private readonly onRedirect?: (url: URL) => void | Promise<void>;
  private readonly generateState: () => string | Promise<string>;

  private _sessionState?: string;
  private _sessionRedirectUrl?: string | URL;
  private credentialMutation: Promise<unknown> = Promise.resolve();

  constructor(options: MCPOAuthClientProviderOptions) {
    if (!options.clientInformation && !options.clientMetadataUrl) {
      throw new Error(
        'MCPOAuthClientProvider requires a client identity: pass clientInformation for a pre-registered client or clientMetadataUrl for a Client ID Metadata Document. Dynamic client registration is not supported.',
      );
    }
    if (options.clientInformation && options.clientMetadataUrl) {
      throw new Error(
        'MCPOAuthClientProvider accepts one client identity: pass either clientInformation or clientMetadataUrl, not both.',
      );
    }
    if (options.clientMetadataUrl) {
      validateClientMetadataUrl(options.clientMetadataUrl);
      if (options.clientMetadata.client_id !== undefined && options.clientMetadata.client_id !== options.clientMetadataUrl) {
        throw new Error('clientMetadataUrl must match clientMetadata.client_id');
      }
      if (!options.clientMetadata.client_name || options.clientMetadata.redirect_uris.length === 0) {
        throw new Error('Client ID Metadata Documents require client_name and at least one redirect_uri');
      }
    }
    const { client_id: _clientId, ...clientMetadata } = options.clientMetadata;
    this._redirectUrl = options.redirectUrl;
    this._clientMetadata = clientMetadata;
    this._clientMetadataUrl = options.clientMetadataUrl;
    this._clientInfo = options.clientInformation;
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
   * URL of this client's Client ID Metadata Document, when identity is URL-based.
   */
  get clientMetadataUrl(): string | undefined {
    return this._clientMetadataUrl;
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
   * request's redirect_uri matches the listening server. The bound URL must be
   * one of the redirect URIs the client is registered with (or lists in its
   * metadata document).
   *
   * @param redirectUrl - The callback URL that is actually bound
   */
  applyResolvedRedirectUrl(redirectUrl: string | URL): void {
    this._redirectUrl = redirectUrl;
  }

  /**
   * The client's identity: pre-registered information, or the metadata
   * document URL used as `client_id`.
   */
  clientInformation(): OAuthClientInformation {
    return this._clientInfo ?? { client_id: this._clientMetadataUrl! };
  }

  private tokensKey(ctx?: OAuthClientInformationContext): string {
    return ctx ? `tokens:${encodeURIComponent(ctx.issuer)}` : 'tokens';
  }

  /**
   * Serializes storage mutations so concurrent writes and invalidations settle
   * in call order: a write started before `invalidateCredentials` cannot land
   * after it completes.
   */
  private enqueueCredentialMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const operation = this.credentialMutation.catch(() => {}).then(mutation);
    this.credentialMutation = operation;
    return operation;
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

  private async readIssuerIndex(): Promise<string[]> {
    return (await this.readStored<string[]>('credential_issuers')) ?? [];
  }

  private async rememberIssuer(issuer: string): Promise<void> {
    const issuers = await this.readIssuerIndex();
    if (!issuers.includes(issuer)) {
      issuers.push(issuer);
      await this.storage.set('credential_issuers', JSON.stringify(issuers));
    }
  }

  /**
   * Loads existing OAuth tokens.
   *
   * With an issuer context, only tokens minted by that authorization server are
   * returned; without one, the most recently saved token set is returned for
   * the transport's bearer-token read.
   */
  async tokens(ctx?: OAuthClientInformationContext): Promise<StoredOAuthTokens | undefined> {
    return this.readStored<StoredOAuthTokens>(this.tokensKey(ctx), ctx?.issuer);
  }

  /**
   * Stores new OAuth tokens after successful authorization, bound to the
   * authorization server's issuer when known.
   */
  async saveTokens(tokens: StoredOAuthTokens, ctx?: OAuthClientInformationContext): Promise<void> {
    await this.enqueueCredentialMutation(async () => {
      if (ctx) {
        await this.rememberIssuer(ctx.issuer);
        await this.storage.set(this.tokensKey(ctx), JSON.stringify(tokens));
      }
      await this.storage.set('tokens', JSON.stringify(tokens));
    });
  }

  /**
   * Persists authorization-server discovery state so the callback leg can
   * verify the code is exchanged with the server that issued the redirect.
   */
  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await this.enqueueCredentialMutation(async () => {
      await this.storage.set('discovery_state', JSON.stringify(state));
    });
  }

  /**
   * Loads persisted authorization-server discovery state.
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
    await this.enqueueCredentialMutation(async () => {
      await this.storage.set('code_verifier', codeVerifier);
    });
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
   * Invalidate stored credentials when the server indicates they're no longer valid.
   * Client identity is configuration, so the `client` scope has nothing to discard.
   */
  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    await this.enqueueCredentialMutation(async () => {
      const deleteTokens = async () => {
        const issuers = await this.readIssuerIndex();
        await this.storage.delete('tokens');
        await Promise.all(issuers.map(issuer => this.storage.delete(this.tokensKey({ issuer }))));
      };

      switch (scope) {
        case 'all':
          await deleteTokens();
          await this.storage.delete('code_verifier');
          await this.storage.delete('discovery_state');
          await this.storage.delete('credential_issuers');
          break;
        case 'tokens':
          await deleteTokens();
          break;
        case 'verifier':
          await this.storage.delete('code_verifier');
          break;
        case 'discovery':
          await this.storage.delete('discovery_state');
          break;
        case 'client':
          break;
      }
    });
  }

  /**
   * Clear all stored OAuth data.
   * Useful for logging out or resetting state.
   */
  async clear(): Promise<void> {
    await this.invalidateCredentials('all');
  }

  /**
   * Check if the provider has tokens with an access token.
   */
  async hasValidTokens(): Promise<boolean> {
    const currentTokens = await this.tokens();
    return !!currentTokens?.access_token;
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
 *   clientInformation: { client_id: 'test-client' },
 * });
 * ```
 */
export function createSimpleTokenProvider(
  accessToken: string,
  options: {
    redirectUrl: string | URL;
    clientMetadata: OAuthClientMetadata;
    /** Client identity used if the token must be refreshed. */
    clientInformation: OAuthClientInformation;
    tokenType?: string;
    refreshToken?: string;
    expiresIn?: number;
    scope?: string;
  },
): OAuthClientProvider {
  const tokens: StoredOAuthTokens = {
    access_token: accessToken,
    token_type: options.tokenType ?? 'Bearer',
    refresh_token: options.refreshToken,
    expires_in: options.expiresIn,
    scope: options.scope,
  };

  const storage = new InMemoryOAuthStorage();
  storage.set('tokens', JSON.stringify(tokens));

  return new MCPOAuthClientProvider({
    redirectUrl: options.redirectUrl,
    clientMetadata: options.clientMetadata,
    clientInformation: options.clientInformation,
    storage,
  });
}
