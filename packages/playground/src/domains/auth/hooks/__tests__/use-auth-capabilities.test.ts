import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for useAuthCapabilities hook.
 *
 * The key regression this tests is that the hook must pass the MastraClient's
 * headers (including x-mastra-dev-playground) to the auth capabilities endpoint.
 * Without this, the UI would show a login gate even in dev playground mode
 * where the server bypasses auth.
 */

// Helper to create a mock response
const createMockResponse = (data: unknown): Response =>
  ({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe('useAuthCapabilities', () => {
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

  describe('client headers are passed to fetch', () => {
    it('should include x-mastra-dev-playground header from client in fetch request', async () => {
      // Mock the client with headers that include x-mastra-dev-playground
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:3000',
          headers: {
            'x-mastra-dev-playground': 'true',
            'x-custom-header': 'custom-value',
          },
        },
      };

      // Mock response
      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      // We need to test the actual fetch call logic
      // Since the hook uses react-query, we'll extract and test the queryFn directly
      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient as any);

      // Verify fetch was called with the client's headers
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('http://localhost:3000/api/auth/capabilities');
      expect(options.credentials).toBe('include');
      expect(options.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
          'x-mastra-dev-playground': 'true',
          'x-custom-header': 'custom-value',
        }),
      );
    });

    it('should work when client has no custom headers', async () => {
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:3000',
        },
      };

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];

      expect(options.credentials).toBe('include');
      expect(options.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      );
    });

    it('should work when client options has no baseUrl or headers', async () => {
      const mockClient = {
        options: {},
      };

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

      // Should still work, just with empty base URL
      expect(url).toBe('/api/auth/capabilities');
      expect(options.credentials).toBe('include');
      expect(options.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      );
    });
  });

  describe('apiPrefix support (issue #13901)', () => {
    it('should use custom apiPrefix instead of hardcoded /api', async () => {
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra',
        },
      };

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('http://localhost:4000/mastra/auth/capabilities');
    });

    it('should default to /api when apiPrefix is not set', async () => {
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
        },
      };

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient as any);

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/api/auth/capabilities');
    });
  });
});
