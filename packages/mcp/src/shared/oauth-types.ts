/**
 * OAuth Types for MCP Authentication
 *
 * Re-exports and extends OAuth types from the MCP SDK for use in Mastra's
 * MCP client and server implementations.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 */

import type { OAuthProtectedResourceMetadata as SDKOAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

// Re-export all OAuth types from MCP SDK
export type {
  OAuthMetadata,
  OAuthTokens,
  OAuthErrorResponse,
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientRegistrationError,
  OAuthTokenRevocationRequest,
  OAuthProtectedResourceMetadata,
  AuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js';

// Re-export OAuth client functions from MCP SDK
export {
  auth,
  discoverOAuthProtectedResourceMetadata,
  discoverOAuthMetadata,
  discoverAuthorizationServerMetadata,
  startAuthorization,
  exchangeAuthorization,
  refreshAuthorization,
  registerClient,
  extractResourceMetadataUrl,
  selectResourceURL,
  parseErrorResponse,
  UnauthorizedError,
  buildDiscoveryUrls,
} from '@modelcontextprotocol/sdk/client/auth.js';

// Re-export OAuthClientProvider interface
export type { OAuthClientProvider, AuthResult } from '@modelcontextprotocol/sdk/client/auth.js';

/**
 * Configuration for OAuth-protected MCP server.
 *
 * Used to configure Protected Resource Metadata (RFC 9728) and
 * token validation for MCP servers that require OAuth authentication.
 */
export interface MCPServerOAuthConfig {
  /**
   * The resource identifier URI for this MCP server.
   * This MUST be the canonical URL of the MCP server.
   *
   * @example 'https://mcp.example.com/mcp'
   */
  resource: string;

  /**
   * URLs of authorization servers that can issue tokens for this resource.
   * At least one authorization server should be specified.
   *
   * @example ['https://auth.example.com']
   */
  authorizationServers: string[];

  /**
   * Scopes supported by this MCP server.
   *
   * @default ['mcp:read', 'mcp:write']
   */
  scopesSupported?: string[];

  /**
   * Human-readable name of this resource server.
   */
  resourceName?: string;

  /**
   * URL to documentation about this resource server.
   */
  resourceDocumentation?: string;

  /**
   * Custom function to validate access tokens.
   *
   * If not provided, tokens are accepted without validation
   * (useful for testing but NOT recommended for production).
   *
   * @param token - The bearer token from the Authorization header
   * @param resource - The resource URI this server represents
   * @returns Promise resolving to validation result
   */
  validateToken?: (token: string, resource: string) => Promise<TokenValidationResult>;
}

/**
 * Result of token validation.
 */
export interface TokenValidationResult {
  /**
   * Whether the token is valid.
   */
  valid: boolean;

  /**
   * If invalid, the reason for rejection.
   */
  error?: string;

  /**
   * If invalid, a more detailed error description.
   */
  errorDescription?: string;

  /**
   * The scopes granted by this token.
   */
  scopes?: string[];

  /**
   * The subject (user) identifier from the token.
   */
  subject?: string;

  /**
   * When the token expires (Unix timestamp).
   */
  expiresAt?: number;

  /**
   * Additional claims from the token.
   */
  claims?: Record<string, unknown>;
}

/**
 * Options for OAuth-related HTTP responses.
 */
export interface OAuthResponseOptions {
  /**
   * URL to the Protected Resource Metadata endpoint.
   */
  resourceMetadataUrl?: string;

  /**
   * Additional WWW-Authenticate parameters.
   */
  additionalParams?: Record<string, string>;
}

/**
 * Escapes double quotes in a string for use in HTTP header quoted-string values.
 */
function escapeHeaderValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Generates a WWW-Authenticate header value for OAuth 401 responses.
 *
 * @param options - Options for generating the header
 * @returns The WWW-Authenticate header value
 *
 * @example
 * ```typescript
 * const header = generateWWWAuthenticateHeader({
 *   resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
 * });
 * // Returns: 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"'
 * ```
 */
export function generateWWWAuthenticateHeader(options: OAuthResponseOptions = {}): string {
  const params: string[] = [];

  if (options.resourceMetadataUrl) {
    params.push(`resource_metadata="${escapeHeaderValue(options.resourceMetadataUrl)}"`);
  }

  if (options.additionalParams) {
    for (const [key, value] of Object.entries(options.additionalParams)) {
      params.push(`${key}="${escapeHeaderValue(value)}"`);
    }
  }

  if (params.length === 0) {
    return 'Bearer';
  }

  return `Bearer ${params.join(', ')}`;
}

/**
 * Generates Protected Resource Metadata (RFC 9728) JSON response.
 *
 * @param config - OAuth configuration for the MCP server
 * @returns The Protected Resource Metadata object
 *
 * @see https://www.rfc-editor.org/rfc/rfc9728.html
 */
export function generateProtectedResourceMetadata(config: MCPServerOAuthConfig): SDKOAuthProtectedResourceMetadata {
  return {
    resource: config.resource,
    authorization_servers: config.authorizationServers,
    scopes_supported: config.scopesSupported ?? ['mcp:read', 'mcp:write'],
    bearer_methods_supported: ['header'],
    ...(config.resourceName && { resource_name: config.resourceName }),
    ...(config.resourceDocumentation && {
      resource_documentation: config.resourceDocumentation,
    }),
  };
}

/**
 * Extracts the bearer token from an Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The bearer token, or undefined if not present
 */
export function extractBearerToken(authHeader: string | null | undefined): string | undefined {
  if (!authHeader) return undefined;

  // Case-insensitive check for "Bearer " prefix (safer than regex to avoid ReDoS)
  const prefix = 'bearer ';
  if (authHeader.length <= prefix.length) return undefined;
  if (authHeader.slice(0, prefix.length).toLowerCase() !== prefix) return undefined;

  const token = authHeader.slice(prefix.length).trim();
  return token || undefined;
}
