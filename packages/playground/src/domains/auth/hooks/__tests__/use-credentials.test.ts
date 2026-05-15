import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for credentials auth hooks (sign-in, sign-up).
 *
 * Covers issue https://github.com/mastra-ai/mastra/issues/16460:
 * - useCredentialsLogin should use client.options.apiPrefix instead of hardcoded /api
 * - useCredentialsSignUp should use client.options.apiPrefix instead of hardcoded /api
 */

// The hook modules import from '@mastra/react' (workspace package), which
// transitively loads @mastra/client-js / @mastra/core. We only exercise the
// pure `makeCredentials*Request` helpers here, so stub the React entrypoint
// to keep the test fast and avoid needing the full monorepo to be built.
vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ options: {} }),
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({}),
  useQueryClient: () => ({ invalidateQueries: () => {} }),
}));

const createMockResponse = (data: unknown, ok = true): Response =>
  ({
    ok,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe('credentials auth — apiPrefix support (issue #16460)', () => {
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

  describe('Credentials sign-in URL construction', () => {
    it('should use custom apiPrefix for sign-in URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra',
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });

    it('should default to /api for sign-in URL when no apiPrefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/api/auth/credentials/sign-in');
    });

    it('should strip a trailing slash from apiPrefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra/',
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });

    it('should add a leading slash when apiPrefix has none', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: 'mastra',
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });

    it('should honor an explicitly empty apiPrefix for sign-in URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '',
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/auth/credentials/sign-in');
    });
  });

  describe('Credentials sign-up URL construction', () => {
    it('should use custom apiPrefix for sign-up URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra',
        },
      };

      await makeCredentialsSignUpRequest(mockClient as any, {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/mastra/auth/credentials/sign-up');
    });

    it('should default to /api for sign-up URL when no apiPrefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
        },
      };

      await makeCredentialsSignUpRequest(mockClient as any, {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/api/auth/credentials/sign-up');
    });

    it('should strip a trailing slash from apiPrefix', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '/mastra/',
        },
      };

      await makeCredentialsSignUpRequest(mockClient as any, {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/mastra/auth/credentials/sign-up');
    });

    it('should honor an explicitly empty apiPrefix for sign-up URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          apiPrefix: '',
        },
      };

      await makeCredentialsSignUpRequest(mockClient as any, {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:4000/auth/credentials/sign-up');
    });
  });

  describe('Client header forwarding', () => {
    it('should forward client.options.headers on sign-in request', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'x-tenant-id': 'tenant-123',
            Authorization: 'Bearer dev-token',
          },
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toMatchObject({
        'x-tenant-id': 'tenant-123',
        Authorization: 'Bearer dev-token',
      });
    });

    it('should forward client.options.headers on sign-up request', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'x-tenant-id': 'tenant-123',
            Authorization: 'Bearer dev-token',
          },
        },
      };

      await makeCredentialsSignUpRequest(mockClient as any, {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toMatchObject({
        'x-tenant-id': 'tenant-123',
        Authorization: 'Bearer dev-token',
      });
    });

    it('should not allow client headers to override Content-Type on sign-in', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      };

      await makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('should not allow client headers to override Content-Type on sign-up', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ user: { id: '1', email: 'a@b.c' } }));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = {
        options: {
          baseUrl: 'http://localhost:4000',
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      };

      await makeCredentialsSignUpRequest(mockClient as any, {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });
  });

  describe('Error handling', () => {
    it('should throw with server error message on sign-in failure', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: 'Invalid email or password' }, false));

      const { makeCredentialsLoginRequest } = await import('../use-credentials-login');
      const mockClient = { options: { baseUrl: 'http://localhost:4000' } };

      await expect(makeCredentialsLoginRequest(mockClient as any, { email: 'a@b.c', password: 'pw' })).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('should throw with server error message on sign-up failure', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: 'Email already in use' }, false));

      const { makeCredentialsSignUpRequest } = await import('../use-credentials-signup');
      const mockClient = { options: { baseUrl: 'http://localhost:4000' } };

      await expect(
        makeCredentialsSignUpRequest(mockClient as any, {
          email: 'a@b.c',
          password: 'pw',
          name: 'A',
        }),
      ).rejects.toThrow('Email already in use');
    });
  });
});
