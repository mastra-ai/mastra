/**
 * OAuth Middleware for MCP Server
 *
 * Implements OAuth 2.0 Protected Resource support per RFC 9728 for MCP servers.
 * This allows MCP servers to require OAuth authentication from clients.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 * @see https://www.rfc-editor.org/rfc/rfc9728.html
 */

import type * as http from 'node:http';

import type { MCPServerOAuthConfig, TokenValidationResult } from '../shared/oauth-types.js';
import {
  generateProtectedResourceMetadata,
  generateWWWAuthenticateHeader,
  extractBearerToken,
} from '../shared/oauth-types.js';

/**
 * Simple logger interface for OAuth middleware.
 */
interface OAuthMiddlewareLogger {
  debug?: (message: string, ...args: unknown[]) => void;
}

/**
 * Options for the OAuth middleware.
 */
export interface OAuthMiddlewareOptions {
  /**
   * OAuth configuration for the MCP server.
   */
  oauth: MCPServerOAuthConfig;

  /**
   * Path where the MCP endpoint is served.
   * @default '/mcp'
   */
  mcpPath?: string;

  /**
   * Logger instance for debugging.
   */
  logger?: OAuthMiddlewareLogger;
}

/**
 * Result of the middleware check.
 */
export interface OAuthMiddlewareResult {
  /**
   * Whether the request should proceed.
   */
  proceed: boolean;

  /**
   * If false, the response has already been sent.
   */
  handled: boolean;

  /**
   * Token validation result if authentication was attempted.
   */
  tokenValidation?: TokenValidationResult;
}

/**
 * Creates an OAuth middleware function for protecting MCP server endpoints.
 *
 * This middleware:
 * 1. Serves Protected Resource Metadata at `/.well-known/oauth-protected-resource`
 * 2. Validates bearer tokens on protected endpoints
 * 3. Returns proper 401 responses with WWW-Authenticate headers
 *
 * @param options - Middleware configuration
 * @returns Middleware function that returns whether request should proceed
 *
 * @example
 * ```typescript
 * import http from 'node:http';
 * import { MCPServer, createOAuthMiddleware } from '@mastra/mcp';
 *
 * const server = new MCPServer({ name: 'Protected Server', version: '1.0.0', tools: {} });
 *
 * const oauthMiddleware = createOAuthMiddleware({
 *   oauth: {
 *     resource: 'https://mcp.example.com/mcp',
 *     authorizationServers: ['https://auth.example.com'],
 *     validateToken: async (token, resource) => {
 *       // Your token validation logic here
 *       return { valid: true, scopes: ['mcp:read', 'mcp:write'] };
 *     },
 *   },
 * });
 *
 * const httpServer = http.createServer(async (req, res) => {
 *   const url = new URL(req.url || '', 'http://localhost:3000');
 *
 *   // Apply OAuth middleware first
 *   const result = await oauthMiddleware(req, res, url);
 *   if (!result.proceed) return; // Middleware handled the response
 *
 *   // Continue to MCP handler
 *   await server.startHTTP({ url, httpPath: '/mcp', req, res });
 * });
 *
 * httpServer.listen(3000);
 * ```
 */
export function createOAuthMiddleware(options: OAuthMiddlewareOptions) {
  const { oauth, mcpPath = '/mcp', logger } = options;

  // Pre-compute the metadata and paths
  const protectedResourceMetadata = generateProtectedResourceMetadata(oauth);
  const wellKnownPath = '/.well-known/oauth-protected-resource';
  const resourceMetadataUrl = new URL(wellKnownPath, oauth.resource).toString();

  return async function oauthMiddleware(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<OAuthMiddlewareResult> {
    logger?.debug?.(`OAuth middleware: ${req.method} ${url.pathname}`);

    // Handle Protected Resource Metadata endpoint (RFC 9728)
    if (url.pathname === wellKnownPath && req.method === 'GET') {
      logger?.debug?.('OAuth middleware: Serving Protected Resource Metadata');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(protectedResourceMetadata));
      return { proceed: false, handled: true };
    }

    // Handle CORS preflight for metadata endpoint
    if (url.pathname === wellKnownPath && req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return { proceed: false, handled: true };
    }

    // Only protect the MCP endpoint
    if (!url.pathname.startsWith(mcpPath)) {
      return { proceed: true, handled: false };
    }

    // Extract and validate bearer token
    const authHeader = req.headers['authorization'];
    const token = extractBearerToken(authHeader as string | undefined);

    if (!token) {
      logger?.debug?.('OAuth middleware: No bearer token provided');
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': generateWWWAuthenticateHeader({ resourceMetadataUrl }),
      });
      res.end(
        JSON.stringify({
          error: 'unauthorized',
          error_description: 'Bearer token required',
        }),
      );
      return { proceed: false, handled: true };
    }

    // Validate the token
    if (oauth.validateToken) {
      logger?.debug?.('OAuth middleware: Validating token');
      const validationResult = await oauth.validateToken(token, oauth.resource);

      if (!validationResult.valid) {
        logger?.debug?.(`OAuth middleware: Token validation failed: ${validationResult.error}`);
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': generateWWWAuthenticateHeader({
            resourceMetadataUrl,
            additionalParams: {
              error: validationResult.error || 'invalid_token',
              ...(validationResult.errorDescription && {
                error_description: validationResult.errorDescription,
              }),
            },
          }),
        });
        res.end(
          JSON.stringify({
            error: validationResult.error || 'invalid_token',
            error_description: validationResult.errorDescription || 'Token validation failed',
          }),
        );
        return { proceed: false, handled: true, tokenValidation: validationResult };
      }

      logger?.debug?.('OAuth middleware: Token validated successfully');
      return { proceed: true, handled: false, tokenValidation: validationResult };
    }

    // If no validateToken function provided, accept the token
    // This is for testing/development - NOT recommended for production
    logger?.debug?.('OAuth middleware: No token validation configured, accepting token');
    return {
      proceed: true,
      handled: false,
      tokenValidation: { valid: true },
    };
  };
}

