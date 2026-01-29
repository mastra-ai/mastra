/**
 * Transport layer tests for MastraCloudClient.
 * Tests all HTTP communication with Mastra Cloud API.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraCloudClient, CloudApiError } from './client';

describe('MastraCloudClient', () => {
  let client: MastraCloudClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = new MastraCloudClient({ projectId: 'test-project' });
    originalFetch = global.fetch;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  // ============================================
  // verifyToken
  // ============================================

  describe('verifyToken', () => {
    it('returns user on valid token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              user: {
                id: 'user-123',
                email: 'test@example.com',
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
      });

      const user = await client.verifyToken({ token: 'valid-token' });

      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
        }),
      );
    });

    it('returns null on invalid token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            error: { message: 'Invalid token', status: 401 },
          }),
      });

      const user = await client.verifyToken({ token: 'invalid' });
      expect(user).toBeNull();
    });
  });

  // ============================================
  // getUser
  // ============================================

  describe('getUser', () => {
    it('returns user on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              user: {
                id: 'user-456',
                email: 'user@example.com',
                name: 'Test User',
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
      });

      const user = await client.getUser({ userId: 'user-456', token: 'auth-token' });

      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-456',
          email: 'user@example.com',
          name: 'Test User',
        }),
      );
    });

    it('returns null on failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({
            ok: false,
            error: { message: 'User not found', status: 404 },
          }),
      });

      const user = await client.getUser({ userId: 'nonexistent', token: 'auth-token' });
      expect(user).toBeNull();
    });
  });

  // ============================================
  // getUserPermissions
  // ============================================

  describe('getUserPermissions', () => {
    it('returns permissions array on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              permissions: ['read:agents', 'write:agents', 'read:workflows'],
            },
          }),
      });

      const permissions = await client.getUserPermissions({ userId: 'user-123', token: 'auth-token' });

      expect(permissions).toEqual(['read:agents', 'write:agents', 'read:workflows']);
    });

    it('returns empty array on failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            ok: false,
            error: { message: 'Unauthorized', status: 401 },
          }),
      });

      const permissions = await client.getUserPermissions({ userId: 'user-123', token: 'bad-token' });
      expect(permissions).toEqual([]);
    });
  });

  // ============================================
  // getLoginUrl
  // ============================================

  describe('getLoginUrl', () => {
    it('constructs URL with /auth/oss path and required params', () => {
      const url = client.getLoginUrl({
        redirectUri: 'http://localhost:3000/callback',
        state: 'random-state-123',
      });

      expect(url).toContain('https://cloud.mastra.ai/auth/oss');
      expect(url).toContain('project_id=test-project');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(url).toContain('state=random-state-123');
    });

    it('uses custom baseUrl when provided', () => {
      const customClient = new MastraCloudClient({
        projectId: 'test-project',
        baseUrl: 'https://custom.mastra.ai',
      });

      const url = customClient.getLoginUrl({
        redirectUri: 'http://localhost/callback',
        state: 'state',
      });

      expect(url).toContain('https://custom.mastra.ai/auth/oss');
    });
  });

  // ============================================
  // exchangeCode
  // ============================================

  describe('exchangeCode', () => {
    it('returns user, session, and jwt on success', async () => {
      const mockJwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.signature';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              user: {
                id: 'user-123',
                email: 'test@example.com',
                created_at: '2026-01-01T00:00:00Z',
              },
              session: {
                id: 'session-abc',
                user_id: 'user-123',
                expires_at: '2026-02-01T00:00:00Z',
                created_at: '2026-01-01T00:00:00Z',
              },
              jwt: mockJwt,
            },
          }),
      });

      const result = await client.exchangeCode({ code: 'auth-code-123' });

      expect(result.user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          sessionToken: mockJwt,
        }),
      );
      expect(result.session).toEqual(
        expect.objectContaining({
          id: 'session-abc',
          userId: 'user-123',
        }),
      );
      expect(result.jwt).toBe(mockJwt);
    });
  });

  // ============================================
  // validateSession
  // ============================================

  describe('validateSession', () => {
    it('returns session on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              session: {
                id: 'session-123',
                user_id: 'user-456',
                expires_at: '2026-02-01T00:00:00Z',
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
      });

      const session = await client.validateSession({ sessionToken: 'valid-token' });

      expect(session).toEqual(
        expect.objectContaining({
          id: 'session-123',
          userId: 'user-456',
        }),
      );
    });

    it('returns null on invalid session', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            error: { message: 'Invalid session', status: 401 },
          }),
      });

      const session = await client.validateSession({ sessionToken: 'expired-token' });
      expect(session).toBeNull();
    });
  });

  // ============================================
  // destroySession
  // ============================================

  describe('destroySession', () => {
    it('makes correct request with sessionId and token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: {} }),
      });

      await client.destroySession({ sessionId: 'session-to-destroy', token: 'auth-token' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/session/destroy'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'session-to-destroy' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token',
          }),
        }),
      );
    });
  });

  // ============================================
  // CloudApiError
  // ============================================

  describe('CloudApiError', () => {
    it('is thrown on API failure with correct status and code', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            ok: false,
            error: {
              message: 'Forbidden',
              status: 403,
              code: 'forbidden',
            },
          }),
      });

      // exchangeCode does NOT swallow errors (unlike verifyToken/getUser)
      await expect(client.exchangeCode({ code: 'bad-code' })).rejects.toThrow(CloudApiError);

      try {
        await client.exchangeCode({ code: 'bad-code' });
      } catch (error) {
        expect(error).toBeInstanceOf(CloudApiError);
        expect((error as CloudApiError).status).toBe(403);
        expect((error as CloudApiError).code).toBe('forbidden');
        expect((error as CloudApiError).message).toBe('Forbidden');
      }
    });

    it('works with instanceof check', () => {
      const error = new CloudApiError('Test error', 500, 'test_code');

      expect(error instanceof CloudApiError).toBe(true);
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('CloudApiError');
    });
  });

  // ============================================
  // Authorization header
  // ============================================

  describe('request() Authorization header', () => {
    it('sends Bearer token when token provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              user: {
                id: 'user-123',
                email: 'test@example.com',
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
      });

      await client.getUser({ userId: 'user-123', token: 'my-auth-token' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-auth-token',
          }),
        }),
      );
    });

    it('includes X-Project-ID header on all requests', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: { user: { id: '1', email: 'a@b.com', created_at: '2026-01-01T00:00:00Z' } },
          }),
      });

      await client.verifyToken({ token: 'token' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Project-ID': 'test-project',
          }),
        }),
      );
    });
  });

  // ============================================
  // response.ok vs json.ok
  // ============================================

  describe('response.ok vs json.ok', () => {
    it('handles 200 with ok:false (throws CloudApiError)', async () => {
      // Cloud API sometimes returns HTTP 200 but ok:false in body
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true, // HTTP 200
        status: 200,
        json: () =>
          Promise.resolve({
            ok: false, // But API says failure
            error: {
              message: 'Business logic error',
              status: 400,
              code: 'validation_error',
            },
          }),
      });

      // exchangeCode propagates errors
      await expect(client.exchangeCode({ code: 'code' })).rejects.toThrow(CloudApiError);

      try {
        await client.exchangeCode({ code: 'code' });
      } catch (error) {
        expect(error).toBeInstanceOf(CloudApiError);
        expect((error as CloudApiError).status).toBe(400);
        expect((error as CloudApiError).code).toBe('validation_error');
      }
    });

    it('handles non-JSON responses', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('Not JSON')),
      });

      await expect(client.exchangeCode({ code: 'code' })).rejects.toThrow(CloudApiError);

      try {
        await client.exchangeCode({ code: 'code' });
      } catch (error) {
        expect(error).toBeInstanceOf(CloudApiError);
        expect((error as CloudApiError).status).toBe(502);
        expect((error as CloudApiError).message).toContain('502');
      }
    });
  });
});
