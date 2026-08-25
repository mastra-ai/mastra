import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for auth action hooks (SSO login, logout).
 *
 * Covers issue https://github.com/mastra-ai/mastra/issues/13901:
 * - useSSOLogin should use client.options.apiPrefix instead of hardcoded /api
 * - useLogout should use client.options.apiPrefix instead of hardcoded /api
 */

// Helper to create a mock response
const createMockResponse = (data: unknown): Response =>
  ({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe('auth actions — apiPrefix support (issue #13901)', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('SSO login URL construction', () => {
    it('should use custom apiPrefix for SSO login URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com/login' }));

      // Extract the mutation function logic directly from the module
      const { makeSSOLoginRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra',
        },
      };

      await makeSSOLoginRequest(mockClient as any, { redirectUri: 'http://localhost:4111/agents' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('http://localhost:4000/mastra/auth/sso/login');
    });

    it('should default to /api for SSO login URL when no apiPrefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com/login' }));

      const { makeSSOLoginRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
        },
      };

      await makeSSOLoginRequest(mockClient as any, {});

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('http://localhost:4000/api/auth/sso/login');
    });
  });

  describe('Logout URL construction', () => {
    it('should use custom apiPrefix for logout URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const { makeLogoutRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra',
        },
      };

      await makeLogoutRequest(mockClient as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/mastra/auth/logout');
    });

    it('should default to /api for logout URL when no apiPrefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const { makeLogoutRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
        },
      };

      await makeLogoutRequest(mockClient as any);

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/api/auth/logout');
    });
  });

  describe('Client header forwarding', () => {
    it('should forward client.options.headers on SSO login request', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com/login' }));

      const { makeSSOLoginRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'x-tenant-id': 'tenant-123',
            Authorization: 'Bearer dev-token',
          },
        },
      };

      await makeSSOLoginRequest(mockClient as any, {});

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toMatchObject({
        'x-tenant-id': 'tenant-123',
        Authorization: 'Bearer dev-token',
      });
    });

    it('should forward client.options.headers on logout request', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const { makeLogoutRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'x-tenant-id': 'tenant-123',
            Authorization: 'Bearer dev-token',
          },
        },
      };

      await makeLogoutRequest(mockClient as any);

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toMatchObject({
        'x-tenant-id': 'tenant-123',
        Authorization: 'Bearer dev-token',
      });
    });

    it('should not allow client headers to override Content-Type on SSO login', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com/login' }));

      const { makeSSOLoginRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      };

      await makeSSOLoginRequest(mockClient as any, {});

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('should not allow client headers to override Content-Type on logout', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const { makeLogoutRequest } = await import('../use-auth-actions');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      };

      await makeLogoutRequest(mockClient as any);

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });
  });
  describe('prefix normalization', () => {
    const ssoUrlFor = async (apiPrefix: string) => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com' }));
      const { makeSSOLoginRequest } = await import('../use-auth-actions');
      await makeSSOLoginRequest({ options: { baseUrl: 'http://localhost:4000', apiPrefix } } as any, {});
      return (mockFetch.mock.calls[0] as [string, RequestInit])[0];
    };

    const logoutUrlFor = async (apiPrefix: string) => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));
      const { makeLogoutRequest } = await import('../use-auth-actions');
      await makeLogoutRequest({ options: { baseUrl: 'http://localhost:4000', apiPrefix } } as any);
      return (mockFetch.mock.calls[0] as [string, RequestInit])[0];
    };

    it('adds a missing leading slash on the SSO url', async () => {
      expect(await ssoUrlFor('mastra')).toBe('http://localhost:4000/mastra/auth/sso/login');
    });

    it('drops a trailing slash on the SSO url', async () => {
      expect(await ssoUrlFor('/mastra/')).toBe('http://localhost:4000/mastra/auth/sso/login');
    });

    it('trims whitespace on the SSO url', async () => {
      expect(await ssoUrlFor('  /mastra  ')).toBe('http://localhost:4000/mastra/auth/sso/login');
    });

    it('adds a missing leading slash on the logout url', async () => {
      expect(await logoutUrlFor('mastra')).toBe('http://localhost:4000/mastra/auth/logout');
    });

    it('drops a trailing slash on the logout url', async () => {
      expect(await logoutUrlFor('/mastra/')).toBe('http://localhost:4000/mastra/auth/logout');
    });

    it('trims whitespace on the logout url', async () => {
      expect(await logoutUrlFor('  /mastra  ')).toBe('http://localhost:4000/mastra/auth/logout');
    });
  });

  describe('SSO login redirect', () => {
    it('forwards the redirect target the caller asked for', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com' }));
      const { makeSSOLoginRequest } = await import('../use-auth-actions');

      await makeSSOLoginRequest({ options: { baseUrl: 'http://x' } } as any, {
        redirectUri: 'http://x/agents?tab=chat',
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(new URL(url).searchParams.get('redirect_uri')).toBe('http://x/agents?tab=chat');
    });

    it('omits the query string entirely when no redirect is given', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com' }));
      const { makeSSOLoginRequest } = await import('../use-auth-actions');

      await makeSSOLoginRequest({ options: { baseUrl: 'http://x' } } as any, {});

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://x/api/auth/sso/login');
    });

    it('omits the query string for an empty redirect', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com' }));
      const { makeSSOLoginRequest } = await import('../use-auth-actions');

      await makeSSOLoginRequest({ options: { baseUrl: 'http://x' } } as any, { redirectUri: '' });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://x/api/auth/sso/login');
    });

    it('sends the session cookie', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com' }));
      const { makeSSOLoginRequest } = await import('../use-auth-actions');

      await makeSSOLoginRequest({ options: { baseUrl: 'http://x' } } as any, {});

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(options.credentials).toBe('include');
    });
  });

  describe('logout request', () => {
    it('posts, rather than reading', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));
      const { makeLogoutRequest } = await import('../use-auth-actions');

      await makeLogoutRequest({ options: { baseUrl: 'http://x' } } as any);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('include');
    });
  });

  describe('when the server rejects the request', () => {
    it('reports the status on an SSO failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) } as unknown as Response);
      const { makeSSOLoginRequest } = await import('../use-auth-actions');

      await expect(makeSSOLoginRequest({ options: {} } as any, {})).rejects.toThrow(
        'Failed to initiate SSO login: 503',
      );
    });

    it('reports the status on a logout failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) } as unknown as Response);
      const { makeLogoutRequest } = await import('../use-auth-actions');

      await expect(makeLogoutRequest({ options: {} } as any)).rejects.toThrow('Failed to logout: 401');
    });

    it('does not fall through to parsing the body on failure', async () => {
      const json = vi.fn();
      mockFetch.mockResolvedValue({ ok: false, status: 500, json } as unknown as Response);
      const { makeLogoutRequest } = await import('../use-auth-actions');

      await expect(makeLogoutRequest({ options: {} } as any)).rejects.toThrow();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe('when the client carries no base url', () => {
    // `MastraReactProvider` always supplies one, so the request builders' own
    // fallback is only reachable by calling them directly.
    it('sends the SSO login to a path relative to the current origin', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ url: 'https://sso.example.com/login' }));
      const { makeSSOLoginRequest } = await import('../use-auth-actions');

      await makeSSOLoginRequest({ options: {} } as never, {});

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url.startsWith('/api/auth/sso/login')).toBe(true);
    });

    it('sends the logout to a path relative to the current origin', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));
      const { makeLogoutRequest } = await import('../use-auth-actions');

      await makeLogoutRequest({ options: {} } as never);

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/auth/logout');
    });
  });
});