/**
 * Helper to create a simple token validator that checks against a list of valid tokens.
 *
 * Useful for testing and development. For production, use a proper JWT validator
 * or call your authorization server's introspection endpoint.
 *
 * @param validTokens - Array of valid token strings
 * @returns Token validation function
 *
 * @example
 * ```typescript
 * const validateToken = createStaticTokenValidator(['secret-token-1', 'secret-token-2']);
 *
 * const middleware = createOAuthMiddleware({
 *   oauth: {
 *     resource: 'https://mcp.example.com/mcp',
 *     authorizationServers: ['https://auth.example.com'],
 *     validateToken,
 *   },
 * });
 * ```
 */
export function createStaticTokenValidator(validTokens: string[]): MCPServerOAuthConfig['validateToken'] {
  const tokenSet = new Set(validTokens);
  return async (token: string): Promise<TokenValidationResult> => {
    if (tokenSet.has(token)) {
      return { valid: true, scopes: ['mcp:read', 'mcp:write'] };
    }
    return {
      valid: false,
      error: 'invalid_token',
      errorDescription: 'Token not recognized',
    };
  };
}

/**
 * Introspection response type per RFC 7662.
 */
interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  [key: string]: unknown;
}

/**
 * Creates a token validator that calls an introspection endpoint.
 *
 * Per RFC 7662, the introspection endpoint returns token metadata.
 *
 * @param introspectionEndpoint - URL of the token introspection endpoint
 * @param clientCredentials - Optional client credentials for authenticated introspection
 * @returns Token validation function
 *
 * @example
 * ```typescript
 * const validateToken = createIntrospectionValidator(
 *   'https://auth.example.com/oauth/introspect',
 *   { clientId: 'mcp-server', clientSecret: 'secret' }
 * );
 * ```
 */
export function createIntrospectionValidator(
  introspectionEndpoint: string,
  clientCredentials?: { clientId: string; clientSecret: string },
): MCPServerOAuthConfig['validateToken'] {
  return async (token: string, resource: string): Promise<TokenValidationResult> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (clientCredentials) {
        const credentials = Buffer.from(`${clientCredentials.clientId}:${clientCredentials.clientSecret}`).toString(
          'base64',
        );
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const response = await fetch(introspectionEndpoint, {
        method: 'POST',
        headers,
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      });

      if (!response.ok) {
        return {
          valid: false,
          error: 'server_error',
          errorDescription: `Introspection failed: ${response.status}`,
        };
      }

      const data = (await response.json()) as IntrospectionResponse;

      if (!data.active) {
        return {
          valid: false,
          error: 'invalid_token',
          errorDescription: 'Token is not active',
        };
      }

      // Validate audience if present
      if (data.aud) {
        const audiences = Array.isArray(data.aud) ? data.aud : [data.aud];
        if (!audiences.includes(resource)) {
          return {
            valid: false,
            error: 'invalid_token',
            errorDescription: 'Token audience does not match this resource',
          };
        }
      }

      return {
        valid: true,
        scopes: data.scope?.split(' ') || [],
        subject: data.sub,
        expiresAt: data.exp,
        claims: data as Record<string, unknown>,
      };
    } catch (error) {
      return {
        valid: false,
        error: 'server_error',
        errorDescription: error instanceof Error ? error.message : 'Introspection failed',
      };
    }
  };
}
