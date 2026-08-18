import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { makeSignature } from 'better-auth/crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthBetterAuth } from './index';
import type { BetterAuthUser } from './index';

describe('MastraAuthBetterAuth', () => {
  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 86400000), // 1 day from now
    token: 'test-session-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuth = {
    api: {
      getSession: vi.fn(),
    },
  };

  const mockRawRequest = (headers: Record<string, string> = {}) => new Request('http://localhost/test', { headers });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with provided auth instance', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      expect(auth).toBeInstanceOf(MastraAuthBetterAuth);
    });

    it('should throw error when auth instance is not provided', () => {
      expect(() => new MastraAuthBetterAuth({} as any)).toThrow('Better Auth instance is required');
    });

    it('should use default name "better-auth" when not provided', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      expect(auth.name).toBe('better-auth');
    });

    it('should use custom name when provided', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        name: 'custom-auth',
      });
      expect(auth.name).toBe('custom-auth');
    });

    it('should set default sessionCookieName to "better-auth.session_token"', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      expect(auth.sessionCookieName).toBe('better-auth.session_token');
    });

    it('should use custom cookiePrefix from auth options', () => {
      const customAuth = { ...mockAuth, options: { advanced: { cookiePrefix: 'myapp' } } };
      const auth = new MastraAuthBetterAuth({
        auth: customAuth as any,
      });
      expect(auth.sessionCookieName).toBe('myapp.session_token');
    });
  });

  describe('authenticateToken', () => {
    it('should authenticate valid session token and return user', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const rawReq = mockRawRequest({ Cookie: 'better-auth.session_token=test-token' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('test-token', rawReq);

      expect(mockAuth.api.getSession).toHaveBeenCalled();
      expect(result).toEqual({
        session: mockSession,
        user: mockUser,
      });
    });

    it('should return null when session is not found', async () => {
      mockAuth.api.getSession.mockResolvedValue(null);

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('invalid-token', mockRawRequest());

      expect(result).toBeNull();
    });

    it('should return null when getSession throws an error', async () => {
      mockAuth.api.getSession.mockRejectedValue(new Error('Session expired'));

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('expired-token', mockRawRequest());

      expect(result).toBeNull();
    });

    it('should return null when session is missing user', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: null,
      });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('test-token', mockRawRequest());

      expect(result).toBeNull();
    });

    it('should return null when session is missing session object', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: null,
        user: mockUser,
      });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('test-token', mockRawRequest());

      expect(result).toBeNull();
    });

    it('should pass Cookie header when present for cookie-based sessions', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const rawReq = mockRawRequest({ Cookie: 'better-auth.session_token=abc123' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('test-token', rawReq);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=abc123');
    });

    it('should convert Bearer token to cookie header when no session cookie exists', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('my-bearer-token', mockRawRequest());

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=my-bearer-token');
    });

    it('should not overwrite existing session cookie when Bearer token is also present', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const rawReq = mockRawRequest({ Cookie: 'better-auth.session_token=cookie-token' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('some-token', rawReq);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      // Should use the existing cookie, not create a new one from the Bearer token
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=cookie-token');
    });

    it('should use custom cookiePrefix when converting Bearer token to cookie', async () => {
      const customAuth = { ...mockAuth, options: { advanced: { cookiePrefix: 'myapp' } } };
      customAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });

      const auth = new MastraAuthBetterAuth({
        auth: customAuth as any,
      });
      await auth.authenticateToken('my-bearer-token', mockRawRequest());

      const call = customAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('myapp.session_token=my-bearer-token');
    });

    it('should add session cookie alongside other cookies when Bearer token provided', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const rawReq = mockRawRequest({ Cookie: 'other_cookie=value' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('my-bearer-token', rawReq);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('other_cookie=value; better-auth.session_token=my-bearer-token');
    });

    it('should work with raw Request (no .header() method)', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const rawReq = mockRawRequest({ Cookie: 'better-auth.session_token=raw-token' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('raw-token', rawReq);

      expect(result).toEqual({ session: mockSession, user: mockUser });
      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=raw-token');
    });

    it('should read Cookie from raw Request', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const rawReq = mockRawRequest({ Cookie: 'better-auth.session_token=raw123' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('test-token', rawReq);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=raw123');
    });

    it('should handle HonoRequest with .raw property', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      const honoReq = {
        raw: new Request('http://localhost/test', {
          headers: { Cookie: 'better-auth.session_token=hono-token' },
        }),
      } as any;

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('hono-token', honoReq);

      expect(result).toEqual({ session: mockSession, user: mockUser });
      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=hono-token');
    });

    it('should sign unsigned Bearer tokens with the instance secret before setting the session cookie', async () => {
      const secret = 'test-secret-that-is-at-least-32-chars';
      const authWithContext = {
        ...mockAuth,
        $context: Promise.resolve({
          secret,
          authCookies: { sessionToken: { name: 'better-auth.session_token' } },
          internalAdapter: { findUserById: vi.fn() },
        }),
      };
      authWithContext.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });

      const auth = new MastraAuthBetterAuth({
        auth: authWithContext as any,
      });
      await auth.authenticateToken('my-unsigned-token', mockRawRequest());

      const expectedSignature = await makeSignature('my-unsigned-token', secret);
      const call = authWithContext.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe(
        `better-auth.session_token=${encodeURIComponent(`my-unsigned-token.${expectedSignature}`)}`,
      );
    });

    it('should pass already-signed tokens through without re-signing', async () => {
      const secret = 'test-secret-that-is-at-least-32-chars';
      const authWithContext = {
        ...mockAuth,
        $context: Promise.resolve({
          secret,
          authCookies: { sessionToken: { name: 'better-auth.session_token' } },
          internalAdapter: { findUserById: vi.fn() },
        }),
      };
      authWithContext.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });

      const auth = new MastraAuthBetterAuth({
        auth: authWithContext as any,
      });
      const signedToken = `some-token.${await makeSignature('some-token', secret)}`;
      await auth.authenticateToken(signedToken, mockRawRequest());

      const call = authWithContext.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe(`better-auth.session_token=${encodeURIComponent(signedToken)}`);
    });

    it('should use the session cookie name from the Better Auth context (e.g. __Secure- prefix)', async () => {
      const secret = 'test-secret-that-is-at-least-32-chars';
      const authWithContext = {
        ...mockAuth,
        $context: Promise.resolve({
          secret,
          authCookies: { sessionToken: { name: '__Secure-better-auth.session_token' } },
          internalAdapter: { findUserById: vi.fn() },
        }),
      };
      authWithContext.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });

      const auth = new MastraAuthBetterAuth({
        auth: authWithContext as any,
      });
      await auth.authenticateToken('my-unsigned-token', mockRawRequest());

      const call = authWithContext.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toMatch(/^__Secure-better-auth\.session_token=/);
    });

    it('should inject session cookie when session name appears only inside a cookie value', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      // The session cookie name appears as part of another cookie's VALUE, not as a key
      const rawReq = mockRawRequest({ Cookie: 'other_cookie=contains_better-auth.session_token=xyz' });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('my-bearer-token', rawReq);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe(
        'other_cookie=contains_better-auth.session_token=xyz; better-auth.session_token=my-bearer-token',
      );
    });
  });

  describe('authorizeUser', () => {
    it('should return true for valid user with session', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: mockSession,
        user: mockUser,
      } as BetterAuthUser);

      expect(result).toBe(true);
    });

    it('should return false when session id is missing', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: { ...mockSession, id: '' },
        user: mockUser,
      } as BetterAuthUser);

      expect(result).toBe(false);
    });

    it('should return false when user id is missing', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: mockSession,
        user: { ...mockUser, id: '' },
      } as BetterAuthUser);

      expect(result).toBe(false);
    });

    it('should return false when user is null', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser(null as any);

      expect(result).toBe(false);
    });

    it('should return false when session is null', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: null,
        user: mockUser,
      } as any);

      expect(result).toBe(false);
    });
  });

  describe('custom authorization', () => {
    it('can be overridden with custom authorization logic', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        async authorizeUser(user: BetterAuthUser): Promise<boolean> {
          // Custom logic: only allow verified emails
          return user?.user?.emailVerified === true;
        },
      });

      // Test with verified user
      const verifiedUser = {
        session: mockSession,
        user: { ...mockUser, emailVerified: true },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(verifiedUser)).toBe(true);

      // Test with unverified user
      const unverifiedUser = {
        session: mockSession,
        user: { ...mockUser, emailVerified: false },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(unverifiedUser)).toBe(false);
    });

    it('can implement role-based access control', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        async authorizeUser(user: BetterAuthUser): Promise<boolean> {
          // Custom logic: check for admin role
          const userWithRole = user?.user as any;
          return userWithRole?.role === 'admin';
        },
      });

      // Test with admin user
      const adminUser = {
        session: mockSession,
        user: { ...mockUser, role: 'admin' },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(adminUser)).toBe(true);

      // Test with regular user
      const regularUser = {
        session: mockSession,
        user: { ...mockUser, role: 'user' },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(regularUser)).toBe(false);
    });
  });

  describe('route configuration options', () => {
    it('should store public routes configuration when provided', () => {
      const publicRoutes = ['/health', '/api/status'];
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        public: publicRoutes,
      });

      expect(auth.public).toEqual(publicRoutes);
    });

    it('should store protected routes configuration when provided', () => {
      const protectedRoutes = ['/api/*', '/admin/*'];
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        protected: protectedRoutes,
      });

      expect(auth.protected).toEqual(protectedRoutes);
    });

    it('should handle both public and protected routes together', () => {
      const publicRoutes = ['/health', '/api/status'];
      const protectedRoutes = ['/api/*', '/admin/*'];

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        public: publicRoutes,
        protected: protectedRoutes,
      });

      expect(auth.public).toEqual(publicRoutes);
      expect(auth.protected).toEqual(protectedRoutes);
    });
  });

  describe('getUser', () => {
    it('should look up users via the internal adapter', async () => {
      const findUserById = vi.fn().mockResolvedValue(mockUser);
      const authWithContext = {
        ...mockAuth,
        $context: Promise.resolve({
          secret: 'test-secret-that-is-at-least-32-chars',
          authCookies: { sessionToken: { name: 'better-auth.session_token' } },
          internalAdapter: { findUserById },
        }),
      };

      const auth = new MastraAuthBetterAuth({
        auth: authWithContext as any,
      });
      const user = await auth.getUser('user-123');

      expect(findUserById).toHaveBeenCalledWith('user-123');
      expect(user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should return null when the user is not found', async () => {
      const authWithContext = {
        ...mockAuth,
        $context: Promise.resolve({
          secret: 'test-secret-that-is-at-least-32-chars',
          authCookies: { sessionToken: { name: 'better-auth.session_token' } },
          internalAdapter: { findUserById: vi.fn().mockResolvedValue(null) },
        }),
      };

      const auth = new MastraAuthBetterAuth({
        auth: authWithContext as any,
      });
      expect(await auth.getUser('missing')).toBeNull();
    });

    it('should return null when the auth context is unavailable', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      expect(await auth.getUser('user-123')).toBeNull();
    });

    it('should batch look up users with getUsers, preserving order and nulls', async () => {
      const findUserById = vi.fn().mockImplementation((id: string) => (id === 'user-123' ? mockUser : null));
      const authWithContext = {
        ...mockAuth,
        $context: Promise.resolve({
          secret: 'test-secret-that-is-at-least-32-chars',
          authCookies: { sessionToken: { name: 'better-auth.session_token' } },
          internalAdapter: { findUserById },
        }),
      };

      const auth = new MastraAuthBetterAuth({
        auth: authWithContext as any,
      });
      const users = await auth.getUsers(['missing', 'user-123']);

      expect(users).toHaveLength(2);
      expect(users[0]).toBeNull();
      expect(users[1]).toMatchObject({ id: 'user-123' });
    });
  });

  describe('end-to-end with a real Better Auth instance', () => {
    const createRealAuth = () =>
      betterAuth({
        baseURL: 'http://localhost:3000',
        secret: 'test-secret-that-is-at-least-32-chars',
        database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
        emailAndPassword: { enabled: true },
      });

    it('authenticates the unsigned token returned by signUp/signIn (issue #19110)', async () => {
      const provider = new MastraAuthBetterAuth({ auth: createRealAuth() });

      const signUpResult = await provider.signUp(
        'e2e@example.com',
        'super-secure-password',
        'E2E User',
        new Request('http://localhost:3000/signup'),
      );
      expect(signUpResult.token).toBeTruthy();
      // signUp/signIn return the RAW session token — no signature
      expect(signUpResult.token).not.toContain('.');

      // Bearer-style request: no cookies, just the raw token
      const result = await provider.authenticateToken(signUpResult.token!, new Request('http://localhost:3000/api'));

      expect(result).not.toBeNull();
      expect(result?.user.email).toBe('e2e@example.com');
      expect(result?.session.token).toBe(signUpResult.token);
    });

    it('resolves the current user from an Authorization: Bearer header', async () => {
      const provider = new MastraAuthBetterAuth({ auth: createRealAuth() });

      const signUpResult = await provider.signUp(
        'bearer@example.com',
        'super-secure-password',
        'Bearer User',
        new Request('http://localhost:3000/signup'),
      );

      const user = await provider.getCurrentUser(
        new Request('http://localhost:3000/api', {
          headers: { Authorization: `Bearer ${signUpResult.token}` },
        }),
      );

      expect(user).not.toBeNull();
      expect(user?.email).toBe('bearer@example.com');
    });

    it('looks up users by ID via getUser/getUsers (issue #19110)', async () => {
      const provider = new MastraAuthBetterAuth({ auth: createRealAuth() });

      const signUpResult = await provider.signUp(
        'lookup@example.com',
        'super-secure-password',
        'Lookup User',
        new Request('http://localhost:3000/signup'),
      );

      const user = await provider.getUser(signUpResult.user.id);
      expect(user).toMatchObject({
        id: signUpResult.user.id,
        email: 'lookup@example.com',
        name: 'Lookup User',
      });

      expect(await provider.getUser('does-not-exist')).toBeNull();

      const users = await provider.getUsers([signUpResult.user.id, 'does-not-exist']);
      expect(users[0]).toMatchObject({ id: signUpResult.user.id });
      expect(users[1]).toBeNull();
    });
  });

  describe('handleAuthRequest', () => {
    it('proxies the raw request to the better-auth handler', async () => {
      const handler = vi.fn(async () => new Response('better-auth handled', { status: 200 }));
      const provider = new MastraAuthBetterAuth({ auth: { ...mockAuth, handler } as any });

      const res = await provider.handleAuthRequest(
        new Request('http://localhost/auth/api/sign-in/email', { method: 'POST' }),
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('better-auth handled');
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('getClearSessionHeaders', () => {
    it('clears the session and signature cookies with SameSite=Lax same-origin', () => {
      const provider = new MastraAuthBetterAuth({ auth: mockAuth as any });
      expect(provider.getClearSessionHeaders()['Set-Cookie']).toBe(
        'better-auth.session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0, ' +
          'better-auth.session_token_sig=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      );
    });

    it('uses SameSite=None; Secure after init() with cross-origin SPA origins', async () => {
      const provider = new MastraAuthBetterAuth({ auth: mockAuth as any });
      await provider.init({ allowedOrigins: ['https://app.acme.com'] });
      expect(provider.getClearSessionHeaders()['Set-Cookie']).toContain('SameSite=None; Secure');
    });

    it('honors the __Secure- prefix better-auth applies on https deploys', () => {
      const provider = new MastraAuthBetterAuth({
        auth: { ...mockAuth, options: { baseURL: 'https://factory.acme.com' } } as any,
      });
      expect(provider.getClearSessionHeaders()['Set-Cookie']).toMatch(/^__Secure-better-auth\.session_token=/);
    });

    it('honors a renamed session cookie via advanced.cookies.session_token.name', () => {
      const provider = new MastraAuthBetterAuth({
        auth: { ...mockAuth, options: { advanced: { cookies: { session_token: { name: 'acme_session' } } } } } as any,
      });
      expect(provider.getClearSessionHeaders()['Set-Cookie']).toMatch(/^acme_session=/);
    });
  });

  describe('isOrganizationAdmin', () => {
    const providerWithCtx = (ctx: Record<string, unknown>) =>
      new MastraAuthBetterAuth({ auth: { ...mockAuth, $context: Promise.resolve(ctx) } as any });

    it.each(['owner', 'admin'])('allows the %s role', async role => {
      const findOne = vi.fn(async () => ({ organizationId: 'org_1', role }));
      const provider = providerWithCtx({ adapter: { findOne } });

      await expect(provider.isOrganizationAdmin('org_1', 'user_1')).resolves.toBe(true);
      expect(findOne).toHaveBeenCalledWith({
        model: 'member',
        where: [
          { field: 'organizationId', value: 'org_1' },
          { field: 'userId', value: 'user_1' },
        ],
      });
    });

    it('denies member roles', async () => {
      const findOne = vi.fn(async () => ({ organizationId: 'org_1', role: 'member' }));
      const provider = providerWithCtx({ adapter: { findOne } });
      await expect(provider.isOrganizationAdmin('org_1', 'user_1')).resolves.toBe(false);
    });

    it('denies when no membership exists', async () => {
      const provider = providerWithCtx({ adapter: { findOne: vi.fn(async () => null) } });
      await expect(provider.isOrganizationAdmin('org_1', 'user_1')).resolves.toBe(false);
    });

    it('fails closed when membership lookup fails', async () => {
      const provider = providerWithCtx({
        adapter: { findOne: vi.fn(async () => Promise.reject(new Error('db down'))) },
      });
      await expect(provider.isOrganizationAdmin('org_1', 'user_1')).resolves.toBe(false);
    });
  });

  describe('ensureOrganization (personal-org bootstrap)', () => {
    interface MockDbAdapter {
      findMany: ReturnType<typeof vi.fn>;
      findOne: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    }

    function mockDbAdapter(overrides: Partial<MockDbAdapter> = {}): MockDbAdapter {
      return {
        findMany: vi.fn(async () => []),
        findOne: vi.fn(async () => null),
        create: vi.fn(async (input: { model: string }) => ({ id: `${input.model}_created` })),
        ...overrides,
      };
    }

    const providerWith = (dbAdapter: MockDbAdapter) =>
      new MastraAuthBetterAuth({
        auth: {
          ...mockAuth,
          $context: Promise.resolve({
            adapter: dbAdapter,
            internalAdapter: { findUserById: vi.fn(async () => ({ id: 'user_1', email: 'u@example.com' })) },
          }),
        } as any,
      });

    it('returns the first existing membership org without creating', async () => {
      const dbAdapter = mockDbAdapter({ findMany: vi.fn(async () => [{ organizationId: 'org_existing' }]) });
      const provider = providerWith(dbAdapter);

      expect(await provider.ensureOrganization('user_1')).toBe('org_existing');
      expect(dbAdapter.create).not.toHaveBeenCalled();
    });

    it('creates a personal org + owner membership for a no-org user', async () => {
      const dbAdapter = mockDbAdapter({
        create: vi.fn(async (input: { model: string }) =>
          input.model === 'organization' ? { id: 'org_new' } : { id: 'member_new' },
        ),
      });
      const provider = providerWith(dbAdapter);

      expect(await provider.ensureOrganization('user_1')).toBe('org_new');

      const orgCall = dbAdapter.create.mock.calls.find(([input]) => input.model === 'organization')![0];
      expect(orgCall.data).toMatchObject({ name: "u@example.com's org", slug: 'personal-user_1' });
      const memberCall = dbAdapter.create.mock.calls.find(([input]) => input.model === 'member')![0];
      expect(memberCall.data).toMatchObject({ organizationId: 'org_new', userId: 'user_1', role: 'owner' });
    });

    it('recovers the existing org by slug when the create hits the unique constraint', async () => {
      const dbAdapter = mockDbAdapter({
        create: vi.fn(async (input: { model: string }) => {
          if (input.model === 'organization') throw new Error('duplicate key value violates unique constraint');
          return { id: 'member_new' };
        }),
        findOne: vi.fn(async (input: { model: string }) =>
          input.model === 'organization' ? { id: 'org_prior' } : null,
        ),
      });
      const provider = providerWith(dbAdapter);

      expect(await provider.ensureOrganization('user_1')).toBe('org_prior');
      expect(dbAdapter.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'organization', where: [{ field: 'slug', value: 'personal-user_1' }] }),
      );
    });

    it('does not adopt a slug-squatted org owned by another user', async () => {
      // An attacker pre-created `personal-user_1` through the public org API and
      // is its owner. Recovery must NOT attach the victim there — it creates a
      // fresh personal org with an unguessable slug instead.
      const createdOrgs: Array<{ slug: string }> = [];
      const dbAdapter = mockDbAdapter({
        create: vi.fn(async (input: { model: string; data?: { slug?: string } }) => {
          if (input.model === 'organization') {
            if (input.data?.slug === 'personal-user_1') {
              throw new Error('duplicate key value violates unique constraint');
            }
            createdOrgs.push({ slug: input.data!.slug! });
            return { id: 'org_fallback' };
          }
          return { id: 'member_new' };
        }),
        findOne: vi.fn(async (input: { model: string }) =>
          input.model === 'organization' ? { id: 'org_squatted' } : null,
        ),
        findMany: vi.fn(async (input: { model: string; where?: Array<{ field: string }> }) => {
          // First call: the victim's memberships (none). Second: the squatted org's members.
          if (input.model === 'member' && input.where?.[0]?.field === 'organizationId') {
            return [{ organizationId: 'org_squatted', userId: 'attacker_1' }];
          }
          return [];
        }),
      });
      const provider = providerWith(dbAdapter);

      expect(await provider.ensureOrganization('user_1')).toBe('org_fallback');
      expect(createdOrgs[0]!.slug).toMatch(/^personal-user_1-[0-9a-f-]{36}$/);
      // The victim's owner membership lands on the fallback org, never the squatted one.
      const memberCall = dbAdapter.create.mock.calls.find(([input]) => input.model === 'member')![0];
      expect(memberCall.data).toMatchObject({ organizationId: 'org_fallback', userId: 'user_1', role: 'owner' });
    });

    it('tolerates a membership a concurrent bootstrap already created', async () => {
      const dbAdapter = mockDbAdapter({
        create: vi.fn(async (input: { model: string }) => {
          if (input.model === 'organization') return { id: 'org_new' };
          throw new Error('duplicate member');
        }),
        findOne: vi.fn(async (input: { model: string }) => (input.model === 'member' ? { id: 'member_prior' } : null)),
      });
      const provider = providerWith(dbAdapter);

      expect(await provider.ensureOrganization('user_1')).toBe('org_new');
    });

    it('is best-effort: swallows failures and returns undefined', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dbAdapter = mockDbAdapter({ findMany: vi.fn(async () => Promise.reject(new Error('db down'))) });
      const provider = providerWith(dbAdapter);

      expect(await provider.ensureOrganization('user_1')).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('caches the resolved org so subsequent calls skip the DB', async () => {
      const dbAdapter = mockDbAdapter({ findMany: vi.fn(async () => [{ organizationId: 'org_cached' }]) });
      const provider = providerWith(dbAdapter);

      await provider.ensureOrganization('user_1');
      await provider.ensureOrganization('user_1');
      expect(dbAdapter.findMany).toHaveBeenCalledOnce();
    });
  });
});
