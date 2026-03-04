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
  OAuthClientInformationFull,
  OAuthTokens,
  AuthorizationServerMetadata,
} from '../shared/oauth-types.js';

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
   * OAuth client metadata for registration.
   * If the client is not pre-registered with the authorization server,
   * this metadata will be used for dynamic client registration.
   */
  clientMetadata: OAuthClientMetadata;

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
 * - Dynamic client registration (RFC 7591)
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
  private readonly _redirectUrl: string | URL;
  private readonly _clientMetadata: OAuthClientMetadata;
  private readonly storage: OAuthStorage;
  private readonly onRedirect?: (url: URL) => void | Promise<void>;
  private readonly generateState: () => string | Promise<string>;

  private _clientInfo?: OAuthClientInformation;

  constructor(options: MCPOAuthClientProviderOptions) {
    this._redirectUrl = options.redirectUrl;
    this._clientMetadata = options.clientMetadata;
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
   * Returns a OAuth2 state parameter.
   */
  async state(): Promise<string> {
    return this.generateState();
  }

  /**
   * Loads information about this OAuth client.
   */
  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // Check if we have pre-registered client info
    if (this._clientInfo) {
      return this._clientInfo;
    }

    // Check storage for dynamically registered client info
    const stored = await this.storage.get('client_info');
    if (stored) {
      try {
        return JSON.parse(stored) as OAuthClientInformation;
      } catch {
        // Invalid stored data, ignore
      }
    }

    return undefined;
  }

  /**
   * Saves dynamically registered client information.
   */
  async saveClientInformation(clientInformation: OAuthClientInformationFull): Promise<void> {
    this._clientInfo = clientInformation;
    await this.storage.set('client_info', JSON.stringify(clientInformation));
  }

  /**
   * Loads existing OAuth tokens.
   */
  async tokens(): Promise<OAuthTokens | undefined> {
    const stored = await this.storage.get('tokens');
    if (stored) {
      try {
        return JSON.parse(stored) as OAuthTokens;
      } catch {
        // Invalid stored data, ignore
      }
    }
    return undefined;
  }

  /**
   * Stores new OAuth tokens after successful authorization.
   */
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.storage.set('tokens', JSON.stringify(tokens));
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
   * Optional: Custom client authentication for token requests.
   * Uses default behavior if not implemented.
   */
  async addClientAuthentication?(
    _headers: Headers,
    _params: URLSearchParams,
    _url: string | URL,
    _metadata?: AuthorizationServerMetadata,
  ): Promise<void> {
    // Use default MCP SDK behavior
  }

  /**
   * Invalidate credentials when server indicates they're no longer valid.
   */
  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier',
  ): Promise<void> {
    switch (scope) {
      case 'all':
        await this.storage.delete('tokens');
        await this.storage.delete('client_info');
        await this.storage.delete('code_verifier');
        this._clientInfo = undefined;
        break;
      case 'client':
        await this.storage.delete('client_info');
        this._clientInfo = undefined;
        break;
      case 'tokens':
        await this.storage.delete('tokens');
        break;
      case 'verifier':
        await this.storage.delete('code_verifier');
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
    // or tracking when we received the token. The MCP SDK handles
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
