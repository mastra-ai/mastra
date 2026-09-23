import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the logout action.
 *
 * Covers issue https://github.com/mastra-ai/mastra/issues/13901:
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
});
