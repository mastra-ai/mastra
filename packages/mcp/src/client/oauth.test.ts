/**
 * OAuth Authentication Tests for MCP Client/Server
 *
 * Tests for the MCP OAuth implementation per:
 * - GitHub Issue: https://github.com/mastra-ai/mastra/issues/7058
 * - MCP Auth Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 *
 * The MCP spec requires:
 * 1. OAuth 2.0 Protected Resource Metadata (RFC9728) on servers
 * 2. Authorization Server Discovery by clients
 * 3. Dynamic Client Registration (RFC7591) support
 * 4. Token validation on protected endpoints
 */

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

import type { OAuthMiddlewareResult } from '../server/oauth-middleware.js';
import { createOAuthMiddleware, createStaticTokenValidator, createIntrospectionValidator } from '../server/oauth-middleware.js';
import { MCPServer } from '../server/server.js';
import type { MCPServerOAuthConfig } from '../shared/oauth-types.js';
import {
  generateProtectedResourceMetadata,
  generateWWWAuthenticateHeader,
  extractBearerToken,
} from '../shared/oauth-types.js';
import { MastraOAuthClientProvider, createSimpleTokenProvider } from './oauth-provider.js';

// =============================================================================
// Unit Tests for OAuth Types and Helpers
// =============================================================================

describe('OAuth Types and Helpers', () => {
  describe('generateProtectedResourceMetadata', () => {
    it('should generate valid RFC9728 metadata', () => {
      const config: MCPServerOAuthConfig = {
        resource: 'https://mcp.example.com/mcp',
        authorizationServers: ['https://auth.example.com'],
        scopesSupported: ['mcp:read', 'mcp:write'],
        resourceName: 'Test MCP Server',
      };

      const metadata = generateProtectedResourceMetadata(config);

      expect(metadata).toEqual({
        resource: 'https://mcp.example.com/mcp',
        authorization_servers: ['https://auth.example.com'],
        scopes_supported: ['mcp:read', 'mcp:write'],
        bearer_methods_supported: ['header'],
        resource_name: 'Test MCP Server',
      });
    });

    it('should use default scopes when not provided', () => {
      const config: MCPServerOAuthConfig = {
        resource: 'https://mcp.example.com/mcp',
        authorizationServers: ['https://auth.example.com'],
      };

      const metadata = generateProtectedResourceMetadata(config);

      expect(metadata.scopes_supported).toEqual(['mcp:read', 'mcp:write']);
    });
  });

  describe('generateWWWAuthenticateHeader', () => {
    it('should generate a basic Bearer header', () => {
      const header = generateWWWAuthenticateHeader();
      expect(header).toBe('Bearer');
    });

    it('should include resource_metadata URL when provided', () => {
      const header = generateWWWAuthenticateHeader({
        resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
      });
      expect(header).toBe(
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
      );
    });

    it('should include additional params', () => {
      const header = generateWWWAuthenticateHeader({
        resourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource',
        additionalParams: {
          error: 'invalid_token',
          error_description: 'Token expired',
        },
      });
      expect(header).toContain('error="invalid_token"');
      expect(header).toContain('error_description="Token expired"');
    });

    it('should properly escape backslashes and quotes in header values', () => {
      const header = generateWWWAuthenticateHeader({
        additionalParams: {
          error_description: 'Value with "quotes"',
        },
      });
      expect(header).toContain('error_description="Value with \\"quotes\\""');

      const headerWithBackslash = generateWWWAuthenticateHeader({
        additionalParams: {
          error_description: 'Path: C:\\Users\\test',
        },
      });
      expect(headerWithBackslash).toContain('error_description="Path: C:\\\\Users\\\\test"');

      // Test combined: backslash before quote should be escaped correctly
      const headerCombined = generateWWWAuthenticateHeader({
        additionalParams: {
          error_description: 'test\\"value',
        },
      });
      // Input: test\"value -> After escaping \ then ": test\\"value
      expect(headerCombined).toContain('error_description="test\\\\\\"value"');
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      expect(extractBearerToken('Bearer my-token-123')).toBe('my-token-123');
      expect(extractBearerToken('bearer my-token-456')).toBe('my-token-456');
      expect(extractBearerToken('BEARER my-token-789')).toBe('my-token-789');
    });

    it('should return undefined for invalid headers', () => {
      expect(extractBearerToken(null)).toBeUndefined();
      expect(extractBearerToken(undefined)).toBeUndefined();
      expect(extractBearerToken('')).toBeUndefined();
      expect(extractBearerToken('Basic xyz')).toBeUndefined();
      expect(extractBearerToken('Bearer')).toBeUndefined();
      expect(extractBearerToken('Bearer ')).toBeUndefined();
    });
  });
});

// =============================================================================
// Unit Tests for OAuth Client Provider
// =============================================================================

