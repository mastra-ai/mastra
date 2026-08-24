import type { MastraClient } from '@mastra/client-js';
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

/**
 * `makeAuthCapabilitiesRequest` reads only `client.options`, so a stub narrowed
 * to that field is enough — and it keeps the options themselves type-checked.
 */
const clientWith = (options: MastraClient['options']) => ({ options }) as Pick<MastraClient, 'options'> as MastraClient;

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
      const mockClient = clientWith({
        baseUrl: 'http://localhost:3000',
        headers: {
          'x-mastra-dev-playground': 'true',
          'x-custom-header': 'custom-value',
        },
      });

      // Mock response
      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      // We need to test the actual fetch call logic
      // Since the hook uses react-query, we'll extract and test the queryFn directly
      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient);

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
      const mockClient = clientWith({
        baseUrl: 'http://localhost:3000',
      });

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient);

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
      const mockClient = clientWith({});

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient);

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
      const mockClient = clientWith({
        baseUrl: 'http://localhost:4000',
        apiPrefix: '/mastra',
      });

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('http://localhost:4000/mastra/auth/capabilities');
    });

    it('should default to /api when apiPrefix is not set', async () => {
      const mockClient = clientWith({
        baseUrl: 'http://localhost:4000',
      });

      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(mockClient);

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/api/auth/capabilities');
    });
  });

  describe('apiPrefix normalization', () => {
    const urlForPrefix = async (apiPrefix: string) => {
      mockFetch.mockResolvedValue(createMockResponse({ enabled: false, login: null }));
      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');
      await makeAuthCapabilitiesRequest(clientWith({ baseUrl: 'http://localhost:4000', apiPrefix }));
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      return url;
    };

    it('adds the leading slash a hand-typed prefix is missing', async () => {
      expect(await urlForPrefix('mastra')).toBe('http://localhost:4000/mastra/auth/capabilities');
    });

    it('drops a trailing slash so the path does not double up', async () => {
      expect(await urlForPrefix('/mastra/')).toBe('http://localhost:4000/mastra/auth/capabilities');
    });

    it('trims surrounding whitespace', async () => {
      expect(await urlForPrefix('  /mastra  ')).toBe('http://localhost:4000/mastra/auth/capabilities');
    });

    // A whitespace-only prefix is truthy, so it never reaches the `/api`
    // fallback: it trims to '', becomes '/', and the trailing slash is dropped.
    // An explicitly empty prefix is falsy and does fall back — the two differ.
    it('resolves a whitespace-only prefix to no prefix at all', async () => {
      expect(await urlForPrefix('   ')).toBe('http://localhost:4000/auth/capabilities');
    });

    it('falls back to /api for an empty prefix', async () => {
      expect(await urlForPrefix('')).toBe('http://localhost:4000/api/auth/capabilities');
    });
  });

  describe('when the server rejects the request', () => {
    it('throws with the status so the caller can gate on it', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) } as unknown as Response);

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');

      await expect(makeAuthCapabilitiesRequest(clientWith({}))).rejects.toThrow(
        'Failed to fetch auth capabilities: 403',
      );
    });

    it('does not fall through to parsing the body', async () => {
      const json = vi.fn();
      mockFetch.mockResolvedValue({ ok: false, status: 500, json } as unknown as Response);

      const { makeAuthCapabilitiesRequest } = await import('../use-auth-capabilities');

      await expect(makeAuthCapabilitiesRequest(clientWith({}))).rejects.toThrow();
      expect(json).not.toHaveBeenCalled();
    });
  });
});
