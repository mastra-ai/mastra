/**
 * Tests for auth route handlers.
 *
 * Covers server-side issues from https://github.com/mastra-ai/mastra/issues/13901:
 * - SSO login handler should use routePrefix for callback URI (not hardcoded /api)
 * - SSO callback handler should allow cross-origin post-login redirects
 * - Capabilities handler should pass routePrefix to buildCapabilities
 */

import { Mastra } from '@mastra/core';
import type { MastraAuthProvider, MastraServerConfig } from '@mastra/core/server';
import { describe, it, expect, vi } from 'vitest';

import { GET_AUTH_CAPABILITIES_ROUTE, GET_SSO_LOGIN_ROUTE, GET_SSO_CALLBACK_ROUTE, getPublicOrigin } from './auth';
import { createTestServerContext } from './test-utils';

// =============================================================================
// Mock Auth Provider
// =============================================================================

function createMockSSOProvider() {
  return {
    name: 'mock-sso',
    authenticateToken: vi.fn().mockResolvedValue(null),
    authorizeUser: vi.fn().mockResolvedValue(true),

    // ISSOProvider
    getLoginUrl: vi.fn((redirectUri: string, state: string) => {
      return `https://sso.example.com/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    }),
    getLoginButtonConfig: vi.fn(() => ({
      provider: 'mock',
      text: 'Sign in with Mock',
    })),
    handleCallback: vi.fn(async () => ({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      cookies: ['session=abc; Path=/; HttpOnly'],
    })),

    // Bypass EE license requirement in tests
    isSimpleAuth: true,
  } as unknown as MastraAuthProvider;
}

function createMastraWithAuth(auth: MastraAuthProvider): Mastra {
  const mastra = new Mastra({ logger: false });
  const originalGetServer = mastra.getServer.bind(mastra);
  vi.spyOn(mastra, 'getServer').mockImplementation(() => {
    const server = originalGetServer() || ({} as MastraServerConfig);
    return { ...server, auth } as MastraServerConfig;
  });
  return mastra;
}

// =============================================================================
// Issue #3: SSO login handler hardcodes /api/ in callback URI
// =============================================================================

describe('GET /auth/sso/login — callback URI prefix', () => {
  it('should use routePrefix for the OAuth callback URI instead of hardcoded /api', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/mastra/auth/sso/login');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      routePrefix: '/mastra',
      redirect_uri: undefined,
    };

    await GET_SSO_LOGIN_ROUTE.handler(ctx as any);

    expect(mockAuth.getLoginUrl).toHaveBeenCalledOnce();
    const callbackUri = (mockAuth.getLoginUrl as any).mock.calls[0][0];

    expect(callbackUri).toBe('http://localhost:4000/mastra/auth/sso/callback');
    expect(callbackUri).not.toContain('/api/');
  });

  it('should default to /api prefix when routePrefix is not provided', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/api/auth/sso/login');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      redirect_uri: undefined,
    };

    await GET_SSO_LOGIN_ROUTE.handler(ctx as any);

    const callbackUri = (mockAuth.getLoginUrl as any).mock.calls[0][0];
    expect(callbackUri).toBe('http://localhost:4000/api/auth/sso/callback');
  });

  it('should handle routePrefix with trailing slash', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/custom-api/auth/sso/login');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      routePrefix: '/custom-api/',
      redirect_uri: undefined,
    };

    await GET_SSO_LOGIN_ROUTE.handler(ctx as any);

    const callbackUri = (mockAuth.getLoginUrl as any).mock.calls[0][0];
    expect(callbackUri).toBe('http://localhost:4000/custom-api/auth/sso/callback');
  });

  it('should reject external redirect_uri to prevent open-redirect attacks', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/api/auth/sso/login');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      redirect_uri: 'https://evil.com/phish',
    };

    await GET_SSO_LOGIN_ROUTE.handler(ctx as any);

    // The state should encode '/' (fallback) not the evil URL
    const stateArg = (mockAuth.getLoginUrl as any).mock.calls[0][1] as string;
    const [, encodedRedirect] = stateArg.split('|', 2);
    const decodedRedirect = decodeURIComponent(encodedRedirect);
    expect(decodedRedirect).toBe('/');
  });

  it('should allow localhost redirect_uri on different port', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/api/auth/sso/login');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      redirect_uri: 'http://localhost:4111/agents',
    };

    await GET_SSO_LOGIN_ROUTE.handler(ctx as any);

    const stateArg = (mockAuth.getLoginUrl as any).mock.calls[0][1] as string;
    const [, encodedRedirect] = stateArg.split('|', 2);
    const decodedRedirect = decodeURIComponent(encodedRedirect);
    expect(decodedRedirect).toBe('http://localhost:4111/agents');
  });
});

// =============================================================================
// Issue #4: SSO callback rejects cross-origin post-login redirects
// =============================================================================

describe('GET /auth/sso/callback — cross-origin redirect', () => {
  it('should allow cross-origin redirect when Studio runs on a different port', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const studioRedirect = 'http://localhost:4111/agents';
    const state = `some-uuid|${encodeURIComponent(studioRedirect)}`;

    const request = new Request(
      `http://localhost:4000/api/auth/sso/callback?code=auth-code-123&state=${encodeURIComponent(state)}`,
    );
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      code: 'auth-code-123',
      state,
    };

    const response = (await GET_SSO_CALLBACK_ROUTE.handler(ctx as any)) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(studioRedirect);
  });

  it('should redirect to baseUrl root when no redirect is specified in state', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/api/auth/sso/callback?code=auth-code-123');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      code: 'auth-code-123',
      state: undefined,
    };

    const response = (await GET_SSO_CALLBACK_ROUTE.handler(ctx as any)) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('http://localhost:4000/');
  });

  it('should reject redirect to external origin (open-redirect prevention)', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const externalRedirect = 'https://evil.com/phish';
    const state = `some-uuid|${encodeURIComponent(externalRedirect)}`;

    const request = new Request(
      `http://localhost:4000/api/auth/sso/callback?code=auth-code-123&state=${encodeURIComponent(state)}`,
    );
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      code: 'auth-code-123',
      state,
    };

    const response = (await GET_SSO_CALLBACK_ROUTE.handler(ctx as any)) as Response;

    expect(response.status).toBe(302);
    // Should fall back to baseUrl, NOT redirect to evil.com
    expect(response.headers.get('Location')).toBe('http://localhost:4000/');
  });
});