describe('MastraOAuthClientProvider', () => {
  it('should return the configured redirect URL', () => {
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
    });

    expect(provider.redirectUrl).toBe('http://localhost:3000/callback');
  });

  it('should return client metadata', () => {
    const metadata = {
      redirect_uris: ['http://localhost:3000/callback'],
      client_name: 'Test Client',
      grant_types: ['authorization_code'],
    };

    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: metadata,
    });

    expect(provider.clientMetadata).toEqual(metadata);
  });

  it('should store and retrieve tokens', async () => {
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
    });

    // Initially no tokens
    expect(await provider.tokens()).toBeUndefined();

    // Save tokens
    const tokens = {
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
    };
    await provider.saveTokens(tokens);

    // Retrieve tokens
    expect(await provider.tokens()).toEqual(tokens);
  });

  it('should store and retrieve code verifier', async () => {
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
    });

    await provider.saveCodeVerifier('test-verifier-123');
    expect(await provider.codeVerifier()).toBe('test-verifier-123');
  });

  it('should invalidate credentials by scope', async () => {
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
    });

    // Set up some data
    await provider.saveTokens({
      access_token: 'test-token',
      token_type: 'Bearer',
    });
    await provider.saveCodeVerifier('test-verifier');

    // Invalidate tokens only
    await provider.invalidateCredentials('tokens');
    expect(await provider.tokens()).toBeUndefined();

    // Code verifier should still exist
    expect(await provider.codeVerifier()).toBe('test-verifier');

    // Invalidate all
    await provider.invalidateCredentials('all');
    await expect(provider.codeVerifier()).rejects.toThrow();
  });

  it('should generate state for OAuth requests', async () => {
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
    });

    const state = await provider.state?.();
    expect(state).toBeDefined();
    expect(typeof state).toBe('string');
    expect(state!.length).toBeGreaterThan(0);
  });

  it('should use custom state generator', async () => {
    const customState = 'custom-state-value';
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
      stateGenerator: () => customState,
    });

    expect(await provider.state?.()).toBe(customState);
  });
});

describe('createSimpleTokenProvider', () => {
  it('should create a provider with pre-configured tokens', async () => {
    const provider = createSimpleTokenProvider('my-access-token', {
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
    });

    const tokens = await provider.tokens();
    expect(tokens?.access_token).toBe('my-access-token');
    expect(tokens?.token_type).toBe('Bearer');
  });

  it('should include optional token properties', async () => {
    const provider = createSimpleTokenProvider('my-access-token', {
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
      },
      refreshToken: 'my-refresh-token',
      expiresIn: 7200,
      scope: 'mcp:read mcp:write',
    });

    const tokens = await provider.tokens();
    expect(tokens?.refresh_token).toBe('my-refresh-token');
    expect(tokens?.expires_in).toBe(7200);
    expect(tokens?.scope).toBe('mcp:read mcp:write');
  });
});

// =============================================================================
// Unit Tests for OAuth Middleware
// =============================================================================

describe('createStaticTokenValidator', () => {
  it('should validate tokens in the allowed list', async () => {
    const validator = createStaticTokenValidator(['token-1', 'token-2']);

    const result1 = await validator!('token-1', 'https://example.com');
    expect(result1.valid).toBe(true);
    expect(result1.scopes).toEqual(['mcp:read', 'mcp:write']);

    const result2 = await validator!('token-2', 'https://example.com');
    expect(result2.valid).toBe(true);
  });

  it('should reject tokens not in the allowed list', async () => {
    const validator = createStaticTokenValidator(['token-1']);

    const result = await validator!('invalid-token', 'https://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_token');
  });
});

describe('createIntrospectionValidator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty scopes array for empty scope string', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        scope: '',
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as Response);

    const validator = createIntrospectionValidator('https://auth.example.com/introspect');
    const result = await validator('test-token', 'https://example.com');

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.scopes).toEqual([]);
    }
  });

  it('should return empty scopes array for whitespace-only scope string', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        scope: '   ',
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as Response);

    const validator = createIntrospectionValidator('https://auth.example.com/introspect');
    const result = await validator('test-token', 'https://example.com');

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.scopes).toEqual([]);
    }
  });

  it('should parse space-separated scopes correctly', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        scope: 'read write admin',
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as Response);

    const validator = createIntrospectionValidator('https://auth.example.com/introspect');
    const result = await validator('test-token', 'https://example.com');

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.scopes).toEqual(['read', 'write', 'admin']);
    }
  });

  it('should handle undefined scope', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as Response);

    const validator = createIntrospectionValidator('https://auth.example.com/introspect');
    const result = await validator('test-token', 'https://example.com');

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.scopes).toEqual([]);
    }
  });
});

// =============================================================================
// Integration Tests for OAuth Middleware with HTTP Server
// =============================================================================

