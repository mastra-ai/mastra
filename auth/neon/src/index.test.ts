import { jwtVerify, createRemoteJWKSet } from 'jose';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { MastraAuthNeon, MastraRBACNeon } from './index';
import type { NeonAuthUser } from './index';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockRawRequest = (headers: Record<string, string> = {}) => new Request('http://localhost/test', { headers });

describe('MastraAuthNeon', () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = 'https://test-project.neon.tech';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_JWKS_URL;
  });

  describe('constructor', () => {
    test('initializes with environment variable', () => {
      const auth = new MastraAuthNeon();
      expect(auth['baseUrl']).toBe('https://test-project.neon.tech');
      expect(auth['jwksUrl']).toBe('https://test-project.neon.tech/auth/jwks');
    });

    test('initializes with provided baseUrl', () => {
      const auth = new MastraAuthNeon({
        baseUrl: 'https://custom-project.neon.tech',
      });
      expect(auth['baseUrl']).toBe('https://custom-project.neon.tech');
      expect(auth['jwksUrl']).toBe('https://custom-project.neon.tech/auth/jwks');
    });

    test('strips trailing slash from baseUrl', () => {
      const auth = new MastraAuthNeon({
        baseUrl: 'https://custom-project.neon.tech/',
      });
      expect(auth['baseUrl']).toBe('https://custom-project.neon.tech');
      expect(auth['jwksUrl']).toBe('https://custom-project.neon.tech/auth/jwks');
    });

    test('uses explicit jwksUrl when provided', () => {
      const auth = new MastraAuthNeon({
        jwksUrl: 'https://custom.example.com/.well-known/jwks.json',
      });
      expect(auth['jwksUrl']).toBe('https://custom.example.com/.well-known/jwks.json');
    });

    test('prefers explicit jwksUrl over baseUrl-derived URL', () => {
      const auth = new MastraAuthNeon({
        baseUrl: 'https://project.neon.tech',
        jwksUrl: 'https://custom.example.com/jwks',
      });
      expect(auth['jwksUrl']).toBe('https://custom.example.com/jwks');
    });

    test('uses NEON_AUTH_JWKS_URL env var', () => {
      process.env.NEON_AUTH_JWKS_URL = 'https://env-jwks.example.com/jwks';
      const auth = new MastraAuthNeon();
      expect(auth['jwksUrl']).toBe('https://env-jwks.example.com/jwks');
    });

    test('throws error when no base URL is provided', () => {
      delete process.env.NEON_AUTH_BASE_URL;
      expect(() => new MastraAuthNeon()).toThrow('Neon Auth base URL is required');
    });

    test('uses default sessionCookieName', () => {
      const auth = new MastraAuthNeon();
      expect(auth.sessionCookieName).toBe('neonauth.session_token');
    });

    test('uses custom sessionCookieName', () => {
      const auth = new MastraAuthNeon({ sessionCookieName: 'my-app.session' });
      expect(auth.sessionCookieName).toBe('my-app.session');
    });

    test('uses default name "neon"', () => {
      const auth = new MastraAuthNeon();
      expect(auth.name).toBe('neon');
    });

    test('uses custom name when provided', () => {
      const auth = new MastraAuthNeon({ name: 'my-neon-auth' });
      expect(auth.name).toBe('my-neon-auth');
    });
  });

  describe('authenticateToken', () => {
    test('verifies JWT and returns user from claims', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: {
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'authenticated',
          iat: 1700000000,
        },
      });

      const auth = new MastraAuthNeon();
      const result = await auth.authenticateToken('jwt-token', mockRawRequest());

      expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://test-project.neon.tech/auth/jwks'));
      expect(jwtVerify).toHaveBeenCalledWith('jwt-token', mockJWKS);
      expect(result).toMatchObject({
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        jwt: { sub: 'user-123', email: 'test@example.com' },
      });
    });

    test('falls back to session verification when JWT fails', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid JWT'));

      const mockSessionResponse = {
        session: {
          id: 'session-1',
          token: 'session-token',
          userId: 'user-456',
          expiresAt: '2026-01-01T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        user: {
          id: 'user-456',
          email: 'session@example.com',
          name: 'Session User',
          image: null,
          emailVerified: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSessionResponse),
      });

      const auth = new MastraAuthNeon();
      const result = await auth.authenticateToken('session-token', mockRawRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.neon.tech/auth/get-session',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toMatchObject({
        session: { id: 'session-1' },
        user: { id: 'user-456', email: 'session@example.com' },
      });
    });

    test('returns null for empty token', async () => {
      const auth = new MastraAuthNeon();
      const result = await auth.authenticateToken('', mockRawRequest());
      expect(result).toBeNull();
    });

    test('returns null for non-string token', async () => {
      const auth = new MastraAuthNeon();
      const result = await auth.authenticateToken(null as any, mockRawRequest());
      expect(result).toBeNull();
    });

    test('returns null when both JWT and session verification fail', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid JWT'));
      mockFetch.mockResolvedValue({ ok: false });

      const auth = new MastraAuthNeon();
      const result = await auth.authenticateToken('bad-token', mockRawRequest());
      expect(result).toBeNull();
    });

    test('passes existing cookie header for session verification', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Not a JWT'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            session: { id: 's1', token: 't', userId: 'u1', expiresAt: '', createdAt: '', updatedAt: '' },
            user: { id: 'u1', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
          }),
      });

      const auth = new MastraAuthNeon();
      const req = mockRawRequest({ Cookie: 'neonauth.session_token=existing-cookie' });
      await auth.authenticateToken('some-token', req);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.get('Cookie')).toContain('neonauth.session_token=existing-cookie');
    });

    test('injects bearer token as session cookie when not present', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Not a JWT'));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            session: { id: 's1', token: 't', userId: 'u1', expiresAt: '', createdAt: '', updatedAt: '' },
            user: { id: 'u1', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
          }),
      });

      const auth = new MastraAuthNeon();
      const req = mockRawRequest();
      await auth.authenticateToken('my-session-token', req);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.get('Cookie')).toBe('neonauth.session_token=my-session-token');
    });
  });

  describe('authorizeUser', () => {
    test('returns true for valid user', async () => {
      const auth = new MastraAuthNeon();
      const user: NeonAuthUser = {
        user: { id: 'user-123', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
      };
      expect(await auth.authorizeUser(user)).toBe(true);
    });

    test('returns false for null user', async () => {
      const auth = new MastraAuthNeon();
      expect(await auth.authorizeUser(null as any)).toBe(false);
    });

    test('returns false for user without id', async () => {
      const auth = new MastraAuthNeon();
      const user: NeonAuthUser = {
        user: { id: '', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
      };
      expect(await auth.authorizeUser(user)).toBe(false);
    });

    test('returns false for expired JWT', async () => {
      const auth = new MastraAuthNeon();
      const user: NeonAuthUser = {
        user: { id: 'user-123', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
        jwt: { sub: 'user-123', exp: Math.floor(Date.now() / 1000) - 3600 },
      };
      expect(await auth.authorizeUser(user)).toBe(false);
    });

    test('returns true for non-expired JWT', async () => {
      const auth = new MastraAuthNeon();
      const user: NeonAuthUser = {
        user: { id: 'user-123', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
        jwt: { sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 },
      };
      expect(await auth.authorizeUser(user)).toBe(true);
    });

    test('can be overridden with custom authorization logic', async () => {
      const auth = new MastraAuthNeon({
        async authorizeUser(user: NeonAuthUser): Promise<boolean> {
          return user?.jwt?.role === 'authenticated';
        },
      });

      const makeUser = (role?: string): NeonAuthUser => ({
        user: { id: 'user-123', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
        jwt: { sub: 'user-123', role },
      });

      expect(await auth.authorizeUser(makeUser('authenticated'))).toBe(true);
      expect(await auth.authorizeUser(makeUser('anonymous'))).toBe(false);
      expect(await auth.authorizeUser(makeUser())).toBe(false);
    });
  });

  describe('signIn', () => {
    test('calls Neon Auth sign-in endpoint and returns user', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        emailVerified: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: mockUser, token: 'session-token' }),
        headers: new Headers({ 'set-cookie': 'neonauth.session_token=abc; Path=/; HttpOnly' }),
      });

      const auth = new MastraAuthNeon();
      const result = await auth.signIn('test@example.com', 'password', mockRawRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.neon.tech/auth/sign-in/email',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
        }),
      );
      expect(result.user).toMatchObject({ id: 'user-789', email: 'test@example.com' });
      expect(result.token).toBe('session-token');
      expect(result.cookies).toHaveLength(1);
    });

    test('throws on invalid credentials', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      const auth = new MastraAuthNeon();
      await expect(auth.signIn('bad@example.com', 'wrong', mockRawRequest())).rejects.toThrow('Invalid credentials');
    });
  });

  describe('signUp', () => {
    test('calls Neon Auth sign-up endpoint and returns user', async () => {
      const mockUser = {
        id: 'user-new',
        email: 'new@example.com',
        name: 'New User',
        image: null,
        emailVerified: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: mockUser, token: 'new-token' }),
        headers: new Headers({ 'set-cookie': 'neonauth.session_token=xyz; Path=/; HttpOnly' }),
      });

      const auth = new MastraAuthNeon();
      const result = await auth.signUp('new@example.com', 'password', 'New User', mockRawRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.neon.tech/auth/sign-up/email',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'new@example.com', password: 'password', name: 'New User' }),
        }),
      );
      expect(result.user).toMatchObject({ id: 'user-new', email: 'new@example.com' });
    });

    test('uses email prefix as name when name is not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: 'user-x',
              email: 'john@example.com',
              name: 'john',
              emailVerified: false,
              createdAt: '',
              updatedAt: '',
            },
            token: 't',
          }),
        headers: new Headers(),
      });

      const auth = new MastraAuthNeon();
      await auth.signUp('john@example.com', 'password', undefined, mockRawRequest());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.name).toBe('john');
    });

    test('throws on sign-up failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Email already exists' }),
      });

      const auth = new MastraAuthNeon();
      await expect(auth.signUp('existing@example.com', 'pw', 'Name', mockRawRequest())).rejects.toThrow(
        'Email already exists',
      );
    });
  });

  describe('getCurrentUser', () => {
    test('returns user from session', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            session: { id: 's1', token: 't', userId: 'u1', expiresAt: '', createdAt: '', updatedAt: '' },
            user: {
              id: 'u1',
              email: 'user@example.com',
              name: 'User',
              image: 'https://example.com/avatar.png',
              emailVerified: true,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
          }),
      });

      const auth = new MastraAuthNeon();
      const result = await auth.getCurrentUser(mockRawRequest({ Cookie: 'neonauth.session_token=abc' }));

      expect(result).toMatchObject({
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    test('returns null when no session exists', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const auth = new MastraAuthNeon();
      const result = await auth.getCurrentUser(mockRawRequest());
      expect(result).toBeNull();
    });
  });

  describe('isSignUpEnabled', () => {
    test('defaults to true', () => {
      const auth = new MastraAuthNeon();
      expect(auth.isSignUpEnabled()).toBe(true);
    });

    test('can be set to false', () => {
      const auth = new MastraAuthNeon({ signUpEnabled: false });
      expect(auth.isSignUpEnabled()).toBe(false);
    });
  });

  describe('getClearSessionHeaders', () => {
    test('returns headers to clear session cookies', () => {
      const auth = new MastraAuthNeon();
      const headers = auth.getClearSessionHeaders();
      expect(headers['Set-Cookie']).toContain('neonauth.session_token=;');
      expect(headers['Set-Cookie']).toContain('Max-Age=0');
    });
  });

  // ── ISessionProvider tests ──

  describe('ISessionProvider', () => {
    test('createSession returns a session object', async () => {
      const auth = new MastraAuthNeon();
      const session = await auth.createSession('user-1', { key: 'value' });
      expect(session.userId).toBe('user-1');
      expect(session.id).toBeTruthy();
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.metadata).toEqual({ key: 'value' });
    });

    test('validateSession returns session on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            session: {
              id: 'sess-abc',
              token: 'token-abc',
              userId: 'user-1',
              expiresAt: '2026-06-01T00:00:00Z',
              createdAt: '2025-06-01T00:00:00Z',
              updatedAt: '2025-06-01T00:00:00Z',
            },
            user: { id: 'user-1', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
          }),
      });

      const auth = new MastraAuthNeon();
      const session = await auth.validateSession('token-abc');

      expect(session).not.toBeNull();
      expect(session!.id).toBe('sess-abc');
      expect(session!.userId).toBe('user-1');
    });

    test('validateSession returns null on failure', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const auth = new MastraAuthNeon();
      const session = await auth.validateSession('bad-token');
      expect(session).toBeNull();
    });

    test('refreshSession delegates to validateSession', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            session: {
              id: 'sess-abc',
              token: 'token-abc',
              userId: 'user-1',
              expiresAt: '2026-06-01T00:00:00Z',
              createdAt: '2025-06-01T00:00:00Z',
              updatedAt: '2025-06-01T00:00:00Z',
            },
            user: { id: 'user-1', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
          }),
      });

      const auth = new MastraAuthNeon();
      const session = await auth.refreshSession('token-abc');
      expect(session).not.toBeNull();
      expect(session!.id).toBe('sess-abc');
    });

    test('destroySession does not throw', async () => {
      const auth = new MastraAuthNeon();
      await expect(auth.destroySession('sess-abc')).resolves.not.toThrow();
    });

    test('getSessionIdFromRequest extracts cookie', () => {
      const auth = new MastraAuthNeon();
      const req = mockRawRequest({ Cookie: 'other=x; neonauth.session_token=tok123; foo=bar' });
      expect(auth.getSessionIdFromRequest(req)).toBe('tok123');
    });

    test('getSessionIdFromRequest returns null when no cookie', () => {
      const auth = new MastraAuthNeon();
      const req = mockRawRequest();
      expect(auth.getSessionIdFromRequest(req)).toBeNull();
    });

    test('getSessionHeaders returns empty by default', () => {
      const auth = new MastraAuthNeon();
      const session = { id: 's1', userId: 'u1', expiresAt: new Date(), createdAt: new Date() };
      expect(auth.getSessionHeaders(session)).toEqual({});
    });

    test('getBaseUrl returns the configured base URL', () => {
      const auth = new MastraAuthNeon();
      expect(auth.getBaseUrl()).toBe('https://test-project.neon.tech');
    });
  });
});

