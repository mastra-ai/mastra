import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { CloudUser } from './types';

import { MastraAuthCloud } from './index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console.error to avoid noise in tests
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('MastraAuthCloud', () => {
  const mockApiKey = 'test-api-key';
  const mockEndpoint = 'https://api.test.mastra.cloud';

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MASTRA_CLOUD_API_KEY;
  });

  afterEach(() => {
    delete process.env.MASTRA_CLOUD_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with default endpoint when no config provided', () => {
      const auth = new MastraAuthCloud();
      expect(auth.isMastraCloudAuth).toBe(true);
      expect(auth.sso).toBeDefined();
      expect(auth.rbac).toBeDefined();
    });

    it('should initialize with provided config', () => {
      const auth = new MastraAuthCloud({
        apiKey: mockApiKey,
        endpoint: mockEndpoint,
      });

      expect(auth.isMastraCloudAuth).toBe(true);
      expect(auth.sso).toBeDefined();
      expect(auth.rbac).toBeDefined();
    });

    it('should use environment variable for API key', () => {
      process.env.MASTRA_CLOUD_API_KEY = mockApiKey;

      const auth = new MastraAuthCloud();
      expect(auth.isMastraCloudAuth).toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    const mockCloudAPIUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://example.com/avatar.png',
      metadata: { custom: 'data' },
      organization_id: 'org-123',
      role: 'admin',
      email_verified: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    it('should return null when no cookie header', async () => {
      const auth = new MastraAuthCloud({ apiKey: mockApiKey });
      const request = new Request('https://example.com', {
        headers: {},
      });

      const result = await auth.getCurrentUser(request);
      expect(result).toBeNull();
    });

    it('should return null when no session cookie', async () => {
      const auth = new MastraAuthCloud({ apiKey: mockApiKey });
      const request = new Request('https://example.com', {
        headers: {
          cookie: 'other_cookie=value',
        },
      });

      const result = await auth.getCurrentUser(request);
      expect(result).toBeNull();
    });

    it('should return null when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const auth = new MastraAuthCloud({ apiKey: mockApiKey });
      const request = new Request('https://example.com', {
        headers: {
          cookie: 'mastra_cloud_session=test-session-token',
        },
      });

      const result = await auth.getCurrentUser(request);
      expect(result).toBeNull();
    });

    it('should return user when valid session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockCloudAPIUser }),
      });

      const auth = new MastraAuthCloud({ apiKey: mockApiKey, endpoint: mockEndpoint });
      const request = new Request('https://example.com', {
        headers: {
          cookie: 'mastra_cloud_session=test-session-token',
        },
      });

      const result = await auth.getCurrentUser(request);

      expect(mockFetch).toHaveBeenCalledWith(`${mockEndpoint}/v1/auth/me`, {
        headers: {
          Authorization: 'Bearer test-session-token',
          'X-API-Key': mockApiKey,
        },
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        metadata: { custom: 'data' },
        cloud: {
          userId: 'user-123',
          organizationId: 'org-123',
          role: 'admin',
          emailVerified: true,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle session token with = characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockCloudAPIUser }),
      });

      const auth = new MastraAuthCloud({ apiKey: mockApiKey, endpoint: mockEndpoint });
      const request = new Request('https://example.com', {
        headers: {
          cookie: 'mastra_cloud_session=token==base64==',
        },
      });

      await auth.getCurrentUser(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token==base64==',
          }),
        }),
      );
    });

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const auth = new MastraAuthCloud({ apiKey: mockApiKey });
      const request = new Request('https://example.com', {
        headers: {
          cookie: 'mastra_cloud_session=test-session-token',
        },
      });

      const result = await auth.getCurrentUser(request);
      expect(result).toBeNull();
    });
  });

  describe('SSO provider', () => {
    it('should generate login URL', () => {
      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const redirectUri = 'https://myapp.com/callback';
      const state = 'random-state';

      const loginUrl = auth.sso.getLoginUrl(redirectUri, state);

      expect(loginUrl).toBe(
        `${mockEndpoint}/v1/auth/sso/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      );
    });

    it('should generate login URL with custom domain', () => {
      const customDomain = 'https://auth.myapp.com';
      const auth = new MastraAuthCloud({ endpoint: mockEndpoint, customDomain });
      const redirectUri = 'https://myapp.com/callback';

      const loginUrl = auth.sso.getLoginUrl(redirectUri);

      expect(loginUrl).toBe(`${customDomain}/v1/auth/sso/login?redirect_uri=${encodeURIComponent(redirectUri)}`);
    });

    it('should generate logout URL', () => {
      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const redirectUri = 'https://myapp.com/';

      const logoutUrl = auth.sso.getLogoutUrl(redirectUri);

      expect(logoutUrl).toBe(`${mockEndpoint}/v1/auth/sso/logout?redirect_uri=${encodeURIComponent(redirectUri)}`);
    });

    it('should return login button config', () => {
      const auth = new MastraAuthCloud();
      const config = auth.sso.getLoginButtonConfig();

      expect(config).toEqual({
        provider: 'mastra-cloud',
        text: 'Sign in with Mastra Cloud',
        icon: 'https://mastra.ai/logo.svg',
        url: '',
      });
    });

    it('should handle SSO callback', async () => {
      const mockCallbackResponse = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        id_token: 'id-token',
        expires_at: '2024-12-31T23:59:59Z',
        session_token: 'session-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCallbackResponse),
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const result = await auth.sso.handleCallback('auth-code', 'state');

      expect(mockFetch).toHaveBeenCalledWith(`${mockEndpoint}/v1/auth/sso/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code', state: 'state' }),
      });

      expect(result.user.id).toBe('user-123');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.cookies.mastra_cloud_session).toContain('session-token');
    });

    it('should throw on SSO callback failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });

      await expect(auth.sso.handleCallback('invalid-code')).rejects.toThrow('SSO callback failed: Unauthorized');
    });
  });

  describe('RBAC provider', () => {
    const mockUser: CloudUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      metadata: {},
      cloud: {
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'admin',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it('should get roles from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ roles: ['admin', 'editor'] }),
      });

      const auth = new MastraAuthCloud({ apiKey: mockApiKey, endpoint: mockEndpoint });
      const roles = await auth.rbac.getRoles(mockUser);

      expect(mockFetch).toHaveBeenCalledWith(`${mockEndpoint}/v1/rbac/users/user-123/roles`, {
        headers: {
          'X-API-Key': mockApiKey,
        },
      });

      expect(roles).toEqual(['admin', 'editor']);
    });

    it('should fallback to user role when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const roles = await auth.rbac.getRoles(mockUser);

      expect(roles).toEqual(['admin']);
    });

    it('should check if user has role', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ roles: ['admin', 'editor'] }),
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const hasAdmin = await auth.rbac.hasRole(mockUser, 'admin');

      expect(hasAdmin).toBe(true);
    });

    it('should get permissions from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ permissions: ['agents:read', 'agents:write', 'tools:read'] }),
      });

      const auth = new MastraAuthCloud({ apiKey: mockApiKey, endpoint: mockEndpoint });
      const permissions = await auth.rbac.getPermissions(mockUser);

      expect(permissions).toEqual(['agents:read', 'agents:write', 'tools:read']);
    });

    it('should return empty permissions on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const permissions = await auth.rbac.getPermissions(mockUser);

      expect(permissions).toEqual([]);
    });

    it('should check exact permission match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ permissions: ['agents:read'] }),
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const hasPermission = await auth.rbac.hasPermission(mockUser, 'agents:read');

      expect(hasPermission).toBe(true);
    });

    it('should check wildcard permission match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ permissions: ['agents:*'] }),
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const hasPermission = await auth.rbac.hasPermission(mockUser, 'agents:read');

      expect(hasPermission).toBe(true);
    });

    it('should check super admin wildcard', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ permissions: ['*'] }),
      });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const hasPermission = await auth.rbac.hasPermission(mockUser, 'anything:anything');

      expect(hasPermission).toBe(true);
    });

    it('should check hasAllPermissions', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ permissions: ['agents:read', 'agents:write'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ permissions: ['agents:read', 'agents:write'] }),
        });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const hasAll = await auth.rbac.hasAllPermissions(mockUser, ['agents:read', 'agents:write']);

      expect(hasAll).toBe(true);
    });

    it('should check hasAnyPermission', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ permissions: ['tools:read'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ permissions: ['tools:read'] }),
        });

      const auth = new MastraAuthCloud({ endpoint: mockEndpoint });
      const hasAny = await auth.rbac.hasAnyPermission(mockUser, ['agents:read', 'tools:read']);

      expect(hasAny).toBe(true);
    });
  });
});