describe('OAuth Middleware Integration', () => {
  const PORT = 18765 + Math.floor(Math.random() * 1000);
  const SERVER_URL = `http://localhost:${PORT}`;
  let httpServer: HttpServer;

  const VALID_TOKEN = 'valid-test-token-' + randomUUID();

  beforeAll(async () => {
    // Create an MCP server with a simple tool
    const mcpServer = new MCPServer({
      name: 'OAuth Test Server',
      version: '1.0.0',
      tools: {},
    });

    // Create OAuth middleware
    const oauthMiddleware = createOAuthMiddleware({
      oauth: {
        resource: `${SERVER_URL}/mcp`,
        authorizationServers: ['https://auth.example.com'],
        scopesSupported: ['mcp:read', 'mcp:write'],
        validateToken: createStaticTokenValidator([VALID_TOKEN]),
      },
      mcpPath: '/mcp',
    });

    // Create HTTP server with OAuth protection
    httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '', SERVER_URL);

      // Apply OAuth middleware
      const result: OAuthMiddlewareResult = await oauthMiddleware(req, res, url);
      if (!result.proceed) {
        return; // Middleware handled the response
      }

      // Continue to MCP server
      await mcpServer.startHTTP({
        url,
        httpPath: '/mcp',
        req,
        res,
      });
    });

    await new Promise<void>(resolve => {
      httpServer.listen(PORT, resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      httpServer.close(() => resolve());
    });
  });

  it('should serve Protected Resource Metadata at well-known endpoint', async () => {
    const response = await fetch(`${SERVER_URL}/.well-known/oauth-protected-resource`);
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toBe('application/json');

    const metadata = await response.json();
    expect(metadata.resource).toBe(`${SERVER_URL}/mcp`);
    expect(metadata.authorization_servers).toEqual(['https://auth.example.com']);
    expect(metadata.scopes_supported).toEqual(['mcp:read', 'mcp:write']);
    expect(metadata.bearer_methods_supported).toEqual(['header']);
  });

  it('should return 401 with WWW-Authenticate header when no token provided', async () => {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    });

    expect(response.status).toBe(401);

    const wwwAuth = response.headers.get('www-authenticate');
    expect(wwwAuth).toBeDefined();
    expect(wwwAuth).toContain('Bearer');
    expect(wwwAuth).toContain('resource_metadata=');

    const body = await response.json();
    expect(body.error).toBe('unauthorized');
  });

  it('should return 401 when invalid token provided', async () => {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
    });

    expect(response.status).toBe(401);

    const wwwAuth = response.headers.get('www-authenticate');
    expect(wwwAuth).toContain('error="invalid_token"');

    const body = await response.json();
    expect(body.error).toBe('invalid_token');
  });

  it('should allow access with valid token', async () => {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      }),
    });

    // The key assertion: with a valid token, we should NOT get a 401.
    // The OAuth middleware passed the request through to the MCP handler.
    expect(response.status).not.toBe(401);

    // The response should be from the MCP server, not the OAuth middleware
    const wwwAuth = response.headers.get('www-authenticate');
    expect(wwwAuth).toBeNull(); // No WWW-Authenticate means OAuth middleware didn't reject
  });

  it('should handle CORS preflight for metadata endpoint', async () => {
    const response = await fetch(`${SERVER_URL}/.well-known/oauth-protected-resource`, {
      method: 'OPTIONS',
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('should not protect non-MCP endpoints', async () => {
    const response = await fetch(`${SERVER_URL}/health`);
    // This returns 404 because the MCP server doesn't handle /health,
    // but importantly it doesn't return 401
    expect(response.status).not.toBe(401);
  });
});

// =============================================================================
// Tests demonstrating current authProvider passthrough
// =============================================================================

describe('MCPClient authProvider passthrough', () => {
  /**
   * This test demonstrates that Mastra's MCPClient currently supports
   * passing an authProvider to the underlying MCP SDK transports.
   *
   * Users can implement the full OAuthClientProvider interface to handle:
   * - Token storage and retrieval
   * - PKCE flow management
   * - Client registration
   * - Authorization redirects
   */
  it('should accept MastraOAuthClientProvider as authProvider', async () => {
    const provider = new MastraOAuthClientProvider({
      redirectUrl: 'http://localhost:3000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:3000/callback'],
        client_name: 'Test Client',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      onRedirectToAuthorization: url => {
        // In a real app, this would redirect the user
        console.log(`Would redirect to: ${url}`);
      },
    });

    // Verify the provider implements the expected interface
    expect(provider.redirectUrl).toBeDefined();
    expect(provider.clientMetadata).toBeDefined();
    expect(typeof provider.tokens).toBe('function');
    expect(typeof provider.saveTokens).toBe('function');
    expect(typeof provider.saveCodeVerifier).toBe('function');
    expect(typeof provider.codeVerifier).toBe('function');
    expect(typeof provider.redirectToAuthorization).toBe('function');
    expect(typeof provider.clientInformation).toBe('function');
    expect(typeof provider.saveClientInformation).toBe('function');
    expect(typeof provider.invalidateCredentials).toBe('function');
  });
});
