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
});
