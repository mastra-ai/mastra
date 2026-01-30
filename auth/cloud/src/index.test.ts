/**
 * Provider layer tests for MastraCloudAuth.
 * Tests all EE interface implementations (IUserProvider, ISessionProvider, ISSOProvider, IRBACProvider).
 */
import { decodeJwt } from 'jose';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraCloudAuth, CloudApiError } from './index';

// Mock jose module for JWT decode control
vi.mock('jose', () => ({
  decodeJwt: vi.fn(),
}));

describe('MastraCloudAuth', () => {
  let auth: MastraCloudAuth;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    auth = new MastraCloudAuth({ projectId: 'test-project' });
    originalFetch = global.fetch;
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  // ============================================
  // IUserProvider: getCurrentUser
  // ============================================

  describe('getCurrentUser', () => {
    it('returns null when JWT is expired', async () => {
      // Expired JWT - exp claim is in the past
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000) - 3600, // issued 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800, // expired 30 minutes ago
      });

      const request = new Request('http://localhost', {
        headers: { cookie: 'mastra_session=expired-jwt-token' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });

    it('extracts user from JWT in cookie', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        name: 'Test User',
        avatar: 'https://example.com/avatar.png',
        iat: Math.floor(Date.now() / 1000),
      });

      const request = new Request('http://localhost', {
        headers: { cookie: 'mastra_session=jwt-token-here' },
      });

      const user = await auth.getCurrentUser(request);

      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
          sessionToken: 'jwt-token-here',
        }),
      );
    });

    it('returns null when no cookie', async () => {
      const request = new Request('http://localhost');
      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });

    it('returns null when JWT decode fails', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid JWT');
      });

      const request = new Request('http://localhost', {
        headers: { cookie: 'mastra_session=invalid-jwt' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });
  });

  // ============================================
  // IUserProvider: getUser
  // ============================================

  describe('getUser', () => {
    it('delegates to client with token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              user: {
                id: 'user-456',
                email: 'user@example.com',
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
      });

      const user = await auth.getUser('user-456', 'auth-token');

      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-456',
          email: 'user@example.com',
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-456'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token',
          }),
        }),
      );
    });

    it('returns null without token', async () => {
      const user = await auth.getUser('user-456');
      expect(user).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // ISessionProvider: createSession
  // ============================================

  describe('createSession', () => {
    it('throws CloudApiError with status 501', async () => {
      await expect(auth.createSession('user-123')).rejects.toThrow(CloudApiError);
    });

    it('throws with code not_implemented', async () => {
      try {
        await auth.createSession('user-123');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudApiError);
        expect((error as CloudApiError).status).toBe(501);
        expect((error as CloudApiError).code).toBe('not_implemented');
      }
    });
  });

  // ============================================
  // ISessionProvider: validateSession
  // ============================================

  describe('validateSession', () => {
    it('delegates to client', async () => {
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

      const session = await auth.validateSession('session-token');

      expect(session).toEqual(
        expect.objectContaining({
          id: 'session-123',
          userId: 'user-456',
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/session/validate'), expect.any(Object));
    });
  });

  // ============================================
  // ISessionProvider: destroySession
  // ============================================

  describe('destroySession', () => {
    it('delegates to client', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: {} }),
      });

      await auth.destroySession('session-123', 'auth-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/session/destroy'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'session-123' }),
        }),
      );
    });
  });

  // ============================================
  // ISSOProvider: getLoginUrl
  // ============================================

  describe('getLoginUrl', () => {
    it('returns correct SSO URL', () => {
      const url = auth.getLoginUrl('http://localhost/callback', 'state-123');

      expect(url).toContain('https://cloud.mastra.ai/auth/oss');
      expect(url).toContain('project_id=test-project');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=state-123');
    });
  });

  // ============================================
  // ISSOProvider: handleCallback
  // ============================================

  describe('handleCallback', () => {
    it('exchanges code and returns SSOCallbackResult', async () => {
      const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature';

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

      // Mock decodeJwt to not throw (validates JWT format)
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({ sub: '123' });

      const result = await auth.handleCallback('auth-code', 'state');

      expect(result.user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
        }),
      );
      expect(result.tokens.accessToken).toBe(mockJwt);
      expect(result.tokens.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ============================================
  // IRBACProvider: getRoles
  // ============================================

  describe('getRoles', () => {
    it('returns empty array when JWT is expired', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // expired
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'expired-jwt',
        createdAt: new Date(),
      };

      const roles = await auth.getRoles(user);
      expect(roles).toEqual([]);
    });

    it('extracts role from JWT claims', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt-with-role',
        createdAt: new Date(),
      };

      const roles = await auth.getRoles(user);
      expect(roles).toEqual(['admin']);
    });

    it('returns empty array when no role in JWT', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt-without-role',
        createdAt: new Date(),
      };

      const roles = await auth.getRoles(user);
      expect(roles).toEqual([]);
    });
  });

  // ============================================
  // IRBACProvider: hasRole
  // ============================================

  describe('hasRole', () => {
    it('returns false when JWT is expired', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // expired
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'expired-jwt',
        createdAt: new Date(),
      };

      const hasAdmin = await auth.hasRole(user, 'admin');
      expect(hasAdmin).toBe(false);
    });

    it('returns true when role matches', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'admin',
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt',
        createdAt: new Date(),
      };

      const hasAdmin = await auth.hasRole(user, 'admin');
      expect(hasAdmin).toBe(true);
    });

    it('returns false when role does not match', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'viewer',
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt',
        createdAt: new Date(),
      };

      const hasAdmin = await auth.hasRole(user, 'admin');
      expect(hasAdmin).toBe(false);
    });
  });

  // ============================================
  // IRBACProvider: getPermissions
  // ============================================

  describe('getPermissions', () => {
    it('throws CloudApiError when JWT is expired', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // expired
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'expired-jwt',
        createdAt: new Date(),
      };

      await expect(auth.getPermissions(user)).rejects.toThrow(CloudApiError);
    });

    it('uses resolvePermissions with role from JWT', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'admin',
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt-token',
        createdAt: new Date(),
      };

      const permissions = await auth.getPermissions(user);

      // admin role has agents:*, workflows:*, etc. from DEFAULT_ROLES
      expect(permissions).toContain('agents:*');
      expect(permissions).toContain('workflows:*');
      expect(permissions).toContain('studio:*');
    });

    it('returns empty array when no role in JWT', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        // no role claim
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt-no-role',
        createdAt: new Date(),
      };

      const permissions = await auth.getPermissions(user);
      expect(permissions).toEqual([]);
    });

    it('throws CloudApiError on invalid token', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid JWT');
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'invalid-jwt',
        createdAt: new Date(),
      };

      await expect(auth.getPermissions(user)).rejects.toThrow(CloudApiError);
    });
  });

  // ============================================
  // IRBACProvider: hasPermission
  // ============================================

  describe('hasPermission', () => {
    it('returns true when permission exists via wildcard', async () => {
      // owner role has '*' wildcard
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'owner',
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt',
        createdAt: new Date(),
      };

      // owner has '*' which matches any permission
      const has = await auth.hasPermission(user, 'agents:read');
      expect(has).toBe(true);
    });

    it('returns true when exact permission exists', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'admin',
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt',
        createdAt: new Date(),
      };

      // admin has 'agents:*' which is in the permissions list
      const has = await auth.hasPermission(user, 'agents:*');
      expect(has).toBe(true);
    });

    it('returns false when permission not in list', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        role: 'viewer',
      });

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        sessionToken: 'jwt',
        createdAt: new Date(),
      };

      // viewer doesn't have agents:write
      const has = await auth.hasPermission(user, 'agents:write');
      expect(has).toBe(false);
    });
  });

  // ============================================
  // extractSessionToken (via getCurrentUser edge cases)
  // ============================================

  describe('extractSessionToken', () => {
    it('parses cookie header correctly', async () => {
      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
      });

      // Multiple cookies
      const request = new Request('http://localhost', {
        headers: { cookie: 'other=value; mastra_session=my-token; another=test' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user?.sessionToken).toBe('my-token');
    });

    it('handles missing mastra_session cookie', async () => {
      const request = new Request('http://localhost', {
        headers: { cookie: 'other_cookie=value' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });

    it('handles empty cookie header', async () => {
      const request = new Request('http://localhost', {
        headers: { cookie: '' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });
  });

  // ============================================
  // Custom cookie name
  // ============================================

  describe('custom cookieName', () => {
    it('uses custom cookie name when configured', async () => {
      const customAuth = new MastraCloudAuth({
        projectId: 'test-project',
        cookieName: 'custom_session',
      });

      (decodeJwt as ReturnType<typeof vi.fn>).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
      });

      const request = new Request('http://localhost', {
        headers: { cookie: 'custom_session=custom-token' },
      });

      const user = await customAuth.getCurrentUser(request);
      expect(user?.sessionToken).toBe('custom-token');
    });
  });

  // ============================================
  // isMastraCloudAuth marker
  // ============================================

  describe('isMastraCloudAuth marker', () => {
    it('has marker set to true', () => {
      expect(auth.isMastraCloudAuth).toBe(true);
    });
  });
});