// =============================================================================
// Issue #5: Capabilities handler should pass routePrefix to buildCapabilities
// =============================================================================

describe('GET /auth/capabilities — SSO URL respects routePrefix', () => {
  it('should return SSO login URL with custom routePrefix', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/mastra/auth/capabilities');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
      routePrefix: '/mastra',
    };

    const result = (await GET_AUTH_CAPABILITIES_ROUTE.handler(ctx as any)) as any;

    expect(result.enabled).toBe(true);
    expect(result.login).not.toBeNull();
    expect(result.login.sso.url).toBe('/mastra/auth/sso/login');
  });

  it('should default to /api in SSO login URL when no routePrefix', async () => {
    const mockAuth = createMockSSOProvider();
    const mastra = createMastraWithAuth(mockAuth);

    const request = new Request('http://localhost:4000/api/auth/capabilities');
    const ctx = {
      ...createTestServerContext({ mastra }),
      request,
    };

    const result = (await GET_AUTH_CAPABILITIES_ROUTE.handler(ctx as any)) as any;

    expect(result.enabled).toBe(true);
    expect(result.login.sso.url).toBe('/api/auth/sso/login');
  });
});

// =============================================================================
// getPublicOrigin — X-Forwarded-Host parsing
// =============================================================================

describe('getPublicOrigin', () => {
  it('returns origin from x-forwarded-host when present', () => {
    const request = new Request('http://internal:3000/api/auth/sso/login', {
      headers: { 'X-Forwarded-Host': 'app.example.com' },
    });
    expect(getPublicOrigin(request)).toBe('https://app.example.com');
  });

  it('uses only the first value from a multi-value x-forwarded-host', () => {
    const request = new Request('http://internal:3000/api/auth/sso/login', {
      headers: {
        'X-Forwarded-Host': 'my-project.studio.mastra.cloud, 3000-abc123.daytonaproxy01.net',
      },
    });
    expect(getPublicOrigin(request)).toBe('https://my-project.studio.mastra.cloud');
  });

  it('falls back to request.url origin when x-forwarded-host is absent', () => {
    const request = new Request('http://localhost:3000/api/auth/sso/login');
    expect(getPublicOrigin(request)).toBe('http://localhost:3000');
  });
});
