/**
 * Tests for @mastra/auth-cloud.
 *
 * MastraRBACCloud: Pure logic tests (no mocking).
 * MastraCloudAuthProvider: Server provider tests (mocked network calls).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MastraCloudAuthProvider } from './auth-provider';
import { MastraRBACCloud } from './rbac';
import type { CloudUser } from './types';

// ---------------------------------------------------------------------------
// Mock network-dependent modules used by MastraCloudAuth client internals
// ---------------------------------------------------------------------------

vi.mock('./session/session', () => ({
  verifyToken: vi.fn(),
  validateSession: vi.fn(),
  destroySession: vi.fn(),
  getLogoutUrl: vi.fn(
    (base: string, redirect: string, hint: string) =>
      `${base}/auth/logout?post_logout_redirect_uri=${encodeURIComponent(redirect)}&id_token_hint=${encodeURIComponent(hint)}`,
  ),
}));

vi.mock('./oauth/oauth', () => ({
  getLoginUrl: vi.fn(() => ({
    url: 'https://cloud.mastra.ai/auth/authorize?mock=1',
    cookies: ['pkce_verifier=abc; HttpOnly'],
  })),
  handleCallback: vi.fn(),
}));

// We use the real parseSessionCookie from cookie.ts (pure function, no IO).

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const testRoleMapping = {
  owner: ['*'],
  admin: ['agents:*', 'workflows:*', 'tools:*', 'studio:*'],
  member: ['agents:read', 'agents:execute', 'workflows:read', 'tools:read'],
  viewer: ['agents:read', 'workflows:read', 'tools:read'],
  _default: [],
};

function makeUser(overrides: Partial<CloudUser> = {}): CloudUser {
  return { id: 'user-1', email: 'user@test.com', name: 'Test User', role: 'member', ...overrides };
}

function makeRequest(opts: { cookie?: string; authorization?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers['cookie'] = opts.cookie;
  if (opts.authorization) headers['authorization'] = opts.authorization;
  return new Request('http://localhost/api/test', { headers });
}

// ============================================================================
// MastraRBACCloud
// ============================================================================

describe('MastraRBACCloud', () => {
  let rbac: MastraRBACCloud;

  beforeEach(() => {
    rbac = new MastraRBACCloud({ roleMapping: testRoleMapping });
  });

  // ---------- getRoles ----------

  describe('getRoles', () => {
    it('returns [user.role] when the user has a role', async () => {
      const roles = await rbac.getRoles(makeUser({ role: 'admin' }));
      expect(roles).toEqual(['admin']);
    });

    it('returns [] when the user has no role', async () => {
      const roles = await rbac.getRoles(makeUser({ role: undefined }));
      expect(roles).toEqual([]);
    });
  });

  // ---------- hasRole ----------

  describe('hasRole', () => {
    it('returns true when role matches', async () => {
      expect(await rbac.hasRole(makeUser({ role: 'admin' }), 'admin')).toBe(true);
    });

    it('returns false when role does not match', async () => {
      expect(await rbac.hasRole(makeUser({ role: 'viewer' }), 'admin')).toBe(false);
    });

    it('returns false when user has no role', async () => {
      expect(await rbac.hasRole(makeUser({ role: undefined }), 'admin')).toBe(false);
    });
  });

  // ---------- getPermissions ----------

  describe('getPermissions', () => {
    it('maps role to its permissions via roleMapping', async () => {
      const perms = await rbac.getPermissions(makeUser({ role: 'admin' }));
      expect(perms).toEqual(expect.arrayContaining(['agents:*', 'workflows:*', 'tools:*', 'studio:*']));
      expect(perms).toHaveLength(4);
    });

    it('returns _default permissions when user has no role', async () => {
      const perms = await rbac.getPermissions(makeUser({ role: undefined }));
      expect(perms).toEqual([]);
    });

    it('returns ["*"] for owner role', async () => {
      const perms = await rbac.getPermissions(makeUser({ role: 'owner' }));
      expect(perms).toEqual(['*']);
    });

    it('returns member permissions correctly', async () => {
      const perms = await rbac.getPermissions(makeUser({ role: 'member' }));
      expect(perms).toEqual(expect.arrayContaining(['agents:read', 'agents:execute', 'workflows:read', 'tools:read']));
    });
  });

  // ---------- hasPermission ----------

  describe('hasPermission', () => {
    it('wildcard "*" matches any permission', async () => {
      const owner = makeUser({ role: 'owner' });
      expect(await rbac.hasPermission(owner, 'agents:read')).toBe(true);
      expect(await rbac.hasPermission(owner, 'workflows:write')).toBe(true);
      expect(await rbac.hasPermission(owner, 'anything:anything')).toBe(true);
    });

    it('scoped wildcard "agents:*" matches any agent action', async () => {
      const admin = makeUser({ role: 'admin' });
      expect(await rbac.hasPermission(admin, 'agents:read')).toBe(true);
      expect(await rbac.hasPermission(admin, 'agents:write')).toBe(true);
      expect(await rbac.hasPermission(admin, 'agents:execute')).toBe(true);
    });

    it('exact permission match works', async () => {
      const member = makeUser({ role: 'member' });
      expect(await rbac.hasPermission(member, 'agents:read')).toBe(true);
      expect(await rbac.hasPermission(member, 'workflows:read')).toBe(true);
    });

    it('returns false when permission is not granted', async () => {
      const viewer = makeUser({ role: 'viewer' });
      expect(await rbac.hasPermission(viewer, 'agents:write')).toBe(false);
      expect(await rbac.hasPermission(viewer, 'agents:execute')).toBe(false);
    });

    it('returns false when user has no role and _default is empty', async () => {
      const noRole = makeUser({ role: undefined });
      expect(await rbac.hasPermission(noRole, 'agents:read')).toBe(false);
    });
  });

  // ---------- hasAllPermissions / hasAnyPermission ----------

  describe('hasAllPermissions', () => {
    it('returns true when user has every listed permission', async () => {
      const admin = makeUser({ role: 'admin' });
      expect(await rbac.hasAllPermissions(admin, ['agents:read', 'workflows:write'])).toBe(true);
    });

    it('returns false when user is missing at least one', async () => {
      const viewer = makeUser({ role: 'viewer' });
      expect(await rbac.hasAllPermissions(viewer, ['agents:read', 'agents:write'])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true when user has at least one', async () => {
      const viewer = makeUser({ role: 'viewer' });
      expect(await rbac.hasAnyPermission(viewer, ['agents:read', 'agents:write'])).toBe(true);
    });

    it('returns false when user has none', async () => {
      const viewer = makeUser({ role: 'viewer' });
      expect(await rbac.hasAnyPermission(viewer, ['agents:write', 'agents:delete'])).toBe(false);
    });
  });
});

// ============================================================================
// MastraCloudAuthProvider
// ============================================================================

describe('MastraCloudAuthProvider', () => {
  let provider: MastraCloudAuthProvider;

  // Lazily import the mocked modules so we can control return values per test.
  let mockVerifyToken: ReturnType<typeof vi.fn>;
  let mockValidateSession: ReturnType<typeof vi.fn>;
  let mockDestroySession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    provider = new MastraCloudAuthProvider({
      projectId: 'proj-123',
      cloudBaseUrl: 'https://cloud.mastra.ai',
      callbackUrl: 'https://myapp.com/auth/callback',
      isProduction: false,
    });

    // Grab references to the mocked functions
    const sessionMod = await import('./session/session');
    mockVerifyToken = sessionMod.verifyToken as unknown as ReturnType<typeof vi.fn>;
    mockValidateSession = sessionMod.validateSession as unknown as ReturnType<typeof vi.fn>;
    mockDestroySession = sessionMod.destroySession as unknown as ReturnType<typeof vi.fn>;
  });

  // ---------- getCurrentUser ----------

  describe('getCurrentUser', () => {
    it('returns user when valid session cookie is present', async () => {
      mockVerifyToken.mockResolvedValue({
        user: { id: 'user-1', email: 'a@b.com', name: 'Alice' },
        role: 'admin',
      });

      const req = makeRequest({ cookie: 'mastra_cloud_session=tok-123' });
      const user = await provider.getCurrentUser(req);

      expect(user).toEqual({
        id: 'user-1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'admin',
      });
    });

    it('returns null when no cookie is present', async () => {
      const req = makeRequest();
      const user = await provider.getCurrentUser(req);
      expect(user).toBeNull();
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('returns null when verifyToken throws', async () => {
      mockVerifyToken.mockRejectedValue(new Error('verification_failed'));

      const req = makeRequest({ cookie: 'mastra_cloud_session=bad-token' });
      const user = await provider.getCurrentUser(req);
      expect(user).toBeNull();
    });
  });

  // ---------- getUser ----------

  describe('getUser', () => {
    it('always returns null', async () => {
      const result = await provider.getUser('any-id');
      expect(result).toBeNull();
    });
  });

  // ---------- createSession ----------

  describe('createSession', () => {
    it('creates a session with userId and default 24h expiry', async () => {
      const before = Date.now();
      const session = await provider.createSession('user-1');
      const after = Date.now();

      expect(session.userId).toBe('user-1');
      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after);
      // Expires roughly 24 hours from now
      const twentyFourHours = 24 * 60 * 60 * 1000;
      expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(twentyFourHours);
    });

    it('uses accessToken from metadata as session id when provided', async () => {
      const session = await provider.createSession('user-1', { accessToken: 'my-access-token' });
      expect(session.id).toBe('my-access-token');
    });
  });

  // ---------- authenticateToken ----------

  describe('authenticateToken', () => {
    it('authenticates via session cookie', async () => {
      mockVerifyToken.mockResolvedValue({
        user: { id: 'user-1', email: 'a@b.com' },
        role: 'member',
      });

      const req = makeRequest({ cookie: 'mastra_cloud_session=session-tok' });
      const user = await provider.authenticateToken('', req);

      expect(user).toEqual({ id: 'user-1', email: 'a@b.com', role: 'member' });
      // verifyToken should have been called with the session cookie value
      expect(mockVerifyToken).toHaveBeenCalledWith(expect.objectContaining({ token: 'session-tok' }));
    });

    it('falls back to bearer token when no cookie', async () => {
      mockVerifyToken.mockResolvedValue({
        user: { id: 'user-2', email: 'b@c.com' },
        role: 'viewer',
      });

      const req = makeRequest(); // no cookie
      const user = await provider.authenticateToken('bearer-tok', req);

      expect(user).toEqual({ id: 'user-2', email: 'b@c.com', role: 'viewer' });
      expect(mockVerifyToken).toHaveBeenCalledWith(expect.objectContaining({ token: 'bearer-tok' }));
    });

    it('returns null when both cookie and bearer token fail', async () => {
      mockVerifyToken.mockRejectedValue(new Error('invalid'));

      const req = makeRequest({ cookie: 'mastra_cloud_session=bad' });
      const user = await provider.authenticateToken('also-bad', req);
      expect(user).toBeNull();
    });
  });

  // ---------- authorizeUser ----------

  describe('authorizeUser', () => {
    it('returns true for a user with a valid id', () => {
      expect(provider.authorizeUser(makeUser())).toBe(true);
    });

    it('returns false when user id is empty', () => {
      expect(provider.authorizeUser(makeUser({ id: '' }))).toBe(false);
    });

    it('returns false for null/undefined user', () => {
      expect(provider.authorizeUser(null as unknown as CloudUser)).toBe(false);
      expect(provider.authorizeUser(undefined as unknown as CloudUser)).toBe(false);
    });
  });

  // ---------- isMastraCloudAuth marker ----------

  describe('isMastraCloudAuth', () => {
    it('marker is true', () => {
      expect(provider.isMastraCloudAuth).toBe(true);
    });
  });

  // ---------- getSessionIdFromRequest ----------

  describe('getSessionIdFromRequest', () => {
    it('extracts token from mastra_cloud_session cookie', () => {
      const req = makeRequest({ cookie: 'other=x; mastra_cloud_session=my-token; foo=bar' });
      expect(provider.getSessionIdFromRequest(req)).toBe('my-token');
    });

    it('returns null when cookie is missing', () => {
      const req = makeRequest({ cookie: 'other_cookie=value' });
      expect(provider.getSessionIdFromRequest(req)).toBeNull();
    });

    it('returns null when no cookie header', () => {
      const req = makeRequest();
      expect(provider.getSessionIdFromRequest(req)).toBeNull();
    });
  });

  // ---------- validateSession ----------

  describe('validateSession', () => {
    it('returns a Session when cloud API validates', async () => {
      mockValidateSession.mockResolvedValue({
        userId: 'user-1',
        createdAt: 1700000000000,
        expiresAt: 1700086400000,
      });

      const session = await provider.validateSession('tok-abc');

      expect(session).not.toBeNull();
      expect(session!.userId).toBe('user-1');
      expect(session!.id).toBe('tok-abc');
    });

    it('returns null when cloud API returns null', async () => {
      mockValidateSession.mockResolvedValue(null);
      const session = await provider.validateSession('bad-tok');
      expect(session).toBeNull();
    });
  });

  // ---------- destroySession ----------

  describe('destroySession', () => {
    it('delegates to client destroySession', async () => {
      mockDestroySession.mockResolvedValue(undefined);
      await provider.destroySession('tok-abc');
      expect(mockDestroySession).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: 'tok-abc' }));
    });
  });
});