// ── MastraRBACNeon tests ──

describe('MastraRBACNeon', () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = 'https://test-project.neon.tech';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEON_AUTH_BASE_URL;
  });

  const makeUser = (overrides: Partial<NeonAuthUser> = {}): NeonAuthUser => ({
    user: { id: 'user-1', email: 'a@b.com', name: 'A', emailVerified: true, createdAt: '', updatedAt: '' },
    ...overrides,
  });

  const roleMapping = {
    owner: ['*' as const],
    admin: ['*' as const],
    member: ['agents:read' as const, 'workflows:*' as const],
    _default: [] as const,
  };

  describe('constructor', () => {
    test('uses NEON_AUTH_BASE_URL env var', () => {
      const rbac = new MastraRBACNeon({ roleMapping });
      expect(rbac.roleMapping).toBe(roleMapping);
    });

    test('uses explicit baseUrl', () => {
      const rbac = new MastraRBACNeon({ baseUrl: 'https://custom.neon.tech', roleMapping });
      expect(rbac.roleMapping).toBe(roleMapping);
    });
  });

  describe('getRoles with custom getUserRoles', () => {
    test('uses custom getUserRoles when provided', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: (user: NeonAuthUser) => {
          const role = user.jwt?.role as string;
          return role ? [role] : [];
        },
      });

      const user = makeUser({ jwt: { sub: 'user-1', role: 'admin' } });
      const roles = await rbac.getRoles(user);
      expect(roles).toEqual(['admin']);
    });
  });

  describe('getRoles from JWT claims', () => {
    test('extracts role from JWT', async () => {
      const rbac = new MastraRBACNeon({ roleMapping });
      const user = makeUser({ jwt: { sub: 'user-1', role: 'member' } });
      const roles = await rbac.getRoles(user);
      expect(roles).toEqual(['member']);
    });

    test('returns empty when no JWT role and no baseUrl', async () => {
      delete process.env.NEON_AUTH_BASE_URL;
      const rbac = new MastraRBACNeon({ baseUrl: '', roleMapping });
      const user = makeUser();
      const roles = await rbac.getRoles(user);
      expect(roles).toEqual([]);
    });
  });

  describe('getRoles from organization memberships', () => {
    test('fetches roles from Neon Auth API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([{ id: 'm1', organizationId: 'org-1', userId: 'user-1', role: 'admin', createdAt: '' }]),
      });

      const rbac = new MastraRBACNeon({ roleMapping });
      const user = makeUser();
      const roles = await rbac.getRoles(user);
      expect(roles).toEqual(['admin']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.neon.tech/auth/api/organization/list-memberships',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ userId: 'user-1' }),
        }),
      );
    });

    test('filters by organizationId when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 'm1', organizationId: 'org-1', userId: 'user-1', role: 'admin', createdAt: '' },
            { id: 'm2', organizationId: 'org-2', userId: 'user-1', role: 'member', createdAt: '' },
          ]),
      });

      const rbac = new MastraRBACNeon({ roleMapping, organizationId: 'org-2' });
      const user = makeUser();
      const roles = await rbac.getRoles(user);
      expect(roles).toEqual(['member']);
    });

    test('caches roles', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([{ id: 'm1', organizationId: 'org-1', userId: 'user-1', role: 'owner', createdAt: '' }]),
      });

      const rbac = new MastraRBACNeon({ roleMapping });
      const user = makeUser();

      await rbac.getRoles(user);
      await rbac.getRoles(user);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('returns empty roles on API error', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const rbac = new MastraRBACNeon({ roleMapping });
      const roles = await rbac.getRoles(makeUser());
      expect(roles).toEqual([]);
    });
  });

  describe('permission checks', () => {
    test('hasRole checks user roles', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: () => ['member'],
      });
      expect(await rbac.hasRole(makeUser(), 'member')).toBe(true);
      expect(await rbac.hasRole(makeUser(), 'admin')).toBe(false);
    });

    test('getPermissions resolves permissions from mapping', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: () => ['member'],
      });
      const perms = await rbac.getPermissions(makeUser());
      expect(perms).toContain('agents:read');
      expect(perms).toContain('workflows:*');
    });

    test('hasPermission with wildcard role', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: () => ['owner'],
      });
      expect(await rbac.hasPermission(makeUser(), 'agents:read')).toBe(true);
      expect(await rbac.hasPermission(makeUser(), 'anything:else')).toBe(true);
    });

    test('hasAllPermissions checks all permissions', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: () => ['member'],
      });
      expect(await rbac.hasAllPermissions(makeUser(), ['agents:read', 'workflows:read'])).toBe(true);
      expect(await rbac.hasAllPermissions(makeUser(), ['agents:read', 'agents:write'])).toBe(false);
    });

    test('hasAnyPermission checks any permission', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: () => ['member'],
      });
      expect(await rbac.hasAnyPermission(makeUser(), ['agents:write', 'workflows:read'])).toBe(true);
      expect(await rbac.hasAnyPermission(makeUser(), ['agents:write', 'agents:delete'])).toBe(false);
    });

    test('_default mapping used for unmapped roles', async () => {
      const rbac = new MastraRBACNeon({
        roleMapping,
        getUserRoles: () => ['custom-role'],
      });
      const perms = await rbac.getPermissions(makeUser());
      expect(perms).toEqual([]);
    });
  });

  describe('getAvailableRoles', () => {
    test('returns roles from mapping excluding _default', async () => {
      const rbac = new MastraRBACNeon({ roleMapping });
      const roles = await rbac.getAvailableRoles();
      expect(roles).toEqual([
        { id: 'owner', name: 'Owner' },
        { id: 'admin', name: 'Admin' },
        { id: 'member', name: 'Member' },
      ]);
    });
  });

  describe('getRolePermissions', () => {
    test('resolves permissions for a specific role', async () => {
      const rbac = new MastraRBACNeon({ roleMapping });
      const perms = await rbac.getRolePermissions('member');
      expect(perms).toContain('agents:read');
      expect(perms).toContain('workflows:*');
    });
  });
});
